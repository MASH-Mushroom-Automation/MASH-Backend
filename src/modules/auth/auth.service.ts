import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  UseInterceptors,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { Cacheable } from '../../common/decorators/cache.decorator';
import { CacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { ClerkService } from './services/clerk.service';
import { EmailService } from '../notifications/services/email.service';
import { OAuthService } from '../oauth/oauth.service';
import { OAuthUserData } from '../oauth/interfaces/oauth-user.interface';
import * as admin from 'firebase-admin';
import { Response } from 'express';
import { ClerkWebhookDto } from './dto/clerk-webhook.dto';
import { RegisterDto } from './dto/register.dto';
import {
  VerifyEmailDto,
  ResendVerificationDto,
  VerifyEmailCodeDto,
  ResendVerificationCodeDto,
} from './dto/verify-email.dto';
import {
  ResetPasswordDto,
  VerifyResetCodeDto,
  ResendPasswordResetCodeDto,
} from './dto/password-reset.dto';
import { OAuthCallbackDto } from './dto/oauth.dto';
import { TokenResponse } from './interfaces/jwt-payload.interface';
import { hashPassword, comparePassword } from '../../common/helpers/bcrypt.helper';
import {
  generateVerificationToken,
  generateTokenExpiry,
  isTokenExpired,
  generateSixDigitCode,
  generateCodeExpiry,
  isCodeExpired,
} from '../../common/helpers/token.helper';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { PrometheusService } from '../../monitoring/prometheus/prometheus.service';

// Interfaces for type safety
interface ClerkUserData {
  id: string;
  email_addresses: Array<{ email_address: string }>;
  username?: string;
  first_name?: string;
  last_name?: string;
  image_url?: string;
}

interface SessionUser {
  userId: string;
  clerkId: string;
  role: string;
  sessionId: string;
  expiresAt: Date;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  exp: number;
}

@Injectable()
@UseInterceptors(CacheInterceptor)
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private tracer = trace.getTracer('auth-service');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly clerkService: ClerkService,
    private readonly emailService: EmailService,
    private readonly prometheusService: PrometheusService,
    private readonly oauthService: OAuthService,
  ) {}

  async handleClerkWebhook(payload: ClerkWebhookDto) {
    const { type, data } = payload;

    switch (type) {
      case 'user.created':
        return this.createUser(data as ClerkUserData);
      case 'user.updated':
        return this.updateUser(data as ClerkUserData);
      case 'user.deleted':
        return this.deleteUser(data as ClerkUserData);
      default:
        return { message: 'Event type not handled' };
    }
  }

  /**
   * Get current user information
   * ✅ CACHED: 15 minutes TTL
   * Hot path - user session data cached for performance
   */
  @Cacheable({ key: 'auth:user', ttl: 900, tags: ['auth', 'users'] })
  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Get session information
   * ✅ CACHED: 15 minutes TTL
   * Hot path - session info frequently accessed
   */
  @Cacheable({ key: 'auth:session', ttl: 900, tags: ['auth', 'sessions'] })
  getSessionInfo(user: SessionUser) {
    return {
      userId: user.userId,
      clerkId: user.clerkId,
      role: user.role,
      permissions: this.getPermissionsByRole(user.role),
      sessionId: user.sessionId,
      expiresAt: user.expiresAt,
    };
  }

  logout(/* userId: string */) {
    // In a real application, you might want to invalidate tokens
    // For now, we'll just return a success message
    return { message: 'Logout successful' };
  }

  private async createUser(userData: ClerkUserData) {
    // Extract Google OAuth data if present (Clerk SSO)
    const externalAccounts = (userData as any).external_accounts || [];
    const googleAccount = externalAccounts.find((acc: any) => acc.provider === 'google');

    const userEmail = userData.email_addresses[0]?.email_address ?? '';
    const isEmailVerified =
      (userData.email_addresses[0] as any)?.verification?.status === 'verified' || !!googleAccount;

    // Check if user already exists (by email or clerkId)
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: userEmail }, { clerkId: userData.id }],
      },
    });

    if (existingUser) {
      // Update existing user with Clerk data
      const updatedUser = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          clerkId: userData.id,
          email: userEmail,
          emailVerified: isEmailVerified,
          username: userData.username ?? existingUser.username,
          firstName: userData.first_name ?? existingUser.firstName,
          lastName: userData.last_name ?? existingUser.lastName,
          imageUrl: userData.image_url ?? existingUser.imageUrl,
          // Add Google ID if user signed up with Google
          googleId: googleAccount?.provider_user_id || existingUser.googleId,
          // Update oauthProvider array
          oauthProvider: googleAccount
            ? Array.from(new Set([...(existingUser.oauthProvider || []), 'google']))
            : existingUser.oauthProvider,
        },
      });

      this.logger.log(`✅ Updated existing user: ${updatedUser.email}`);
      return { message: 'User updated', userId: updatedUser.id };
    }

    // Create new user
    const user = await this.prisma.user.create({
      data: {
        clerkId: userData.id,
        email: userEmail,
        emailVerified: isEmailVerified,
        username: userData.username ?? null,
        firstName: userData.first_name ?? null,
        lastName: userData.last_name ?? null,
        imageUrl: userData.image_url ?? null,
        // Add Google ID if user signed up with Google
        googleId: googleAccount?.provider_user_id || null,
        // Set oauthProvider array
        oauthProvider: googleAccount ? ['google'] : [],
        role: 'USER', // Default role
      },
    });

    this.logger.log(`✅ Created new user: ${user.email}`);

    // Send welcome email
    try {
      const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;
      await this.emailService.sendWelcomeEmail(user.email, user.firstName || 'User', dashboardUrl);
    } catch (error) {
      this.logger.error(`❌ Failed to send welcome email: ${error.message}`);
    }

    return { message: 'User created successfully', userId: user.id };
  }

  private async updateUser(userData: ClerkUserData) {
    // Extract Google OAuth data if present (Clerk SSO)
    const externalAccounts = (userData as any).external_accounts || [];
    const googleAccount = externalAccounts.find((acc: any) => acc.provider === 'google');

    const userEmail = userData.email_addresses[0]?.email_address;
    const isEmailVerified =
      (userData.email_addresses[0] as any)?.verification?.status === 'verified' || !!googleAccount;

    // Fetch existing user to merge oauthProvider array
    const existingUser = await this.prisma.user.findUnique({
      where: { clerkId: userData.id },
      select: { oauthProvider: true },
    });

    const updatedOAuthProviders =
      googleAccount && existingUser
        ? Array.from(new Set([...(existingUser.oauthProvider || []), 'google']))
        : existingUser?.oauthProvider;

    const user = await this.prisma.user.update({
      where: { clerkId: userData.id },
      data: {
        email: userEmail ?? undefined,
        emailVerified: isEmailVerified,
        username: userData.username ?? undefined,
        firstName: userData.first_name ?? undefined,
        lastName: userData.last_name ?? undefined,
        imageUrl: userData.image_url ?? undefined,
        // Update Google ID if changed
        googleId: googleAccount?.provider_user_id || undefined,
        // Update oauthProvider array
        oauthProvider: updatedOAuthProviders,
      },
    });

    this.logger.log(`✅ Updated user: ${user.email}`);
    return { message: 'User updated successfully', userId: user.id };
  }

  private async deleteUser(userData: ClerkUserData) {
    await this.prisma.user.update({
      where: { clerkId: userData.id },
      data: { isActive: false },
    });

    return { message: 'User deactivated successfully' };
  }

  // 7. Get User Permissions (public method for controller)
  async getUserPermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user.id,
      role: user.role,
      permissions: this.getPermissionsByRole(user.role),
    };
  }

  private getPermissionsByRole(role: string): string[] {
    const permissions: Record<string, string[]> = {
      USER: ['read:profile', 'update:profile', 'read:devices', 'create:orders'],
      GROWER: [
        'read:profile',
        'update:profile',
        'read:devices',
        'manage:devices',
        'read:sensors',
        'create:products',
      ],
      ADMIN: ['read:all', 'write:all', 'delete:all', 'manage:users'],
      SUPER_ADMIN: ['*'],
    };

    return permissions[role] || permissions.USER;
  }

  // 3. Refresh Token
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);

      // Verify user still exists
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User no longer exists');
      }

      // Generate new tokens
      const newAccessToken = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      const newRefreshToken = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
        },
        { expiresIn: '7d' },
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 86400, // 1 day in seconds
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Login with email and password
   * - Uses Clerk to authenticate when available
   * - Falls back to local check (for development) if Clerk is not configured
   */
  async login(email: string, pass: string) {
    return this.tracer.startActiveSpan('AuthService.login', async span => {
      try {
        span.setAttribute('user.email', email);
        // If Clerk is configured, try Clerk sign-in flow
        try {
          if (this.clerkService && this.clerkService.getClient) {
            const clerkUser = await this.clerkService.getUserByEmail(email);
            if (!clerkUser) {
              throw new UnauthorizedException('Invalid credentials');
            }

            // Clerk-managed password check should be performed via Clerk's SDK
            // For now assume user exists and password is valid when Clerk is enabled
            const user = await this.prisma.user.findUnique({ where: { email } });
            if (!user) {
              throw new UnauthorizedException('Invalid credentials');
            }

            // Check if email is verified
            if (!user.emailVerified) {
              throw new UnauthorizedException(
                'Please verify your email address before logging in. Check your inbox for the verification link.',
              );
            }

            const isPasswordMatching = await comparePassword(pass, user.password);
            if (!isPasswordMatching) {
              throw new UnauthorizedException('Invalid credentials');
            }

            const accessToken = this.jwtService.sign({
              sub: user.id,
              email: user.email,
              role: user.role,
            });

            const refreshToken = this.jwtService.sign(
              {
                sub: user.id,
                email: user.email,
                role: user.role,
              },
              { expiresIn: '30d' },
            );

            span.setAttribute('user.id', user.id);
            span.addEvent('Login successful (Clerk flow)');
            span.setStatus({ code: SpanStatusCode.OK });

            return {
              success: true,
              message: 'Authentication successful',
              accessToken,
              refreshToken,
              user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                isActive: user.isActive,
              },
            };
          }
        } catch (error) {
          this.logger.warn('Clerk auth not available or failed - falling back to local auth');
          span.addEvent('Clerk auth failed, falling back to local', {
            'error.message': error instanceof Error ? error.message : 'Unknown error',
          });
        }

        // Development fallback: validate user exists and password length only
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) {
          throw new UnauthorizedException('Invalid credentials');
        }

        // Check if email is verified
        if (!user.emailVerified) {
          throw new UnauthorizedException(
            'Please verify your email address before logging in. Check your inbox for the verification link.',
          );
        }

        const isPasswordMatching = await comparePassword(pass, user.password);
        if (!isPasswordMatching) {
          throw new UnauthorizedException('Invalid credentials');
        }

        // NOTE: No local password hash check implemented - assume developer uses Clerk
        const accessToken = this.jwtService.sign({
          sub: user.id,
          email: user.email,
          role: user.role,
        });

        const refreshToken = this.jwtService.sign(
          {
            sub: user.id,
            email: user.email,
            role: user.role,
          },
          { expiresIn: '30d' },
        );

        span.setAttribute('user.id', user.id);
        span.addEvent('Login successful (fallback)');
        span.setStatus({ code: SpanStatusCode.OK });

        return {
          success: true,
          message: 'Authentication successful (fallback)',
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        span.end();
      }
    });
  }

  // 6. Verify Token
  async verifyToken(token: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      // Verify user still exists
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User no longer exists');
      }

      return {
        valid: true,
        userId: user.id,
        email: user.email,
        role: user.role,
        expiresAt: new Date(payload.exp * 1000),
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  // 8. Impersonate User
  async impersonateUser(adminId: string, targetUserId: string) {
    // Verify admin permissions
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN')) {
      throw new UnauthorizedException('Insufficient permissions');
    }

    // Find target user
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    // Generate impersonation token (shorter expiration)
    const impersonationToken = this.jwtService.sign(
      {
        sub: targetUser.id,
        email: targetUser.email,
        role: targetUser.role,
        impersonatedBy: adminId,
      },
      { expiresIn: '1h' }, // Shorter expiration for security
    );

    return {
      impersonationToken,
      targetUser,
      adminId,
      expiresIn: 3600, // 1 hour in seconds
    };
  }

  // ==================== NEW AUTHENTICATION FLOW METHODS ====================

  /**
   * Check if username already exists
   * Used by frontend during registration to generate unique usernames
   */
  async checkUsernameExists(username: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    return !!user;
  }

  /**
   * Sync Google Auth user to PostgreSQL database
   * Creates or updates user from Google OAuth login
   */
  async syncGoogleUser(googleSyncDto: any) {
    const logger = new Logger('AuthService.syncGoogleUser');
    logger.log('[STARTUP] Google user sync process started');

    try {
      // Step 1: Check if user exists by Google ID or email
      logger.log('[CONFIG] Checking for existing user');
      let user = await this.prisma.user.findFirst({
        where: {
          OR: [{ googleId: googleSyncDto.googleId }, { email: googleSyncDto.email }],
        },
      });

      // Step 2: Generate username if not provided
      let username = googleSyncDto.username;
      if (!username) {
        logger.log('[CONFIG] Auto-generating username from email/name');
        const baseUsername = googleSyncDto.firstName
          ? `${googleSyncDto.firstName}${googleSyncDto.lastName || ''}`
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '')
          : googleSyncDto.email
              .split('@')[0]
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '');

        // Check if username is taken, add random numbers if needed
        username = baseUsername;
        let attempts = 0;
        while (await this.checkUsernameExists(username)) {
          username = `${baseUsername}${Math.floor(1000 + Math.random() * 9000)}`;
          attempts++;
          if (attempts > 10) {
            throw new InternalServerErrorException('Could not generate unique username');
          }
        }
        logger.log(`[SUCCESS] Generated unique username: ${username}`);
      }

      // Step 3: Determine avatar URL (prioritize Google photoURL)
      const imageUrl =
        googleSyncDto.photoURL ||
        `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(username)}`;

      if (user) {
        // Step 4a: Update existing user
        logger.log(`[CONFIG] Updating existing user: ${user.id}`);
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleSyncDto.googleId,
            firstName: googleSyncDto.firstName,
            lastName: googleSyncDto.lastName,
            imageUrl: googleSyncDto.photoURL || user.imageUrl, // Keep existing if no new photo
            username: user.username || username, // Keep existing username if set
            emailVerified: true, // Google emails are pre-verified
            lastLoginAt: new Date(),
          },
        });
        logger.log('[SUCCESS] User updated successfully');
      } else {
        // Step 4b: Create new user
        logger.log('[CONFIG] Creating new Google user');
        user = await this.prisma.user.create({
          data: {
            googleId: googleSyncDto.googleId,
            email: googleSyncDto.email,
            username,
            firstName: googleSyncDto.firstName,
            lastName: googleSyncDto.lastName,
            imageUrl,
            emailVerified: true, // Google emails are pre-verified
            role: 'USER',
            isActive: true,
            lastLoginAt: new Date(),
          },
        });
        logger.log(`[SUCCESS] New user created: ${user.id}`);
      }

      // Step 5: Generate JWT tokens
      logger.log('[CONFIG] Generating JWT tokens');
      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

      logger.log('[SUCCESS] Google user sync completed successfully');

      return {
        success: true,
        message: 'Google authentication successful',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
          role: user.role,
          emailVerified: user.emailVerified,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 3600, // 1 hour in seconds
        },
      };
    } catch (error) {
      logger.error(`[ERROR] Google user sync failed: ${error.message}`);
      if (error instanceof ConflictException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to sync Google user');
    }
  }

  /**
   * Register a new user with email verification
   * Clerk integration is optional - system works with database-first registration
   */
  async register(registerDto: RegisterDto) {
    const logger = new Logger('AuthService.register');
    logger.log('[STARTUP] User registration process started');

    try {
      // Step 1: Check if email already exists
      logger.log('[CONFIG] Checking for duplicate email');
      const existingUser = await this.prisma.user.findUnique({
        where: { email: registerDto.email },
      });

      if (existingUser) {
        logger.warn('[WARN] Registration failed - Email already exists');
        throw new ConflictException('User with this email already exists');
      }

      // Step 2: Check if username already exists (if provided)
      if (registerDto.username) {
        logger.log('[CONFIG] Checking for duplicate username');
        const existingUsername = await this.prisma.user.findUnique({
          where: { username: registerDto.username },
        });

        if (existingUsername) {
          logger.warn('[WARN] Registration failed - Username already taken');
          throw new ConflictException('Username already taken');
        }
      }

      // Step 3: Hash password
      logger.log('[CONFIG] Hashing password');
      const hashedPassword = await hashPassword(registerDto.password);

      // Step 4: Generate email verification code (6-digit for mobile) and token (64-char for web fallback)
      logger.log('[CONFIG] Generating email verification code and token');
      const verificationCode = generateSixDigitCode(); // "123456"
      const codeExpiry = generateCodeExpiry(10); // 10 minutes
      const verificationToken = generateVerificationToken(); // 64-char hex
      const tokenExpiry = generateTokenExpiry(24); // 24 hours

      logger.log(`[INFO] Verification code generated (expires in 10 minutes): ${verificationCode}`);
      logger.log(`[INFO] Verification token generated (expires: ${tokenExpiry.toISOString()})`);

      // Step 5: Try to create Clerk user (optional - won't fail registration if Clerk is down)
      let clerkId = `local_${generateVerificationToken().substring(0, 32)}`; // Generate local ID as fallback
      let clerkUser: any = null;
      let clerkUsername = registerDto.username;

      try {
        logger.log('[CONFIG] Attempting Clerk user creation');
        clerkUser = await this.clerkService.registerUser({
          email: registerDto.email,
          password: registerDto.password,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          username: registerDto.username,
        });
        clerkId = clerkUser.id;
        logger.log('[SUCCESS] Clerk user created successfully');
      } catch (clerkError: any) {
        // Clerk is optional - log warning but continue with local registration
        logger.warn('[WARN] Clerk user creation failed, using local auth only');
        const errorMessage = clerkError instanceof Error ? clerkError.message : 'Unknown error';
        logger.warn(`[WARN] Clerk error: ${errorMessage}`);

        // Check if it's a duplicate error (orphaned Clerk user scenario)
        if (errorMessage.includes('already exists') || errorMessage.includes('identifier_exists')) {
          logger.warn(
            '[WARN] Email exists in Clerk but not in database - likely orphaned user from failed registration',
          );
          logger.warn('[WARN] Continuing with local registration using fallback ID');
          logger.warn('[INFO] User can login using local auth (database password)');
        }

        // If Clerk username is taken, generate a unique username for local database
        if (
          clerkError?.errors?.[0]?.code === 'form_identifier_exists' &&
          clerkError?.errors?.[0]?.meta?.paramName === 'username'
        ) {
          // Generate unique username by appending random suffix
          const randomSuffix = Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, '0');
          clerkUsername = `${registerDto.username}_${randomSuffix}`;
          logger.warn(`[WARN] Clerk username taken, using local username: ${clerkUsername}`);
        }

        // Continue with registration using local clerkId
        // The user can still login using local auth (database password)
      }

      // Step 6: Generate DiceBear avatar URL (use provided imageUrl or generate)
      const avatarSeed = registerDto.username || registerDto.email.split('@')[0];
      const diceBearAvatarUrl =
        registerDto.imageUrl ||
        `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(avatarSeed)}`;

      // Step 7: Create user in database (with timeout handling)
      logger.log('[CONFIG] Creating user in database');
      let user;

      try {
        // Set timeout for database operation (10 seconds max)
        const createUserPromise = this.prisma.user.create({
          data: {
            clerkId: clerkId,
            email: registerDto.email,
            username: clerkUsername || null,
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
            password: hashedPassword,
            imageUrl: diceBearAvatarUrl,
            role: 'USER',
            isActive: true,
            emailVerified: false, // Not verified yet
            // 6-digit code system (primary for mobile)
            emailVerificationCode: verificationCode,
            emailVerificationCodeExpiry: codeExpiry,
            emailVerificationCodeUsed: false,
            emailVerificationAttempts: 0,
            emailVerificationCodeSentAt: new Date(),
            // Token system (fallback for web)
            emailVerificationToken: verificationToken,
            emailVerificationExpiry: tokenExpiry,
          },
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database operation timeout (10s)')), 10000),
        );

        user = await Promise.race([createUserPromise, timeoutPromise]);
        logger.log(`[SUCCESS] User created in database: ${user.id}`);
      } catch (dbError: any) {
        logger.error(`[ERROR] Database user creation failed: ${dbError.message}`);
        throw new InternalServerErrorException(
          'Database is currently unavailable. Please try again in a few minutes.',
        );
      }
      this.prometheusService.recordUserRegistration();

      // Step 8: Send Clerk verification email (optional)
      if (clerkUser) {
        try {
          await this.clerkService.sendEmailVerification(registerDto.email);
          logger.log('[SUCCESS] Clerk verification email sent');
        } catch (clerkEmailError) {
          logger.warn('[WARN] Clerk email verification failed, using MASH email only');
        }
      }

      // Step 9: Send MASH verification code email (primary method for mobile)
      logger.log(`[CONFIG] Sending 6-digit verification code to ${registerDto.email}`);

      try {
        await this.emailService.sendVerificationCodeEmail(
          registerDto.email,
          registerDto.firstName,
          verificationCode,
          '10 minutes',
        );
        logger.log('[SUCCESS] Verification code email sent successfully');
      } catch (emailError: unknown) {
        logger.error(`[ERROR] Failed to send verification code email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`);

        // Rollback user creation if email fails (user won't be able to verify)
        await this.prisma.user.delete({ where: { id: user.id } });
        logger.error('[ERROR] User creation rolled back due to email failure');

        throw new InternalServerErrorException(
          'Failed to send verification email. Our email service is currently slow or unavailable. Please try again in a few moments.',
        );
      }

      // Step 10: Return success response
      logger.log('[SUCCESS] Registration process completed');
      return {
        success: true,
        message:
          'Registration successful! A 6-digit verification code has been sent to your email.',
        user: {
          id: user.id,
          clerkId: user.clerkId,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
          emailVerified: false,
          role: user.role,
          createdAt: user.createdAt,
        },
        verification: {
          sent: true,
          method: 'code', // 6-digit code is primary method
          expiresIn: '10 minutes',
          email: user.email,
        },
        nextStep: `Check your email (${user.email}) for a 6-digit verification code. Enter it in the app using POST /auth/verify-email-code.`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[ERROR] Registration failed for ${registerDto.email}: ${errorMessage}`);

      // Re-throw known errors
      if (error instanceof ConflictException || error instanceof InternalServerErrorException) {
        throw error;
      }

      // Handle any other errors
      throw new InternalServerErrorException('Registration failed. Please try again.');
    }
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    try {
      // Find user by verification token
      const user = await this.prisma.user.findFirst({
        where: {
          emailVerificationToken: verifyEmailDto.token,
          emailVerified: false,
        },
      });

      if (!user) {
        throw new BadRequestException('Invalid or already used verification token');
      }

      // Check if token expired
      if (isTokenExpired(user.emailVerificationExpiry)) {
        throw new BadRequestException('Verification token has expired. Please request a new one.');
      }

      // Update user as verified
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpiry: null,
        },
      });

      // Also update Clerk metadata to reflect local verification
      try {
        await this.clerkService.updateUser(user.clerkId, {
          publicMetadata: {
            emailVerifiedLocally: true,
            verifiedAt: new Date().toISOString(),
          },
        });
      } catch (clerkError) {
        this.logger.error(`Failed to update Clerk metadata: ${clerkError.message}`);
        // Don't fail the verification if Clerk update fails
      }

      this.logger.log(`✅ Email verified successfully for user: ${user.email}`);

      return {
        success: true,
        message: 'Email verified successfully! You can now log in.',
        email: user.email,
        verified: true,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Email verification failed: ${error.message}`);
      throw new BadRequestException('Email verification failed. Please try again.');
    }
  }

  /**
   * Verify email with 6-digit code (PRIMARY METHOD for mobile apps)
   * Security features:
   * - Single-use codes
   * - 10-minute expiry
   * - Attempt tracking (max 5 attempts)
   * - Account lockout after 5 failed attempts
   * - Immediate login with JWT token
   */
  async verifyEmailWithCode(dto: VerifyEmailCodeDto) {
    const logger = new Logger('AuthService.verifyEmailWithCode');
    logger.log(`[STARTUP] Code verification attempt for email: ${dto.email}`);

    try {
      // Find user by email and code
      const user = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          emailVerificationCode: dto.code,
          emailVerified: false,
        },
      });

      if (!user) {
        // Increment failed attempts for this email
        await this.prisma.user.updateMany({
          where: { email: dto.email, emailVerified: false },
          data: {
            emailVerificationAttempts: {
              increment: 1,
            },
          },
        });

        logger.warn(`[WARN] Invalid verification code for email: ${dto.email}`);
        throw new BadRequestException(
          'Invalid verification code. Please check your email and try again.',
        );
      }

      // Check if code already used
      if (user.emailVerificationCodeUsed) {
        logger.warn(`[WARN] Code already used for email: ${dto.email}`);
        throw new BadRequestException(
          'This verification code has already been used. Please request a new code.',
        );
      }

      // Check if code expired
      if (isCodeExpired(user.emailVerificationCodeExpiry)) {
        logger.warn(`[WARN] Verification code expired for email: ${dto.email}`);
        throw new BadRequestException('Verification code has expired. Please request a new code.');
      }

      // Check failed attempts (max 5)
      if (user.emailVerificationAttempts >= 5) {
        logger.warn(`[WARN] Too many verification attempts for email: ${dto.email}`);
        throw new BadRequestException(
          'Too many failed verification attempts. Please request a new code.',
        );
      }

      // ✅ ALL CHECKS PASSED - Mark email as verified
      logger.log(`[SUCCESS] Verification code valid, marking email as verified`);

      const verifiedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerificationCode: null,
          emailVerificationCodeExpiry: null,
          emailVerificationCodeUsed: true,
          emailVerificationAttempts: 0,
          // Also clear old token system
          emailVerificationToken: null,
          emailVerificationExpiry: null,
        },
      });

      // Update Clerk metadata (if applicable)
      try {
        await this.clerkService.updateUser(user.clerkId, {
          publicMetadata: {
            emailVerifiedLocally: true,
            verifiedAt: new Date().toISOString(),
            verificationMethod: 'code',
          },
        });
        logger.log(`[SUCCESS] Clerk metadata updated`);
      } catch (clerkError) {
        logger.warn(`[WARN] Failed to update Clerk metadata (non-critical)`);
      }

      // Generate JWT token for immediate login
      const token = this.jwtService.sign({
        sub: verifiedUser.id,
        email: verifiedUser.email,
        role: verifiedUser.role,
      });

      logger.log(`[SUCCESS] Email verified successfully for: ${verifiedUser.email}`);
      this.prometheusService.recordUserRegistration(); // Record successful verification

      return {
        success: true,
        message: 'Email verified successfully! You are now logged in.',
        token,
        user: {
          id: verifiedUser.id,
          email: verifiedUser.email,
          username: verifiedUser.username,
          firstName: verifiedUser.firstName,
          lastName: verifiedUser.lastName,
          imageUrl: verifiedUser.imageUrl,
          role: verifiedUser.role,
          emailVerified: true,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      logger.error(`[ERROR] Code verification failed: ${error.message}`);
      throw new BadRequestException('Email verification failed. Please try again.');
    }
  }

  /**
   * Resend verification code (rate-limited to prevent spam)
   * - 1-minute cooldown between requests
   * - Resets failed attempt counter
   * - Generates new 6-digit code
   */
  async resendVerificationCode(dto: ResendVerificationCodeDto) {
    const logger = new Logger('AuthService.resendVerificationCode');
    logger.log(`[STARTUP] Resend code request for email: ${dto.email}`);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Don't reveal if user exists (security best practice)
      logger.warn(`[WARN] Resend request for non-existent email: ${dto.email}`);
      return {
        success: true,
        message: 'If an account exists with this email, a new verification code has been sent.',
        expiresIn: '10 minutes',
      };
    }

    // Check if already verified
    if (user.emailVerified) {
      logger.warn(`[WARN] Resend request for already verified email: ${dto.email}`);
      throw new BadRequestException('Email is already verified. You can log in now.');
    }

    // Rate limiting: Check if 1 minute has passed since last code was sent
    const timeSinceLastSent = user.emailVerificationCodeSentAt
      ? Date.now() - user.emailVerificationCodeSentAt.getTime()
      : Infinity;

    if (timeSinceLastSent < 60000) {
      // 60 seconds = 1 minute
      const waitSeconds = Math.ceil((60000 - timeSinceLastSent) / 1000);
      logger.warn(`[WARN] Rate limit hit for email: ${dto.email}, wait ${waitSeconds}s`);
      throw new BadRequestException(
        `Please wait ${waitSeconds} seconds before requesting a new code.`,
      );
    }

    // Generate new verification code
    const verificationCode = generateSixDigitCode();
    const codeExpiry = generateCodeExpiry(10); // 10 minutes

    logger.log(`[CONFIG] New verification code generated: ${verificationCode}`);

    // Update user with new code and reset attempts
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCode: verificationCode,
        emailVerificationCodeExpiry: codeExpiry,
        emailVerificationCodeUsed: false,
        emailVerificationAttempts: 0, // Reset failed attempts
        emailVerificationCodeSentAt: new Date(),
      },
    });

    // Send new verification code via email
    logger.log(`[CONFIG] Sending new verification code via email`);

    try {
      await this.emailService.sendVerificationCodeEmail(
        user.email,
        user.firstName || 'User',
        verificationCode,
        '10 minutes',
      );

      logger.log(`[SUCCESS] New verification code sent to: ${user.email}`);
    } catch (emailError) {
      logger.error(`[ERROR] Failed to send verification code: ${emailError.message}`);
      throw new InternalServerErrorException(
        'Failed to send verification code. Please try again later.',
      );
    }

    return {
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.',
      expiresIn: '10 minutes',
      email: user.email,
    };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(resendDto: ResendVerificationDto) {
    const logger = new Logger('AuthService.resendVerificationEmail');
    logger.log(`[STARTUP] Resend verification request for email: ${resendDto.email}`);

    const user = await this.prisma.user.findUnique({
      where: { email: resendDto.email },
    });

    if (!user) {
      // Don't reveal if user exists or not (security)
      logger.warn(`[WARN] Resend request for non-existent email: ${resendDto.email}`);
      return {
        success: true,
        message: 'If an account exists with this email, a verification code has been sent.',
        expiresIn: '10 minutes',
      };
    }

    if (user.emailVerified) {
      logger.warn(`[WARN] Resend request for already verified email: ${resendDto.email}`);
      throw new BadRequestException('Email is already verified. You can log in now.');
    }

    // Rate limiting: Check if 1 minute has passed since last code was sent
    const timeSinceLastSent = user.emailVerificationCodeSentAt
      ? Date.now() - user.emailVerificationCodeSentAt.getTime()
      : Infinity;

    if (timeSinceLastSent < 60000) {
      // 60 seconds = 1 minute
      const waitSeconds = Math.ceil((60000 - timeSinceLastSent) / 1000);
      logger.warn(`[WARN] Rate limit hit for email: ${resendDto.email}, wait ${waitSeconds}s`);
      throw new BadRequestException(
        `Please wait ${waitSeconds} seconds before requesting a new code.`,
      );
    }

    // Generate new 6-digit verification code (same as registration)
    const verificationCode = generateSixDigitCode();
    const codeExpiry = generateCodeExpiry(10); // 10 minutes

    logger.log(`[CONFIG] New 6-digit verification code generated: ${verificationCode}`);

    // Update user with new code and reset attempts
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCode: verificationCode,
        emailVerificationCodeExpiry: codeExpiry,
        emailVerificationCodeUsed: false,
        emailVerificationAttempts: 0, // Reset failed attempts
        emailVerificationCodeSentAt: new Date(),
      },
    });

    // Send verification code email (same as registration)
    logger.log(`[CONFIG] Sending 6-digit verification code via email`);

    try {
      await this.emailService.sendVerificationCodeEmail(
        user.email,
        user.firstName || 'User',
        verificationCode,
        '10 minutes',
      );

      logger.log(`[SUCCESS] 6-digit verification code sent to: ${user.email}`);
    } catch (emailError) {
      logger.error(`[ERROR] Failed to send verification code: ${emailError.message}`);
      throw new InternalServerErrorException(
        'Failed to send verification code. Please try again later.',
      );
    }

    return {
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.',
      expiresIn: '10 minutes',
      email: user.email,
      nextStep: 'Enter the code using POST /auth/verify-email-code',
    };
  }

  async resendVerification(email: string) {
    try {
      await this.clerkService.sendEmailVerification(email);
      return { success: true, message: 'Verification email resent' };
    } catch {
      throw new BadRequestException('Failed to resend verification email');
    }
  }

  /**
   * FORGOT PASSWORD - Send 6-digit reset code
   * ===========================================
   * Step 1 of password reset process
   */
  async forgotPassword(email: string) {
    const logger = new Logger('AuthService.forgotPassword');
    logger.log(`[STARTUP] Password reset request for email: ${email}`);

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists (security best practice)
      logger.warn(`[WARN] Password reset request for non-existent email: ${email}`);
      return {
        success: true,
        message: 'If an account exists with this email, a password reset code has been sent.',
        expiresIn: '10 minutes',
      };
    }

    // Rate limiting: Check if 1 minute has passed since last code was sent
    const timeSinceLastSent = user.passwordResetCodeSentAt
      ? Date.now() - user.passwordResetCodeSentAt.getTime()
      : Infinity;

    if (timeSinceLastSent < 60000) {
      // 60 seconds = 1 minute
      const waitSeconds = Math.ceil((60000 - timeSinceLastSent) / 1000);
      logger.warn(`[WARN] Rate limit hit for email: ${email}, wait ${waitSeconds}s`);
      throw new BadRequestException(
        `Please wait ${waitSeconds} seconds before requesting a new code.`,
      );
    }

    // Generate 6-digit reset code
    const resetCode = generateSixDigitCode();
    const codeExpiry = generateCodeExpiry(10); // 10 minutes

    logger.log(`[CONFIG] Password reset code generated: ${resetCode}`);

    // Update user with reset code and reset attempts
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetCode: resetCode,
        passwordResetCodeExpiry: codeExpiry,
        passwordResetCodeUsed: false,
        passwordResetAttempts: 0, // Reset failed attempts
        passwordResetCodeSentAt: new Date(),
      },
    });

    // Send password reset code via email
    logger.log(`[CONFIG] Sending password reset code via email`);

    try {
      await this.emailService.sendPasswordResetCodeEmail(
        user.email,
        user.firstName || 'User',
        resetCode,
        '10 minutes',
      );

      logger.log(`[SUCCESS] Password reset code sent to: ${user.email}`);
    } catch (emailError) {
      logger.error(`[ERROR] Failed to send password reset code: ${emailError.message}`);
      throw new InternalServerErrorException(
        'Failed to send password reset code. Please try again later.',
      );
    }

    return {
      success: true,
      message: 'A 6-digit password reset code has been sent to your email.',
      expiresIn: '10 minutes',
      email: user.email,
      nextStep:
        'Verify the code using POST /auth/verify-reset-code, then reset password with POST /auth/reset-password',
    };
  }

  /**
   * VERIFY RESET CODE
   * ==================
   * Step 2 of password reset process - Verify the 6-digit code
   */
  async verifyResetCode(dto: VerifyResetCodeDto) {
    const logger = new Logger('AuthService.verifyResetCode');
    logger.log(`[STARTUP] Verifying reset code for email: ${dto.email}`);

    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
        passwordResetCode: dto.code,
      },
    });

    if (!user) {
      logger.warn(`[WARN] Invalid reset code attempt for email: ${dto.email}`);

      // Increment failed attempts if user exists
      const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existingUser && existingUser.passwordResetCode) {
        const newAttempts = existingUser.passwordResetAttempts + 1;
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { passwordResetAttempts: newAttempts },
        });

        if (newAttempts >= 5) {
          logger.warn(`[WARN] Maximum reset attempts reached for email: ${dto.email}`);
          throw new BadRequestException(
            'Maximum verification attempts reached. Please request a new code.',
          );
        }
      }

      throw new BadRequestException('Invalid verification code.');
    }

    // Check if code has been used
    if (user.passwordResetCodeUsed) {
      logger.warn(`[WARN] Attempt to use already-used code for email: ${dto.email}`);
      throw new BadRequestException('This code has already been used. Please request a new one.');
    }

    // Check if code has expired
    if (!user.passwordResetCodeExpiry || isCodeExpired(user.passwordResetCodeExpiry)) {
      logger.warn(`[WARN] Expired reset code for email: ${dto.email}`);
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    // Check failed attempts
    if (user.passwordResetAttempts >= 5) {
      logger.warn(`[WARN] Too many failed attempts for email: ${dto.email}`);
      throw new BadRequestException('Too many failed attempts. Please request a new code.');
    }

    logger.log(`[SUCCESS] Reset code verified for email: ${dto.email}`);

    return {
      success: true,
      message: 'Code verified successfully. You can now reset your password.',
      email: user.email,
      nextStep: 'Reset your password using POST /auth/reset-password with the same code',
    };
  }

  /**
   * RESET PASSWORD WITH CODE
   * =========================
   * Step 3 of password reset process - Reset password with verified code
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const logger = new Logger('AuthService.resetPassword');
    logger.log(`[STARTUP] Password reset for email: ${resetPasswordDto.email}`);

    const user = await this.prisma.user.findUnique({
      where: {
        email: resetPasswordDto.email,
        passwordResetCode: resetPasswordDto.code,
      },
    });

    if (!user) {
      logger.warn(
        `[WARN] Invalid reset code during password reset for email: ${resetPasswordDto.email}`,
      );
      throw new BadRequestException('Invalid verification code.');
    }

    // Check if code has been used
    if (user.passwordResetCodeUsed) {
      logger.warn(
        `[WARN] Attempt to use already-used code for password reset: ${resetPasswordDto.email}`,
      );
      throw new BadRequestException('This code has already been used. Please request a new one.');
    }

    // Check if code has expired
    if (!user.passwordResetCodeExpiry || isCodeExpired(user.passwordResetCodeExpiry)) {
      logger.warn(`[WARN] Expired code during password reset for email: ${resetPasswordDto.email}`);
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    // Check failed attempts
    if (user.passwordResetAttempts >= 5) {
      logger.warn(
        `[WARN] Too many failed attempts during password reset: ${resetPasswordDto.email}`,
      );
      throw new BadRequestException('Too many failed attempts. Please request a new code.');
    }

    // Hash new password
    logger.log(`[CONFIG] Hashing new password`);
    const hashedPassword = await hashPassword(resetPasswordDto.newPassword);

    // Update user with new password and clear reset code
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetCode: null,
        passwordResetCodeExpiry: null,
        passwordResetCodeUsed: true,
        passwordResetAttempts: 0,
        passwordResetCodeSentAt: null,
      },
    });

    logger.log(`[SUCCESS] Password reset successfully for email: ${user.email}`);

    // Send confirmation email
    try {
      await this.emailService.sendPasswordResetSuccessEmail(
        user.email,
        user.firstName || 'User',
        new Date().toLocaleString(),
        'Unknown', // IP address
        'Unknown', // device
        `${process.env.FRONTEND_URL || 'http://localhost:3001'}/login`,
      );
    } catch (emailError) {
      logger.warn(`[WARN] Failed to send confirmation email: ${emailError.message}`);
      // Don't fail the reset if confirmation email fails
    }

    return {
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
      email: user.email,
    };
  }

  /**
   * RESEND PASSWORD RESET CODE
   * ===========================
   * Resend the 6-digit code if expired or not received
   */
  async resendPasswordResetCode(dto: ResendPasswordResetCodeDto) {
    const logger = new Logger('AuthService.resendPasswordResetCode');
    logger.log(`[STARTUP] Resend reset code request for email: ${dto.email}`);

    // Reuse the forgotPassword method logic
    return this.forgotPassword(dto.email);
  }

  async initiateOAuth(provider: string, redirectUrl?: string) {
    try {
      const authUrl = await this.clerkService.initiateOAuth(provider, redirectUrl);
      return { authUrl };
    } catch {
      throw new BadRequestException(`Failed to initiate ${provider} OAuth`);
    }
  }

  async handleOAuthCallback(callbackDto: OAuthCallbackDto) {
    try {
      const result = await this.clerkService.handleOAuthCallback(
        callbackDto.provider,
        callbackDto.code,
      );
      return result;
    } catch {
      throw new UnauthorizedException('OAuth authentication failed');
    }
  }

  // ==================== GOOGLE & FACEBOOK SSO METHODS ====================

  /**
   * Login with Google ID Token
   * Validates token, finds or creates user, generates JWT tokens
   *
   * @param dto - Google login DTO containing ID token
   * @returns JWT tokens and user data
   */
  async loginWithGoogle(dto: { idToken: string; deviceInfo?: any }) {
    return this.tracer.startActiveSpan('AuthService.loginWithGoogle', async span => {
      const startTime = Date.now();
      this.logger.log('🔐 Google login initiated');

      try {
        // 1. Validate Google ID token with OAuth service
        const oauthUser = await this.oauthService.validateGoogleToken(dto.idToken);

        span.setAttribute('oauth.provider', 'google');
        span.setAttribute('user.email', oauthUser.email);
        this.logger.log(`Google token validated for user: ${oauthUser.email}`);

        // 2. Find or create user in database
        const { user, isNewUser } = await this.findOrCreateOAuthUser(oauthUser);
        span.setAttribute('user.id', user.id);
        span.setAttribute('user.isNew', isNewUser);

        // 3. Generate JWT tokens (same pattern as login method)
        const accessToken = this.jwtService.sign({
          sub: user.id,
          email: user.email,
          role: user.role,
        });

        const refreshToken = this.jwtService.sign(
          {
            sub: user.id,
            email: user.email,
            role: user.role,
          },
          { expiresIn: '30d' },
        );

        // 4. Record metrics
        if (isNewUser) {
          this.prometheusService.recordUserRegistration();
        }

        span.addEvent('Google login successful');
        span.setStatus({ code: SpanStatusCode.OK });
        this.logger.log(`✅ Google login successful for user: ${user.id}`);

        return {
          success: true,
          message: 'Google authentication successful',
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
            role: user.role,
            oauthProvider: user.oauthProvider,
          },
          isNewUser,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        this.logger.error(
          `❌ Google login failed: ${errorMessage}`,
          error instanceof Error ? error.stack : '',
        );

        if (error instanceof UnauthorizedException) {
          throw error;
        }

        throw new InternalServerErrorException('Google login failed. Please try again.');
      } finally {
        span.end();
      }
    });
  }

  /**
   * Login with Facebook Access Token
   * Validates token, finds or creates user, generates JWT tokens
   *
   * @param dto - Facebook login DTO containing access token
   * @returns JWT tokens and user data
   */
  async loginWithFacebook(dto: { accessToken: string; deviceInfo?: any }) {
    return this.tracer.startActiveSpan('AuthService.loginWithFacebook', async span => {
      const startTime = Date.now();
      this.logger.log('🔐 Facebook login initiated');

      try {
        // 1. Validate Facebook access token with OAuth service
        const oauthUser = await this.oauthService.validateFacebookToken(dto.accessToken);

        span.setAttribute('oauth.provider', 'facebook');
        span.setAttribute('user.email', oauthUser.email);
        this.logger.log(`Facebook token validated for user: ${oauthUser.email}`);

        // 2. Find or create user in database
        const { user, isNewUser } = await this.findOrCreateOAuthUser(oauthUser);
        span.setAttribute('user.id', user.id);
        span.setAttribute('user.isNew', isNewUser);

        // 3. Generate JWT tokens (same pattern as login method)
        const accessToken = this.jwtService.sign({
          sub: user.id,
          email: user.email,
          role: user.role,
        });

        const refreshToken = this.jwtService.sign(
          {
            sub: user.id,
            email: user.email,
            role: user.role,
          },
          { expiresIn: '30d' },
        );

        // 4. Record metrics
        if (isNewUser) {
          this.prometheusService.recordUserRegistration();
        }

        span.addEvent('Facebook login successful');
        span.setStatus({ code: SpanStatusCode.OK });
        this.logger.log(`✅ Facebook login successful for user: ${user.id}`);

        return {
          success: true,
          message: 'Facebook authentication successful',
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
            role: user.role,
            oauthProvider: user.oauthProvider,
          },
          isNewUser,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        this.logger.error(
          `❌ Facebook login failed: ${errorMessage}`,
          error instanceof Error ? error.stack : '',
        );

        if (error instanceof UnauthorizedException) {
          throw error;
        }

        throw new InternalServerErrorException('Facebook login failed. Please try again.');
      } finally {
        span.end();
      }
    });
  }

  /**
   * Firebase Sync - Exchange Firebase ID token for backend JWT
   * Used when frontend handles Google OAuth through Firebase SDK
   *
   * @param dto - Firebase sync DTO containing ID token
   * @param res - Express response object for setting cookies
   * @returns JWT tokens and user data
   */
  async firebaseSync(dto: { idToken: string; deviceInfo?: any }, res?: Response) {
    return this.tracer.startActiveSpan('AuthService.firebaseSync', async span => {
      this.logger.log('🔥 Firebase sync initiated');

      try {
        // 1. Verify Firebase ID token
        let decodedToken: admin.auth.DecodedIdToken;
        try {
          this.logger.debug(`Verifying Firebase token: ${dto.idToken.substring(0, 50)}...`);
          // Verify token and check if the user is disabled/revoked
          decodedToken = await admin.auth().verifyIdToken(dto.idToken, true);
          this.logger.debug('Firebase token verified successfully.');
        } catch (error) {
          this.logger.error('Firebase token verification failed:', error);
          if (error.code) {
            this.logger.error(`Firebase Error Code: ${error.code}`);
            this.logger.error(`Firebase Error Message: ${error.message}`);
          }
          throw new UnauthorizedException('Invalid or expired Firebase ID token');
        }

        span.setAttribute('firebase.uid', decodedToken.uid);
        span.setAttribute('user.email', decodedToken.email || '');
        this.logger.log(`Firebase token verified for user: ${decodedToken.email}`);

        // 2. Extract user information from Firebase token
        const firebaseUser: OAuthUserData = {
          provider: 'firebase',
          id: decodedToken.uid,
          email: decodedToken.email || '',
          firstName: decodedToken.name?.split(' ')[0] || '',
          lastName: decodedToken.name?.split(' ').slice(1).join(' ') || '',
          imageUrl: decodedToken.picture || '',
          emailVerified: decodedToken.email_verified || false,
        };

        // 3. Find or create user in database
        const { user, isNewUser } = await this.findOrCreateOAuthUser(firebaseUser);
        span.setAttribute('user.id', user.id);
        span.setAttribute('user.isNew', isNewUser);

        // 4. Generate JWT tokens
        const accessToken = this.jwtService.sign({
          sub: user.id,
          email: user.email,
          role: user.role,
        });

        const refreshToken = this.jwtService.sign(
          {
            sub: user.id,
            email: user.email,
            role: user.role,
          },
          { expiresIn: '30d' },
        );

        // 5. Set HTTP-only cookie for web applications
        if (res) {
          // Use 'none' for cross-domain (api.mashmarket.app -> mashmarket.app)
          // 'none' requires secure: true
          const isProduction = process.env.NODE_ENV === 'production';
          res.cookie('auth-token', accessToken, {
            httpOnly: true,
            secure: isProduction, // Required for sameSite: 'none'
            sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-domain in production
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            domain: isProduction ? '.mashmarket.app' : undefined, // Share across subdomains
          });
          this.logger.log('Auth cookie set successfully');
        }

        // 6. Record metrics
        if (isNewUser) {
          this.prometheusService.recordUserRegistration();
        }

        span.addEvent('Firebase sync successful');
        span.setStatus({ code: SpanStatusCode.OK });
        this.logger.log(`✅ Firebase sync successful for user: ${user.id}`);

        return {
          success: true,
          message: 'Firebase authentication synchronized',
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
            role: user.role,
            emailVerified: user.emailVerified,
            oauthProvider: user.oauthProvider,
          },
          isNewUser,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        this.logger.error(
          `❌ Firebase sync failed: ${errorMessage}`,
          error instanceof Error ? error.stack : '',
        );

        if (error instanceof UnauthorizedException) {
          throw error;
        }

        throw new InternalServerErrorException('Firebase sync failed. Please try again.');
      } finally {
        span.end();
      }
    });
  }

  /**
   * Find existing user or create new user from OAuth data
   * Handles email conflicts and account linking logic
   *
   * @param oauthUser - Normalized OAuth user data
   * @returns User and isNewUser flag
   */
  private async findOrCreateOAuthUser(oauthUser: OAuthUserData) {
    const {
      provider,
      id: providerId,
      email,
      firstName,
      lastName,
      imageUrl,
      emailVerified,
    } = oauthUser;

    // 1. Check if user exists with this OAuth provider ID
    let whereCondition = {};
    if (provider === 'google') whereCondition = { googleId: providerId };
    else if (provider === 'facebook') whereCondition = { facebookId: providerId };
    else if (provider === 'firebase') whereCondition = { firebaseUid: providerId };

    const existingByProviderId = await this.prisma.user.findFirst({
      where: whereCondition,
    });

    if (existingByProviderId) {
      // User already registered with this OAuth provider
      return { user: existingByProviderId, isNewUser: false };
    }

    // 2. Check if user exists with this email
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingByEmail) {
      // Email already exists - link OAuth account to existing user
      this.logger.log(`Linking ${provider} account to existing user: ${existingByEmail.id}`);

      const updatedUser = await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          ...(provider === 'google'
            ? { googleId: providerId }
            : provider === 'facebook'
              ? { facebookId: providerId }
              : { firebaseUid: providerId }),
          oauthProvider: {
            set: [...new Set([...(existingByEmail.oauthProvider || []), provider])],
          },
          imageUrl: imageUrl || existingByEmail.imageUrl,
          emailVerified: emailVerified || existingByEmail.emailVerified,
        },
      });

      return { user: updatedUser, isNewUser: false };
    }

    // 3. Create new user from OAuth data
    this.logger.log(`Creating new user from ${provider} OAuth data`);

    // Generate unique username from email
    const baseUsername = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    let username = baseUsername;
    let counter = 1;

    // Ensure username is unique
    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    const newUser = await this.prisma.user.create({
      data: {
        email,
        username,
        firstName,
        lastName,
        imageUrl,
        ...(provider === 'google'
          ? { googleId: providerId }
          : provider === 'facebook'
            ? { facebookId: providerId }
            : { firebaseUid: providerId }),
        oauthProvider: [provider],
        emailVerified: emailVerified,
        role: 'USER',
        isActive: true,
        password: null, // OAuth users don't have password initially
      },
    });

    this.logger.log(`✅ New user created via ${provider}: ${newUser.id}`);

    return { user: newUser, isNewUser: true };
  }

  /**
   * Link Google account to existing authenticated user
   *
   * @param userId - Current user ID
   * @param idToken - Google ID token
   */
  async linkGoogleAccount(userId: string, idToken: string) {
    try {
      // 1. Validate Google token
      const oauthUser = await this.oauthService.validateGoogleToken(idToken);

      // 2. Get current user
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 3. Check if this Google account is already linked to another user
      const existingGoogleUser = await this.prisma.user.findFirst({
        where: { googleId: oauthUser.id, NOT: { id: userId } },
      });

      if (existingGoogleUser) {
        throw new ConflictException('This Google account is already linked to another user');
      }

      // 4. Link Google account
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          googleId: oauthUser.id,
          oauthProvider: {
            set: [...new Set([...(user.oauthProvider || []), 'google'])],
          },
        },
      });

      this.logger.log(`✅ Google account linked to user: ${userId}`);

      return {
        success: true,
        message: 'Google account linked successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          oauthProvider: updatedUser.oauthProvider,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Failed to link Google account: ${error.message}`);
      throw error;
    }
  }

  /**
   * Link Facebook account to existing authenticated user
   *
   * @param userId - Current user ID
   * @param accessToken - Facebook access token
   */
  async linkFacebookAccount(userId: string, accessToken: string) {
    try {
      // 1. Validate Facebook token
      const oauthUser = await this.oauthService.validateFacebookToken(accessToken);

      // 2. Get current user
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 3. Check if this Facebook account is already linked to another user
      const existingFacebookUser = await this.prisma.user.findFirst({
        where: { facebookId: oauthUser.id, NOT: { id: userId } },
      });

      if (existingFacebookUser) {
        throw new ConflictException('This Facebook account is already linked to another user');
      }

      // 4. Link Facebook account
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          facebookId: oauthUser.id,
          oauthProvider: {
            set: [...new Set([...(user.oauthProvider || []), 'facebook'])],
          },
        },
      });

      this.logger.log(`✅ Facebook account linked to user: ${userId}`);

      return {
        success: true,
        message: 'Facebook account linked successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          oauthProvider: updatedUser.oauthProvider,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Failed to link Facebook account: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unlink social account from user
   * Requires user to have password or another OAuth provider
   *
   * @param userId - Current user ID
   * @param provider - Provider to unlink ('google' | 'facebook')
   */
  async unlinkSocialAccount(userId: string, provider: 'google' | 'facebook') {
    try {
      // 1. Get current user
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 2. Check if this provider is linked
      if (!user.oauthProvider?.includes(provider)) {
        throw new NotFoundException(`${provider} account is not linked`);
      }

      // 3. Ensure user has alternative authentication method
      const otherProviders = user.oauthProvider.filter(p => p !== provider);
      if (!user.password && otherProviders.length === 0) {
        throw new BadRequestException(
          'Cannot unlink last authentication method. Please set a password first.',
        );
      }

      // 4. Unlink provider
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(provider === 'google' ? { googleId: null } : { facebookId: null }),
          oauthProvider: {
            set: otherProviders,
          },
        },
      });

      this.logger.log(`✅ ${provider} account unlinked from user: ${userId}`);

      return {
        success: true,
        message: `${provider} account unlinked successfully`,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          oauthProvider: updatedUser.oauthProvider,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Failed to unlink ${provider} account: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get OAuth status for current user
   * Returns linked providers and authentication options
   *
   * @param userId - Current user ID
   */
  async getOAuthStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        oauthProvider: true,
        googleId: true,
        facebookId: true,
        password: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hasPassword = !!user.password;
    const linkedProviders = user.oauthProvider || [];
    const canUnlink = hasPassword || linkedProviders.length > 1;

    return {
      success: true,
      linkedProviders,
      hasPassword,
      canUnlink,
      details: {
        ...(user.googleId && {
          google: {
            linkedAt: user.updatedAt,
            email: user.email,
            googleId: user.googleId,
          },
        }),
        ...(user.facebookId && {
          facebook: {
            linkedAt: user.updatedAt,
            email: user.email,
            facebookId: user.facebookId,
          },
        }),
      },
    };
  }
}
