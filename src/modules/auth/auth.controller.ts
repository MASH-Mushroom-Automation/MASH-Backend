import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { ClerkWebhookDto } from './dto/clerk-webhook.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto, ResendVerificationDto } from './dto/verify-email.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { OAuthCallbackDto, OAuthInitiateDto } from './dto/oauth.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { AuditAction } from '../../common/services/audit-log.service';
import { Public } from './decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ==================== AUTHENTICATION FLOW ====================

  @Post('register')
  @Public()
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @HttpCode(HttpStatus.CREATED)
  @AuditLog({
    action: AuditAction.USER_CREATE,
    entity: 'User',
    getEntityId: (args) => args[0]?.email,
  })
  @ApiOperation({
    summary: 'Register new user',
    description:
      'Create a new user account with email, password, and profile information. Automatically generates a DiceBear avatar. Sends email verification code.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully. Verification email sent.',
    schema: {
      example: {
        success: true,
        message: 'User registered successfully. Please verify your email.',
        userId: 'user_2abc123xyz',
        email: 'john.doe@example.com',
        username: 'johndoe',
        avatarUrl:
          'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=johndoe',
        verificationSent: true,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or user already exists',
  })
  @ApiResponse({ status: 429, description: 'Too many registration attempts' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login user with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful, returns tokens and user',
    schema: {
      example: {
        success: true,
        message: 'Authentication successful',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'user_abc123',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email);
  }

  @Post('verify-email')
  @Public()
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email with code',
    description:
      'Verify user email address using the 6-digit code sent to their email',
  })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      example: {
        success: true,
        message: 'Email verified successfully',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'user_2abc123xyz',
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid verification code' })
  @ApiResponse({ status: 429, description: 'Too many verification attempts' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-verification')
  @Public()
  @Throttle({ short: { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend verification email',
    description: 'Resend verification code to user email',
  })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent successfully',
    schema: {
      example: {
        success: true,
        message: 'Verification email sent successfully',
        email: 'john.doe@example.com',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'User not found or already verified',
  })
  @ApiResponse({ status: 429, description: 'Too many resend attempts' })
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    return this.authService.resendVerification(resendDto.email);
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ short: { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Send password reset code to user email. Does not reveal if email exists.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent if user exists',
    schema: {
      example: {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      },
    },
  })
  @ApiResponse({ status: 429, description: 'Too many reset requests' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ short: { limit: 5, ttl: 300000 } }) // 5 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with code',
    description: 'Reset user password using the code sent to their email',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    schema: {
      example: {
        success: true,
        message: 'Password reset successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid reset code or user not found',
  })
  @ApiResponse({ status: 429, description: 'Too many reset attempts' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  // ==================== OAUTH FLOW ====================

  @Get('oauth/google')
  @Public()
  @ApiOperation({
    summary: 'Initiate Google OAuth flow',
    description:
      'Get Google OAuth authorization URL. Redirect user to this URL to start OAuth flow.',
  })
  @ApiResponse({
    status: 200,
    description: 'OAuth URL generated successfully',
    schema: {
      example: {
        url: 'https://accounts.clerk.dev/sign-in?redirect_url=...',
        provider: 'google',
        state: 'abc123xyz...',
      },
    },
  })
  async initiateGoogleOAuth(@Query() query: OAuthInitiateDto) {
    return this.authService.initiateOAuth('google', query.redirectUrl);
  }

  @Get('oauth/github')
  @Public()
  @ApiOperation({
    summary: 'Initiate GitHub OAuth flow',
    description:
      'Get GitHub OAuth authorization URL. Redirect user to this URL to start OAuth flow.',
  })
  @ApiResponse({
    status: 200,
    description: 'OAuth URL generated successfully',
    schema: {
      example: {
        url: 'https://accounts.clerk.dev/sign-in?redirect_url=...',
        provider: 'github',
        state: 'def456xyz...',
      },
    },
  })
  async initiateGitHubOAuth(@Query() query: OAuthInitiateDto) {
    return this.authService.initiateOAuth('github', query.redirectUrl);
  }

  @Get('oauth/facebook')
  @Public()
  @ApiOperation({
    summary: 'Initiate Facebook OAuth flow',
    description:
      'Get Facebook OAuth authorization URL. Redirect user to this URL to start OAuth flow.',
  })
  @ApiResponse({
    status: 200,
    description: 'OAuth URL generated successfully',
    schema: {
      example: {
        url: 'https://accounts.clerk.dev/sign-in?redirect_url=...',
        provider: 'facebook',
        state: 'ghi789xyz...',
      },
    },
  })
  async initiateFacebookOAuth(@Query() query: OAuthInitiateDto) {
    return this.authService.initiateOAuth('facebook', query.redirectUrl);
  }

  @Post('oauth/callback')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle OAuth callback',
    description:
      'Process OAuth callback with authorization code. Called by OAuth provider.',
  })
  @ApiBody({ type: OAuthCallbackDto })
  @ApiResponse({
    status: 200,
    description: 'OAuth authentication successful',
    schema: {
      example: {
        success: true,
        message: 'OAuth authentication successful',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'user_2abc123xyz',
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'OAuth authentication failed' })
  async handleOAuthCallback(@Body() callbackDto: OAuthCallbackDto) {
    return this.authService.handleOAuthCallback(callbackDto);
  }

  // ==================== EXISTING ENDPOINTS ====================

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @AuditLog({
    action: AuditAction.USER_CREATE,
    entity: 'User',
    getEntityId: (args) => args[0]?.data?.id,
  })
  @ApiOperation({
    summary: 'Clerk webhook handler',
    description: 'Handles user synchronization events from Clerk',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  async handleClerkWebhook(@Body() payload: ClerkWebhookDto) {
    return this.authService.handleClerkWebhook(payload);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns the currently authenticated user information',
  })
  @ApiResponse({ status: 200, description: 'Current user information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@Request() req: any) {
    return this.authService.getCurrentUser(req.user.userId);
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get session information',
    description: 'Returns current session details and permissions',
  })
  @ApiResponse({ status: 200, description: 'Session information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSession(@Request() req: any) {
    return this.authService.getSessionInfo(req.user);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @AuditLog({
    action: AuditAction.LOGOUT,
    entity: 'User',
    getEntityId: (args) => args[0]?.user?.userId as string,
  })
  @ApiOperation({
    summary: 'Logout user',
    description: 'Invalidates the current user session',
  })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Request() req: any) {
    return this.authService.logout(req.user.userId);
  }

  // 3. Refresh Token
  @Post('refresh')
  @Throttle({ short: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
  @HttpCode(HttpStatus.OK)
  @AuditLog({
    action: AuditAction.TOKEN_REFRESH,
    entity: 'Auth',
  })
  @ApiOperation({ summary: 'Refresh JWT access token using refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'New access token generated successfully',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 86400,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired refresh token' })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  // 6. Verify Token
  @Post('verify')
  @Throttle({ short: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify if a JWT token is valid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    schema: {
      example: {
        valid: true,
        userId: 'cuid123...',
        email: 'user@example.com',
        role: 'USER',
        expiresAt: '2025-10-04T21:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async verifyToken(@Body() body: { token: string }) {
    if (!body.token) {
      throw new BadRequestException('Token is required');
    }
    return this.authService.verifyToken(body.token);
  }

  // 7. Get User Permissions
  @Get('permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user permissions based on role (RBAC)' })
  @ApiResponse({
    status: 200,
    description: 'User permissions returned',
    schema: {
      example: {
        userId: 'cuid123...',
        role: 'GROWER',
        permissions: [
          'read:profile',
          'update:profile',
          'manage:devices',
          'view:sensors',
          'create:orders',
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserPermissions(@Request() req: any) {
    return this.authService.getUserPermissions(req.user.id);
  }

  // 8. Admin Impersonate User
  @Post('impersonate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin can impersonate another user (Admin/Super Admin only)',
    description:
      'Generates a JWT token for the target user, allowing admin to access the system as that user',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        targetUserId: {
          type: 'string',
          example: 'cuid456...',
          description: 'User ID to impersonate',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Impersonation token generated successfully',
    schema: {
      example: {
        impersonationToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        targetUser: {
          id: 'cuid456...',
          email: 'target@example.com',
          role: 'USER',
        },
        adminId: 'cuid123...',
        expiresIn: 3600,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Not an admin' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Target user not found' })
  async impersonateUser(
    @Request() req: any,
    @Body() body: { targetUserId: string },
  ) {
    if (!body.targetUserId) {
      throw new BadRequestException('targetUserId is required');
    }
    return this.authService.impersonateUser(req.user.id, body.targetUserId);
  }
}
