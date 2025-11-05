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
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { Cacheable } from '../../common/decorators/cache.decorator';
import { CacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { ClerkService } from './services/clerk.service';
import { EmailService } from '../notifications/services/email.service';
import { ClerkWebhookDto } from './dto/clerk-webhook.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResetPasswordDto } from './dto/password-reset.dto';
import { OAuthCallbackDto } from './dto/oauth.dto';
import { TokenResponse } from './interfaces/jwt-payload.interface';
import { hashPassword, comparePassword } from '../../common/helpers/bcrypt.helper';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { PrometheusService } from '../../monitoring/prometheus/prometheus.service';
import * as crypto from 'crypto';

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
    private readonly configService: ConfigService,
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
   * Register a new user
   */
  async register(registerDto: RegisterDto) {
    this.logger.log(`📝 New registration request for email: ${registerDto.email}`);
    
    try {
      const hashedPassword = await hashPassword(registerDto.password);
      
      this.logger.log(`🔐 Password hashed successfully for ${registerDto.email}`);
      
      // Register user in Clerk
      this.logger.log(`🔄 Registering user with Clerk...`);
      const clerkUser = await this.clerkService.registerUser({
        email: registerDto.email,
        password: registerDto.password,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        username: registerDto.username,
      });
      
      this.logger.log(`✅ Clerk user created: ${clerkUser.id}`);

      // Generate DiceBear avatar URL based on username or email
      // Uses bottts-neutral style for consistent, professional avatars
      const avatarSeed = registerDto.username || registerDto.email.split('@')[0];
      const diceBearAvatarUrl = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(avatarSeed)}`;

      this.logger.log(`🎨 Generated avatar URL: ${diceBearAvatarUrl}`);

      // Create user in local database with generated avatar
      this.logger.log(`💾 Creating user in local database...`);
      await this.prisma.user.create({
        data: {
          clerkId: clerkUser.id,
          email: registerDto.email,
          username: registerDto.username || null,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          password: hashedPassword,
          imageUrl: diceBearAvatarUrl, // Use DiceBear avatar instead of Clerk's
          role: 'USER', // Default role
        },
      });

      this.logger.log(`✅ User created in database for ${registerDto.email}`);

      this.prometheusService.recordUserRegistration();

      // Send Clerk verification email (primary verification)
      this.logger.log(`📧 Sending Clerk verification email...`);
      await this.clerkService.sendEmailVerification(registerDto.email);
      this.logger.log(`✅ Clerk verification email sent`);

      // Send MASH-branded verification email (non-blocking)
      // This provides a better user experience with our custom branding
      try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const verificationLink = `${frontendUrl}/verify-email?email=${encodeURIComponent(registerDto.email)}`;
        
        this.logger.log(`📤 Sending MASH-branded verification email to: ${registerDto.email}`);
        this.logger.log(`🔗 Verification link: ${verificationLink}`);
        
        await this.emailService.sendVerificationEmail(
          registerDto.email,
          registerDto.firstName,
          verificationLink,
          '24 hours',
        );
        
        this.logger.log(`✅ MASH verification email sent successfully to: ${registerDto.email}`);
      } catch (emailError: unknown) {
        // Don't fail registration if custom email fails
        this.logger.error(
          `❌ CRITICAL: Failed to send MASH verification email to ${registerDto.email}`,
        );
        const errorMessage = emailError instanceof Error ? emailError.message : 'Unknown error';
        this.logger.error(`Error details: ${errorMessage}`);
        if (emailError instanceof Error && emailError.stack) {
          this.logger.error(`Error stack: ${emailError.stack}`);
        }
        if (
          errorMessage.includes('Missing credentials') ||
          errorMessage.includes('Invalid login')
        ) {
          this.logger.error('🔧 FIX: Add EMAIL_* environment variables to Railway dashboard');
          this.logger.error(
            '📋 Required: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM',
          );
        }
      }

      this.logger.log(`🎉 Registration completed successfully for: ${registerDto.email}`);

      return {
        success: true,
        message: 'User registered successfully. Please verify your email.',
        userId: clerkUser.id,
        email: registerDto.email,
        username: registerDto.username || null,
        avatarUrl: diceBearAvatarUrl, // DiceBear avatar URL
        verificationSent: true,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Registration failed for ${registerDto.email}: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        this.logger.error(`Error stack: ${error.stack}`);
      }
      if (errorMessage.includes('already exists')) {
        throw new ConflictException('User with this email already exists');
      }
      throw new InternalServerErrorException('Registration failed. Please try again.');
    }
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    try {
      await this.clerkService.verifyEmail(verifyEmailDto.email, verifyEmailDto.code);
      return { success: true, message: 'Email verified successfully' };
    } catch {
      throw new BadRequestException('Invalid or expired verification code');
    }
  }

  async resendVerification(email: string) {
    try {
      await this.clerkService.sendEmailVerification(email);
      return { success: true, message: 'Verification email sent' };
    } catch {
      throw new BadRequestException('Failed to send verification email');
    }
  }

  async forgotPassword(email: string) {
    this.logger.log(`🔐 Password reset requested for email: ${email}`);
    
    try {
      // First, check if user exists in database
      this.logger.log(`🔍 Looking up user in database...`);
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      // Always return success for security (don't reveal if email exists)
      if (!user) {
        this.logger.warn(`⚠️ Password reset requested for non-existent email: ${email}`);
        return {
          success: true,
          message: 'If the email exists, a password reset link has been sent',
        };
      }

      this.logger.log(`✅ User found: ${user.id} (${user.firstName} ${user.lastName})`);

      // Generate reset token (valid for 1 hour)
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      this.logger.log(`🎫 Generated reset token: ${resetToken.substring(0, 10)}...`);

      // Store reset token in database
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry,
        },
      });

      this.logger.log(`💾 Reset token stored in database`);

      // Get backend URL from config
      const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';
      
      // Generate reset link
      const resetLink = `${backendUrl}/reset-password?token=${resetToken}`;

      this.logger.log(`🔗 Reset link: ${resetLink}`);
      this.logger.log(`📧 Attempting to send password reset email to: ${user.email}`);

      // Send password reset email
      await this.emailService.sendForgotPasswordEmail(
        user.email,
        user.firstName || 'User',
        resetLink,
        '1 hour',
      );

      this.logger.log(`✅ Password reset email sent successfully to: ${email}`);
      
      return {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      };
    } catch (error) {
      this.logger.error(`❌ Failed to send password reset email for ${email}:`, error);
      this.logger.error(`Error details: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      // Still return success for security (don't reveal errors)
      return {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      };
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
