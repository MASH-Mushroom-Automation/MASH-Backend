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
  ApiHeader,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
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

// Interface for authenticated request
interface AuthenticatedRequest {
  user: {
    id: string;
    userId: string;
    clerkId: string;
    email: string;
    role: string;
    sessionId: string;
    expiresAt: Date;
  };
}

@ApiTags('🔐 Authentication & Authorization')
@ApiExtraModels(RegisterDto, LoginDto, VerifyEmailDto, ResendVerificationDto, RefreshTokenDto)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ==================== COMPLETE AUTHENTICATION FLOW ====================
  // Step 1: Registration → Step 2: Email Verification → Step 3: Login → Step 4: Access Resources

  /**
   * 📝 STEP 1: USER REGISTRATION
   * ============================
   * Creates a new user account with email verification.
   * 
   * Process:
   * 1. Validates user input (email, password strength, name)
   * 2. Checks if email already exists
   * 3. Hashes password with bcrypt (10 rounds)
   * 4. Creates user in Clerk authentication service
   * 5. Saves user to database with emailVerified: false
   * 6. Generates 64-character verification token (24h expiry)
   * 7. Sends verification email via Gmail SMTP
   * 8. Returns success response with verification instructions
   * 
   * Security Features:
   * - Rate limited: 3 attempts per minute per IP
   * - Password requirements: 8+ chars, uppercase, lowercase, number, special char
   * - Email validation with DNS check
   * - Duplicate email prevention
   * - CSRF protection
   * 
   * Next Step: User must verify email (Step 2) before login
   */
  @Post('register')
  @Public()
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @HttpCode(HttpStatus.CREATED)
  @AuditLog({
    action: AuditAction.USER_CREATE,
    entity: 'User',
    getEntityId: args => (args[0] as RegisterDto | undefined)?.email ?? 'unknown',
  })
  @ApiOperation({
    summary: '📝 Register new user account',
    description: `
**Complete registration flow with email verification**

This endpoint creates a new user account and initiates the email verification process.

### Request Requirements:
- ✅ Valid email address (checked against DNS)
- ✅ Strong password (8+ chars, mixed case, numbers, special chars)
- ✅ First and last name (2-50 characters)
- ✅ Optional username (3-30 chars, alphanumeric with underscores/hyphens)

### Process Flow:
1. **Validation**: Checks input data and password strength
2. **Duplicate Check**: Verifies email is not already registered
3. **User Creation**: 
   - Registers user in Clerk (external auth provider)
   - Saves user to database with emailVerified: false
   - Generates unique verification token (expires in 24 hours)
4. **Email Delivery**: Sends verification email with clickable link
5. **Response**: Returns user details and verification status

### Important Notes:
- 🔒 User account created but cannot login until email verified
- ⏱️ Verification token expires after 24 hours
- 📧 Check spam folder if email not received
- 🔄 Use /resend-verification endpoint if token expires
- 🚫 Rate limited to 3 registrations per minute per IP

### What Happens Next:
1. User receives verification email
2. Clicks verification link (or copies token)
3. Calls /verify-email endpoint with token
4. Email marked as verified → can now login

### Example Verification Email:
\`\`\`
Subject: Verify your MASH account

Hi John,

Click the link below to verify your email:
https://your-frontend.com/verify-email?token=3f4a8b9c1e2d5f6a...

This link expires in 24 hours.

If you didn't create this account, please ignore this email.
\`\`\`
`,
  })
  @ApiBody({
    type: RegisterDto,
    description: 'User registration information',
    examples: {
      basic: {
        summary: 'Basic Registration',
        value: {
          email: 'john.doe@example.com',
          password: 'SecurePass123!',
          firstName: 'John',
          lastName: 'Doe',
        },
      },
      withUsername: {
        summary: 'Registration with Username',
        value: {
          email: 'jane.smith@example.com',
          password: 'MySecureP@ss2024',
          firstName: 'Jane',
          lastName: 'Smith',
          username: 'jane_smith',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '✅ User registered successfully - Verification email sent',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Registration successful! Please check your email to verify your account.',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cm2x3y4z5a6b7c8d9e0f1' },
            clerkId: { type: 'string', example: 'user_2abc123xyz' },
            email: { type: 'string', example: 'john.doe@example.com' },
            username: { type: 'string', example: 'johndoe' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            imageUrl: {
              type: 'string',
              example: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=johndoe',
            },
            emailVerified: { type: 'boolean', example: false },
            role: { type: 'string', example: 'USER' },
            createdAt: { type: 'string', example: '2025-11-10T08:30:00.000Z' },
          },
        },
        verification: {
          type: 'object',
          properties: {
            sent: { type: 'boolean', example: true },
            expiresIn: { type: 'string', example: '24 hours' },
            email: { type: 'string', example: 'john.doe@example.com' },
          },
        },
        nextStep: {
          type: 'string',
          example:
            'Check your email (john.doe@example.com) and click the verification link. Then call POST /auth/verify-email with the token.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Bad Request - Invalid input or email already exists',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          oneOf: [
            { type: 'string', example: 'Email already exists' },
            { type: 'string', example: 'Password must contain uppercase, lowercase, number and special character' },
            { type: 'string', example: 'Invalid email format' },
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: '⏱️ Too Many Requests - Rate limit exceeded',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 429 },
        message: { type: 'string', example: 'ThrottlerException: Too Many Requests' },
        error: { type: 'string', example: 'Too Many Requests' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: '🔥 Internal Server Error - Email service unavailable or database error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Failed to send verification email' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * ✉️ STEP 2: EMAIL VERIFICATION
   * ==============================
   * Verifies user email address using the token sent via email.
   * 
   * This is a REQUIRED step before users can log in.
   * 
   * Process:
   * 1. Validates token format (64-character hex string)
   * 2. Finds user by verification token in database
   * 3. Checks if token has expired (24h validity)
   * 4. Marks emailVerified as true
   * 5. Clears verification token and expiry
   * 6. Updates Clerk metadata to sync verification status
   * 7. Returns success response
   * 
   * Security Features:
   * - Rate limited: 5 attempts per minute
   * - One-time use tokens (deleted after verification)
   * - Time-based expiration (24 hours)
   * - Secure random token generation
   * 
   * Next Step: User can now login (Step 3)
   */
  @Post('verify-email')
  @Public()
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '✉️ Verify email address',
    description: `
**Verify user email with verification token**

This endpoint validates the verification token sent to the user's email and marks their account as verified.

### Required Before:
- ✅ User must have registered (POST /auth/register)
- ✅ User must have received verification email
- ✅ Token must not be expired (24h validity)

### Request Requirements:
- Token must be exactly 64 characters (hex string)
- Token must exist in database
- Token must not be expired
- User must not already be verified

### Process Flow:
1. **Token Lookup**: Finds user by verification token
2. **Expiry Check**: Validates token hasn't expired
3. **Account Update**: 
   - Sets emailVerified = true
   - Clears emailVerificationToken
   - Clears emailVerificationExpiry
4. **Sync**: Updates Clerk authentication service
5. **Response**: Returns success with verified status

### Important Notes:
- 🔒 Token is single-use (deleted after verification)
- ⏱️ Tokens expire after 24 hours
- 🔄 Use /resend-verification if token expired
- ✅ After verification, user can login immediately

### Token Format:
- Length: 64 characters
- Type: Hexadecimal string
- Example: 3f4a8b9c1e2d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0

### What Happens After Verification:
1. User account status changes to "verified"
2. User can login with email + password
3. User gets full access to protected resources
4. Clerk authentication synced with database
`,
  })
  @ApiBody({
    type: VerifyEmailDto,
    description: 'Verification token from email',
    examples: {
      validToken: {
        summary: 'Valid Verification Token',
        value: {
          token: '3f4a8b9c1e2d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '✅ Email verified successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Email verified successfully! You can now log in to your account.',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cm2x3y4z5a6b7c8d9e0f1' },
            email: { type: 'string', example: 'john.doe@example.com' },
            emailVerified: { type: 'boolean', example: true },
            verifiedAt: { type: 'string', example: '2025-11-10T08:35:00.000Z' },
          },
        },
        nextStep: {
          type: 'string',
          example: 'You can now login with your email and password using POST /auth/login',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Bad Request - Invalid or expired token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          oneOf: [
            { type: 'string', example: 'Invalid verification token' },
            { type: 'string', example: 'Verification token has expired' },
            { type: 'string', example: 'Email already verified' },
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: '⏱️ Too Many Requests - Rate limit exceeded',
  })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  /**
   * 🔄 RESEND EMAIL VERIFICATION
   * =============================
   * Generates and sends a new verification token if the original expired.
   * 
   * Process:
   * 1. Finds user by email
   * 2. Checks if already verified (returns error if yes)
   * 3. Generates new 64-character token
   * 4. Sets new 24h expiration
   * 5. Sends new verification email
   * 
   * Security Features:
   * - Rate limited: 3 requests per 5 minutes
   * - Doesn't reveal if email exists (security by obscurity)
   * - Prevents spam to verified accounts
   */
  @Post('resend-verification')
  @Public()
  @Throttle({ short: { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔄 Resend verification email',
    description: `
**Send new verification token to user email**

This endpoint generates a new verification token and sends it to the user's email address.

### When to Use:
- ⏱️ Original verification token expired (after 24 hours)
- 📧 User didn't receive the original email
- 🗑️ User accidentally deleted the verification email
- 🔄 User needs a fresh verification link

### Request Requirements:
- Email must be registered (but not verified)
- User cannot be already verified
- Must not exceed rate limit (3 requests per 5 minutes)

### Process Flow:
1. **User Lookup**: Finds user by email address
2. **Status Check**: Verifies user is not already verified
3. **Token Generation**: Creates new 64-char verification token
4. **Expiry Update**: Sets new 24-hour expiration
5. **Email Delivery**: Sends new verification email
6. **Response**: Returns success (doesn't reveal if email exists)

### Important Notes:
- 🔒 Old token is replaced (previous token becomes invalid)
- ⏱️ New token expires in 24 hours from generation
- 🚫 Rate limited to prevent spam (3 per 5 minutes)
- 🔐 For security, always returns success even if email doesn't exist
- ✅ User can verify with new token immediately

### Security Best Practice:
This endpoint doesn't reveal whether an email exists in the system. It always returns a success message, even if the email is not registered. This prevents email enumeration attacks.
`,
  })
  @ApiBody({
    type: ResendVerificationDto,
    description: 'User email address',
    examples: {
      resendRequest: {
        summary: 'Resend Verification Request',
        value: {
          email: 'john.doe@example.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '✅ Verification email sent (or email not found - security)',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'If the email exists, a new verification link has been sent.',
        },
        note: {
          type: 'string',
          example:
            'For security reasons, we do not reveal whether the email exists. Please check your inbox and spam folder.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Bad Request - Email already verified',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Email is already verified. You can log in now.' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: '⏱️ Too Many Requests - Rate limit exceeded (3 per 5 minutes)',
  })
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(resendDto);
  }

  /**
   * 🔑 STEP 3: USER LOGIN
   * ======================
   * Authenticates user and returns JWT tokens for API access.
   * 
   * This endpoint requires email verification to be completed.
   * 
   * Process:
   * 1. Validates email and password format
   * 2. Finds user by email in database
   * 3. Checks if email is verified (blocks if not)
   * 4. Verifies password hash with bcrypt
   * 5. Generates access token (1h validity)
   * 6. Generates refresh token (7d validity)
   * 7. Creates session record in database
   * 8. Returns tokens and user profile
   * 
   * Security Features:
   * - Rate limited: 10 attempts per minute
   * - Requires email verification
   * - Bcrypt password verification
   * - JWT token-based authentication
   * - Session tracking in database
   * 
   * Next Step: Use access token to access protected resources (Step 4)
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiOperation({
    summary: '🔑 Login with email and password',
    description: `
**Authenticate user and receive access tokens**

This endpoint authenticates a user with email and password, returning JWT tokens for API access.

### Required Before Login:
- ✅ User must be registered (POST /auth/register)
- ✅ Email must be verified (POST /auth/verify-email)
- ✅ Valid email and password required

### Request Requirements:
- Valid email address format
- Password must be at least 8 characters
- User account must exist
- Email must be verified
- Password must match registered password

### Authentication Process:
1. **Email Lookup**: Finds user account by email
2. **Verification Check**: Ensures email is verified
3. **Password Validation**: Compares password hash (bcrypt)
4. **Token Generation**:
   - Access Token: JWT valid for 1 hour
   - Refresh Token: JWT valid for 7 days
5. **Session Creation**: Records session in database
6. **Response**: Returns tokens + user profile

### Token Usage:
**Access Token** (1 hour validity):
- Use in Authorization header: \`Bearer {accessToken}\`
- Required for all protected endpoints
- Contains user ID, email, role, permissions
- Cannot be refreshed after expiry

**Refresh Token** (7 days validity):
- Use to get new access token when expired
- Call POST /auth/refresh-token with refresh token
- One-time use (new refresh token issued)
- Stored securely in database

### Important Notes:
- 🔒 Login blocked until email verified
- ⏱️ Access token expires after 1 hour
- 🔄 Use refresh token to get new access token
- 🚫 Rate limited to 10 login attempts per minute
- 📱 Each login creates a new session
- 🔐 Multiple active sessions allowed

### Error Handling:
- Email not verified → 401 with verification reminder
- Invalid credentials → 401 with generic message
- Account inactive → 401 with contact support message
- Too many attempts → 429 with retry-after header

### What Happens After Login:
1. Store access token securely (memory/secure cookie)
2. Include token in Authorization header for API calls
3. Monitor token expiry (check exp claim in JWT)
4. Refresh token before expiry using /auth/refresh-token
5. Handle 401 errors by refreshing or re-login
`,
  })
  @ApiBody({
    type: LoginDto,
    description: 'Login credentials',
    examples: {
      standardLogin: {
        summary: 'Standard Login',
        value: {
          email: 'john.doe@example.com',
          password: 'SecurePass123!',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '✅ Authentication successful - Returns tokens and user profile',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Login successful' },
        accessToken: {
          type: 'string',
          example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbTJ4M3k0ejVhNmI3YzhkOWUwZjEiLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3MzE0MDMyMDAsImV4cCI6MTczMTQwNjgwMH0.xyz123abc',
          description: 'JWT access token (1 hour validity)',
        },
        refreshToken: {
          type: 'string',
          example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbTJ4M3k0ejVhNmI3YzhkOWUwZjEiLCJzZXNzaW9uSWQiOiJzZXNzXzEyMzQ1Njc4IiwiaWF0IjoxNzMxNDAzMjAwLCJleHAiOjE3MzIwMDgwMDB9.abc789xyz',
          description: 'JWT refresh token (7 days validity)',
        },
        expiresIn: { type: 'number', example: 3600, description: 'Access token expiry in seconds' },
        tokenType: { type: 'string', example: 'Bearer' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cm2x3y4z5a6b7c8d9e0f1' },
            clerkId: { type: 'string', example: 'user_2abc123xyz' },
            email: { type: 'string', example: 'john.doe@example.com' },
            username: { type: 'string', example: 'johndoe' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            imageUrl: { type: 'string', example: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=johndoe' },
            role: { type: 'string', example: 'USER' },
            emailVerified: { type: 'boolean', example: true },
            isActive: { type: 'boolean', example: true },
            lastLoginAt: { type: 'string', example: '2025-11-10T09:00:00.000Z' },
          },
        },
        session: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'sess_12345678' },
            expiresAt: { type: 'string', example: '2025-11-17T09:00:00.000Z' },
            createdAt: { type: 'string', example: '2025-11-10T09:00:00.000Z' },
          },
        },
        nextStep: {
          type: 'string',
          example:
            'Include the accessToken in Authorization header as "Bearer {token}" for all protected API calls',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '❌ Unauthorized - Invalid credentials or email not verified',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: {
          oneOf: [
            { type: 'string', example: 'Invalid email or password' },
            {
              type: 'string',
              example: 'Please verify your email address before logging in. Check your inbox for verification link.',
            },
            { type: 'string', example: 'Account is inactive. Please contact support.' },
          ],
        },
        error: { type: 'string', example: 'Unauthorized' },
        action: {
          type: 'string',
          example: 'POST /auth/resend-verification to get new verification email',
        },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: '⏱️ Too Many Requests - Rate limit exceeded (10 per minute)',
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ short: { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Send password reset code to user email. Does not reveal if email exists.',
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
    description: 'Process OAuth callback with authorization code. Called by OAuth provider.',
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
    getEntityId: args => (args[0] as ClerkWebhookDto | undefined)?.data?.id as string ?? 'unknown',
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
  async getCurrentUser(@Request() req: AuthenticatedRequest) {
    // JWT strategy returns user.id, not user.userId
    return this.authService.getCurrentUser(req.user.id);
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
  getSession(@Request() req: AuthenticatedRequest) {
    return this.authService.getSessionInfo(req.user);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @AuditLog({
    action: AuditAction.LOGOUT,
    entity: 'User',
    getEntityId: args => ((args[0] as AuthenticatedRequest | undefined)?.user?.userId ?? 'unknown'),
  })
  @ApiOperation({
    summary: 'Logout user',
    description: 'Invalidates the current user session',
  })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  logout() {
    return this.authService.logout();
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
  async getUserPermissions(@Request() req: AuthenticatedRequest) {
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
  async impersonateUser(@Request() req: AuthenticatedRequest, @Body() body: { targetUserId: string }) {
    if (!body.targetUserId) {
      throw new BadRequestException('targetUserId is required');
    }
    return this.authService.impersonateUser(req.user.id, body.targetUserId);
  }
}
