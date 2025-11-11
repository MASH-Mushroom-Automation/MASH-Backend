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
import { ClerkWebhookDto } from './dto/clerk-webhook.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto, ResendVerificationDto, VerifyEmailCodeDto, ResendVerificationCodeDto } from './dto/verify-email.dto';
import { ResetPasswordDto } from './dto/password-reset.dto';
import { OAuthCallbackDto } from './dto/oauth.dto';
import { TokenResponse } from './interfaces/jwt-payload.interface';
import { hashPassword, comparePassword } from '../../common/helpers/bcrypt.helper';
import { generateVerificationToken, generateTokenExpiry, isTokenExpired, generateSixDigitCode, generateCodeExpiry, isCodeExpired } from '../../common/helpers/token.helper';
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
    const user = await this.prisma.user.create({
      data: {
        clerkId: userData.id,
        email: userData.email_addresses[0]?.email_address ?? '',
        username: userData.username ?? null,
        firstName: userData.first_name ?? null,
        lastName: userData.last_name ?? null,
        imageUrl: userData.image_url ?? null,
      },
    });

    return { message: 'User created successfully', userId: user.id };
  }

  private async updateUser(userData: ClerkUserData) {
    const user = await this.prisma.user.update({
      where: { clerkId: userData.id },
      data: {
        email: userData.email_addresses[0]?.email_address ?? undefined,
        username: userData.username ?? undefined,
        firstName: userData.first_name ?? undefined,
        lastName: userData.last_name ?? undefined,
        imageUrl: userData.image_url ?? undefined,
      },
    });

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
                'Please verify your email address before logging in. Check your inbox for the verification link.'
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
            'Please verify your email address before logging in. Check your inbox for the verification link.'
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
      } catch (clerkError: unknown) {
        // Clerk is optional - log warning but continue with local registration
        logger.warn('[WARN] Clerk user creation failed, using local auth only');
        const errorMessage = clerkError instanceof Error ? clerkError.message : 'Unknown error';
        logger.warn(`[WARN] Clerk error: ${errorMessage}`);
        // Continue with registration using local clerkId
      }

      // Step 6: Generate DiceBear avatar URL
      const avatarSeed = registerDto.username || registerDto.email.split('@')[0];
      const diceBearAvatarUrl = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(avatarSeed)}`;

      // Step 7: Create user in database
      logger.log('[CONFIG] Creating user in database');
      const user = await this.prisma.user.create({
        data: {
          clerkId: clerkId,
          email: registerDto.email,
          username: registerDto.username || null,
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

      logger.log(`[SUCCESS] User created in database: ${user.id}`);
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
      logger.log('[CONFIG] Sending 6-digit verification code via Gmail SMTP');

      try {
        await this.emailService.sendVerificationCodeEmail(
          registerDto.email,
          registerDto.firstName,
          verificationCode,
          '10 minutes',
        );
        logger.log('[SUCCESS] Verification code email sent successfully');
      } catch (emailError: unknown) {
        logger.error('[ERROR] Failed to send verification code email');
        const errorMessage = emailError instanceof Error ? emailError.message : 'Unknown error';
        logger.error(`[ERROR] Email error: ${errorMessage}`);

        // Rollback user creation if email fails (user won't be able to verify)
        await this.prisma.user.delete({ where: { id: user.id } });
        logger.error('[ERROR] User creation rolled back due to email failure');

        throw new InternalServerErrorException(
          'Failed to send verification email. Please try again later.',
        );
      }

      // Step 10: Return success response
      logger.log('[SUCCESS] Registration process completed');
      return {
        success: true,
        message: 'Registration successful! A 6-digit verification code has been sent to your email.',
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
        throw new BadRequestException('Invalid verification code. Please check your email and try again.');
      }

      // Check if code already used
      if (user.emailVerificationCodeUsed) {
        logger.warn(`[WARN] Code already used for email: ${dto.email}`);
        throw new BadRequestException('This verification code has already been used. Please request a new code.');
      }

      // Check if code expired
      if (isCodeExpired(user.emailVerificationCodeExpiry)) {
        logger.warn(`[WARN] Verification code expired for email: ${dto.email}`);
        throw new BadRequestException('Verification code has expired. Please request a new code.');
      }

      // Check failed attempts (max 5)
      if (user.emailVerificationAttempts >= 5) {
        logger.warn(`[WARN] Too many verification attempts for email: ${dto.email}`);
        throw new BadRequestException('Too many failed verification attempts. Please request a new code.');
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

    if (timeSinceLastSent < 60000) { // 60 seconds = 1 minute
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
      throw new InternalServerErrorException('Failed to send verification code. Please try again later.');
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
    const user = await this.prisma.user.findUnique({
      where: { email: resendDto.email },
    });

    if (!user) {
      // Don't reveal if user exists or not (security)
      return {
        success: true,
        message: 'If an account exists with this email, a verification email has been sent.',
      };
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new token
    const verificationToken = generateVerificationToken();
    const verificationExpiry = generateTokenExpiry(24);

    // Update user with new token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
      },
    });

    // Send new verification email
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    await this.emailService.sendVerificationEmail(
      user.email,
      user.firstName,
      verificationLink,
      '24 hours',
    );

    this.logger.log(`✅ Verification email resent to: ${resendDto.email}`);

    return {
      success: true,
      message: 'Verification email sent. Please check your inbox.',
      email: user.email,
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

  async forgotPassword(email: string) {
    try {
      await this.clerkService.sendPasswordResetEmail(email);
      return { success: true, message: 'Password reset email sent' };
    } catch {
      throw new BadRequestException('Failed to send password reset email');
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    try {
      await this.clerkService.resetPassword(
        resetPasswordDto.email,
        resetPasswordDto.code,
        resetPasswordDto.newPassword,
      );
      return { success: true, message: 'Password reset successfully' };
    } catch {
      throw new BadRequestException('Invalid or expired reset code');
    }
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
}
