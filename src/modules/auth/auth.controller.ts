import {
  Controller,
  Get,
  Post,
  Delete,
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
import {
  VerifyEmailDto,
  ResendVerificationDto,
  VerifyEmailCodeDto,
  ResendVerificationCodeDto,
} from './dto/verify-email.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyResetCodeDto,
  ResendPasswordResetCodeDto,
} from './dto/password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { OAuthCallbackDto, OAuthInitiateDto } from './dto/oauth.dto';
import {
  GoogleLoginDto,
  FacebookLoginDto,
  LinkGoogleAccountDto,
  LinkFacebookAccountDto,
} from '../oauth/dto/oauth-login.dto';
import {
  LinkGoogleAccountDto as GoogleLinkDto,
  GoogleLinkResponseDto,
  GoogleUnlinkResponseDto,
} from './dto/google-link.dto';
import { FirebaseSyncDto } from './dto/firebase-sync.dto';
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

@ApiTags('Authentication')
@ApiExtraModels(RegisterDto, LoginDto, VerifyEmailDto, ResendVerificationDto, RefreshTokenDto)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ==================== COMPLETE AUTHENTICATION FLOW ====================
  // Step 1: Registration → Step 2: Email Verification → Step 3: Login → Step 4: Access Resources

  /**
   * � CHECK USERNAME AVAILABILITY
   * ===============================
   * Checks if a username is available for registration.
   *
   * Process:
   * 1. Validates username format (3-30 characters)
   * 2. Checks database for existing username
   * 3. Returns availability status
   *
   * Use Cases:
   * - Frontend username generation during registration
   * - Real-time username availability validation
   * - Username uniqueness verification
   *
   * Returns:
   * - available: true if username is not taken
   * - available: false if username already exists
   */
  @Get('check-username')
  @Public()
  @Throttle({ short: { limit: 20, ttl: 60000 } }) // Increased to 20 req/min
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔍 Check username availability (OPTIMIZED)',
    description: 'Check if a username is available for registration. Cached for 5 minutes. Response time: <100ms',
  })
  @ApiResponse({
    status: 200,
    description: 'Username availability checked successfully',
    schema: {
      example: {
        available: true,
        username: 'johndoe',
      },
    },
  })
  async checkUsername(@Query('username') username: string) {
    if (!username || username.length < 3 || username.length > 30) {
      throw new BadRequestException('Username must be between 3 and 30 characters');
    }

    const exists = await this.authService.checkUsernameExists(username);

    return {
      available: !exists,
      username,
    };
  }

  /**
   * �📝 STEP 1: USER REGISTRATION
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
  @Post('google/sync')
  @Public()
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔄 Sync Google OAuth user',
    description: 'Creates or updates user from Google authentication',
  })
  @ApiResponse({ status: 200, description: 'Sync successful' })
  async syncGoogleUser(@Body() googleSyncDto: any) {
    return this.authService.syncGoogleUser(googleSyncDto);
  }

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
            {
              type: 'string',
              example: 'Password must contain uppercase, lowercase, number and special character',
            },
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
   * 🔄 RESEND 6-DIGIT VERIFICATION CODE (UNIFIED METHOD)
   * =====================================================
   * Sends a new 6-digit verification code to user's email.
   * This endpoint now uses the same 6-digit code system as registration.
   *
   * Why 6-Digit Code?
   * - ✅ Mobile-friendly: Easy to type on mobile keyboard
   * - ✅ User stays in app (no deep linking required)
   * - ✅ Faster verification (10 minutes vs 24 hours)
   * - ✅ More secure: Short expiry window
   * - ✅ Familiar UX: Like OTP/2FA systems
   *
   * Security Features:
   * - Rate limited: 1 request per minute (60 seconds cooldown)
   * - Doesn't reveal if email exists (prevents enumeration)
   * - Single-use codes (cannot reuse same code)
   * - Short expiry (10 minutes)
   * - Resets failed attempt counter
   *
   * Process:
   * 1. Validates user exists and is not verified
   * 2. Checks rate limit (1 minute cooldown)
   * 3. Generates new 6-digit code
   * 4. Clears old code and resets attempts
   * 5. Sends email with new code
   * 6. User verifies with POST /auth/verify-email-code
   */
  @Post('resend-verification')
  @Public()
  @Throttle({ short: { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔄 Resend verification email',
    description: `
**Send new 6-digit verification code to user email**

This endpoint generates a new 6-digit verification code and sends it to the user's email address. 
**Note: This endpoint now uses the same 6-digit code system as registration (no longer token-based).**

### When to Use:
- ⏱️ Original verification code expired (after 10 minutes)
- 📧 User didn't receive the original email
- 🗑️ User accidentally deleted the verification email
- 🔄 User needs a fresh verification code
- 🔁 User failed verification attempts and wants to reset

### Request Requirements:
- Email must be registered (but not verified)
- User cannot be already verified
- Must not exceed rate limit (1 request per minute)

### Process Flow:
1. **User Lookup**: Finds user by email address
2. **Status Check**: Verifies user is not already verified
3. **Rate Limit Check**: Ensures 1 minute has passed since last code
4. **Code Generation**: Creates new 6-digit numeric code (e.g., "123456")
5. **Expiry Update**: Sets new 10-minute expiration
6. **Attempt Reset**: Resets failed verification attempts to 0
7. **Email Delivery**: Sends new verification code email (same template as registration)
8. **Response**: Returns success (doesn't reveal if email exists)

### Important Notes:
- 🔒 Old code is replaced (previous code becomes invalid)
- ⏱️ New code expires in 10 minutes (not 24 hours)
- 🚫 Rate limited to 1 request per minute (prevents spam)
- 🔐 For security, always returns success even if email doesn't exist
- ✅ User can verify with new code using POST /auth/verify-email-code
- 🔄 Resets failed attempt counter (gives user fresh 5 attempts)

### Security Best Practice:
This endpoint doesn't reveal whether an email exists in the system. It always returns a success message, even if the email is not registered. This prevents email enumeration attacks.

### Changed from Token-Based:
- ❌ Old: 24-hour token with deep link verification
- ✅ New: 10-minute 6-digit code with in-app verification
- 🎯 Benefit: Faster, more secure, better mobile UX
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
    description: '✅ Verification code sent (or email not found - security)',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'A new 6-digit verification code has been sent to your email.',
        },
        expiresIn: {
          type: 'string',
          example: '10 minutes',
        },
        email: {
          type: 'string',
          example: 'john.doe@example.com',
        },
        nextStep: {
          type: 'string',
          example: 'Enter the code using POST /auth/verify-email-code',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Bad Request - Email already verified or rate limit hit',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Email is already verified. You can log in now.',
        },
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
   * ✅ VERIFY EMAIL WITH 6-DIGIT CODE (PRIMARY METHOD)
   * =================================================
   * Mobile-friendly email verification using 6-digit numeric code.
   * This is the RECOMMENDED method for mobile apps.
   *
   * Why 6-Digit Code?
   * - ✅ Easy to type on mobile keyboard
   * - ✅ User stays in app (no deep linking required)
   * - ✅ Familiar UX (like OTP systems)
   * - ✅ Short expiry (10 minutes) for better security
   * - ✅ Immediate login with JWT token
   *
   * Security Features:
   * - Single-use codes (cannot reuse same code)
   * - 10-minute expiration (vs 24h for tokens)
   * - Attempt tracking (max 5 attempts before lockout)
   * - Rate limited: 5 verification attempts per minute
   */
  @Post('verify-email-code')
  @Public()
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '✅ Verify email with 6-digit code (Mobile-Friendly)',
    description: `
**Verify user email with 6-digit verification code**

This is the PRIMARY email verification method for mobile applications. 
Users receive a 6-digit code in their email and enter it directly in the app.

### Advantages Over Token-Based Verification:
- 📱 Mobile-optimized: Easy to type on mobile keyboard
- 🎯 User stays in app (no deep linking required)
- ⚡ Faster: ~30 seconds vs 1-2 minutes with tokens
- 🔒 More secure: 10-minute expiry vs 24-hour tokens
- 💡 Familiar UX: Like banking apps and 2FA systems

### Required Before:
- ✅ User must have registered (POST /auth/register)
- ✅ User must have received verification code via email
- ✅ Code must not be expired (10-minute validity)
- ✅ Code must not have been used already

### Request Requirements:
- Email: Valid registered email address
- Code: Exactly 6 numeric digits (e.g., "123456")
- Code must match the one sent to email
- Maximum 5 failed attempts allowed

### Process Flow:
1. **Code Validation**: Finds user by email + code
2. **Security Checks**:
   - Code not already used (single-use enforcement)
   - Code not expired (10-minute window)
   - Failed attempts < 5 (prevents brute force)
3. **Account Activation**:
   - Sets emailVerified = true
   - Clears all verification codes
   - Resets failed attempt counter
4. **Immediate Login**: Generates JWT token for instant access
5. **Response**: Returns token + user data

### Important Notes:
- 🔒 Codes are single-use only (deleted after verification)
- ⏱️ Codes expire after 10 minutes
- 🚫 Locked after 5 failed attempts (request new code)
- 🔄 Use POST /auth/resend-verification-code if code expired
- ✅ Returns JWT token for immediate login (no separate login needed)

### Error Scenarios:
- **Invalid code**: Wrong digits entered → Increments attempt counter
- **Code used**: Already verified → Request new code
- **Code expired**: Older than 10 minutes → Request new code
- **Too many attempts**: 5+ failures → Request new code (resets counter)
- **User not found**: Email doesn't exist or already verified
`,
  })
  @ApiBody({
    type: VerifyEmailCodeDto,
    description: '6-digit verification code from email',
    examples: {
      validCode: {
        summary: 'Valid Verification Code',
        value: {
          email: 'user@example.com',
          code: '123456',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '✅ Email verified successfully - Returns JWT token for immediate login',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Email verified successfully! You are now logged in.' },
        token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description: 'JWT token for immediate API access',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cm3h88u5s0001vxqlx01j0002' },
            email: { type: 'string', example: 'user@example.com' },
            username: { type: 'string', example: 'john_doe', nullable: true },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            imageUrl: {
              type: 'string',
              example: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=john_doe',
            },
            role: { type: 'string', example: 'USER' },
            emailVerified: { type: 'boolean', example: true },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Bad Request - Various error scenarios',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          examples: [
            'Invalid verification code. Please check your email and try again.',
            'This verification code has already been used. Please request a new code.',
            'Verification code has expired. Please request a new code.',
            'Too many failed verification attempts. Please request a new code.',
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: '⏱️ Too Many Requests - Rate limit exceeded (5 attempts per minute)',
  })
  async verifyEmailCode(@Body() dto: VerifyEmailCodeDto) {
    return this.authService.verifyEmailWithCode(dto);
  }

  /**
   * 🔄 RESEND 6-DIGIT VERIFICATION CODE
   * ====================================
   * Request a new 6-digit verification code if previous one expired or failed.
   *
   * Rate Limiting:
   * - 3 requests per minute (prevents spam)
   * - 1-minute cooldown between code requests (enforced server-side)
   *
   * What Happens:
   * - Generates new 6-digit code
   * - Resets failed attempt counter
   * - Sends new verification email
   * - Updates last-sent timestamp
   */
  @Post('resend-verification-code')
  @Public()
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔄 Resend 6-digit verification code',
    description: `
**Request new 6-digit verification code**

This endpoint generates a new verification code and sends it to the user's email.

### When to Use:
- ⏱️ Original code expired (after 10 minutes)
- ❌ Too many failed verification attempts (5+)
- 📧 User didn't receive the email
- 🗑️ User accidentally deleted the email
- 🔄 User needs a fresh code

### Request Requirements:
- Email must be registered (but not verified)
- User cannot be already verified
- Must respect 1-minute cooldown between requests
- Must not exceed rate limit (3 requests per minute)

### Process Flow:
1. **User Lookup**: Finds user by email address
2. **Status Check**: Verifies user is not already verified
3. **Cooldown Check**: Ensures 1 minute passed since last code sent
4. **Code Generation**: Creates new 6-digit code
5. **Attempt Reset**: Resets failed verification attempts to 0
6. **Email Delivery**: Sends new verification code
7. **Response**: Returns success with expiry time

### Important Notes:
- 🔒 Old code is replaced (previous code becomes invalid)
- ⏱️ New code expires in 10 minutes from generation
- 🚫 Rate limited: 3 requests per minute
- 🕐 Cooldown: 1 minute between requests
- 🔄 Resets failed attempt counter (fresh start)

### Rate Limiting:
- **Endpoint-level**: 3 requests per minute (NestJS throttler)
- **Server-side**: 1-minute cooldown between code generations
- **Purpose**: Prevents spam and abuse

### Error Scenarios:
- **Already verified**: User completed verification → Can login
- **Too soon**: Less than 1 minute since last code → Wait X seconds
- **Rate limit**: Too many requests → Wait and try again
- **User not found**: Email doesn't exist (doesn't reveal this for security)
`,
  })
  @ApiBody({
    type: ResendVerificationCodeDto,
    description: 'User email address to resend code to',
    examples: {
      resendRequest: {
        summary: 'Resend Code Request',
        value: {
          email: 'user@example.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '✅ New verification code sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'A new 6-digit verification code has been sent to your email.',
        },
        expiresIn: { type: 'string', example: '10 minutes' },
        email: { type: 'string', example: 'user@example.com' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Bad Request - Various error scenarios',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          examples: [
            'Email is already verified. You can log in now.',
            'Please wait 45 seconds before requesting a new code.',
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: '⏱️ Too Many Requests - Rate limit exceeded (3 per minute)',
  })
  @ApiResponse({
    status: 500,
    description: '❌ Internal Server Error - Failed to send email',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: {
          type: 'string',
          example: 'Failed to send verification code. Please try again later.',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async resendVerificationCode(@Body() dto: ResendVerificationCodeDto) {
    return this.authService.resendVerificationCode(dto);
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
            imageUrl: {
              type: 'string',
              example: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=johndoe',
            },
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
              example:
                'Please verify your email address before logging in. Check your inbox for verification link.',
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

  // ==================== PASSWORD RESET (6-DIGIT CODE) ====================

  @Post('forgot-password')
  @Public()
  @Throttle({ short: { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔐 Request password reset (6-digit code)',
    description: `
**Send 6-digit password reset code to user email**

### Security Features:
- ✅ Rate limiting: 3 requests per 5 minutes
- ✅ Code expires in 10 minutes
- ✅ Does not reveal if email exists (security best practice)
- ✅ Only numeric 6-digit code (mobile-friendly)
- ✅ 1-minute cooldown between resend requests

### Mobile & PC Friendly:
- 📱 Easy to type on mobile devices (numeric keyboard)
- 💻 Works on all platforms (web, mobile app, desktop)

### Process Flow:
1. User enters their email address
2. System sends 6-digit code to email
3. User verifies code: POST /auth/verify-reset-code (optional)
4. User resets password: POST /auth/reset-password
`,
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset code sent successfully',
    schema: {
      example: {
        success: true,
        message: 'A 6-digit password reset code has been sent to your email.',
        expiresIn: '10 minutes',
        email: 'user@example.com',
        nextStep:
          'Verify the code using POST /auth/verify-reset-code, then reset password with POST /auth/reset-password',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Rate limit exceeded - too many requests',
    schema: {
      example: {
        statusCode: 400,
        message: 'Please wait 45 seconds before requesting a new code.',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({ status: 429, description: 'Too many reset requests (throttle limit)' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('verify-reset-code')
  @Public()
  @Throttle({ short: { limit: 5, ttl: 300000 } }) // 5 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '✅ Verify password reset code',
    description: `
**Verify the 6-digit code before resetting password**

### Optional Step:
This endpoint is optional but recommended for better UX. It allows users to verify
their code is correct before entering their new password.

### Use Cases:
- ✅ Show success message before password form
- ✅ Validate code in multi-step forms
- ✅ Provide immediate feedback to users

### Security:
- Maximum 5 failed attempts before lockout
- Code must not be expired (10 minutes)
- Code must not have been used already
`,
  })
  @ApiBody({ type: VerifyResetCodeDto })
  @ApiResponse({
    status: 200,
    description: 'Code verified successfully',
    schema: {
      example: {
        success: true,
        message: 'Code verified successfully. You can now reset your password.',
        email: 'user@example.com',
        nextStep: 'Reset your password using POST /auth/reset-password with the same code',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid, expired, or used code',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid verification code.',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({ status: 429, description: 'Too many verification attempts' })
  async verifyResetCode(@Body() verifyResetCodeDto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(verifyResetCodeDto);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ short: { limit: 5, ttl: 300000 } }) // 5 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔑 Reset password with 6-digit code',
    description: `
**Reset user password using the 6-digit code sent to their email**

### Requirements:
- Valid 6-digit code (not expired, not used)
- New password meeting security requirements:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character (@$!%*?&)

### Process:
1. User receives 6-digit code via email
2. User optionally verifies code: POST /auth/verify-reset-code
3. User enters code + new password
4. Password is reset and code is invalidated

### After Reset:
- ✅ Password updated successfully
- ✅ Reset code marked as used (single-use)
- ✅ Confirmation email sent
- ✅ User can log in with new password
`,
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    schema: {
      example: {
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.',
        email: 'user@example.com',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid reset code or weak password',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid verification code.',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({ status: 429, description: 'Too many reset attempts' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('resend-password-reset-code')
  @Public()
  @Throttle({ short: { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔄 Resend password reset code',
    description: `
**Resend a new 6-digit password reset code if expired or not received**

### When to Use:
- ⏱️ Code expired (10 minutes passed)
- 📧 Email not received
- ❌ Maximum verification attempts reached (5 attempts)

### Rate Limiting:
- 1-minute cooldown between resend requests
- 3 requests per 5 minutes (throttle limit)

### Process:
1. User requests new code
2. Old code is invalidated
3. New 6-digit code generated
4. Code sent via email (10-minute expiry)
5. Failed attempts counter reset
`,
  })
  @ApiBody({ type: ResendPasswordResetCodeDto })
  @ApiResponse({
    status: 200,
    description: 'New password reset code sent successfully',
    schema: {
      example: {
        success: true,
        message: 'A 6-digit password reset code has been sent to your email.',
        expiresIn: '10 minutes',
        email: 'user@example.com',
        nextStep:
          'Verify the code using POST /auth/verify-reset-code, then reset password with POST /auth/reset-password',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Rate limit exceeded - too fast',
    schema: {
      example: {
        statusCode: 400,
        message: 'Please wait 30 seconds before requesting a new code.',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({ status: 429, description: 'Too many resend requests' })
  async resendPasswordResetCode(@Body() resendDto: ResendPasswordResetCodeDto) {
    return this.authService.resendPasswordResetCode(resendDto);
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
    getEntityId: args =>
      ((args[0] as ClerkWebhookDto | undefined)?.data?.id as string) ?? 'unknown',
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
    getEntityId: args => (args[0] as AuthenticatedRequest | undefined)?.user?.userId ?? 'unknown',
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
  async impersonateUser(
    @Request() req: AuthenticatedRequest,
    @Body() body: { targetUserId: string },
  ) {
    if (!body.targetUserId) {
      throw new BadRequestException('targetUserId is required');
    }
    return this.authService.impersonateUser(req.user.id, body.targetUserId);
  }

  // ==================== GOOGLE & FACEBOOK SSO ENDPOINTS ====================

  /**
   * 🔐 GOOGLE LOGIN
   * ===============
   * Authenticate user with Google ID Token (Backend Token Validation Approach)
   *
   * Flow:
   * 1. Client gets Google ID token from Google Sign-In SDK (mobile/web)
   * 2. Client sends ID token to this endpoint
   * 3. Backend validates token with Google OAuth API
   * 4. Backend finds or creates user in database
   * 5. Backend generates JWT tokens (access + refresh)
   * 6. Client stores tokens and redirects to dashboard
   *
   * Security:
   * - Rate limited: 10 requests per 5 minutes per IP
   * - Token validated with Google's API (prevents forgery)
   * - Email auto-verified (Google verifies emails)
   * - Handles email conflicts (auto-links if email verified)
   */
  @Post('google/login')
  @Public()
  @Throttle({ short: { limit: 10, ttl: 300000 } }) // 10 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @AuditLog({
    action: AuditAction.LOGIN,
    entity: 'User',
    getEntityId: args => 'google_oauth',
  })
  @ApiOperation({
    summary: '🔐 Login with Google',
    description: `
**Google OAuth 2.0 Login (Backend Token Validation)**

Authenticate users with their Google account using ID token validation.

**How It Works:**
1. Client initiates Google Sign-In (using Google SDK)
2. Google returns ID token (JWT format)
3. Client sends ID token to this endpoint
4. Backend validates token with Google OAuth API
5. Backend creates/finds user and returns JWT tokens

**Mobile Integration:**
\`\`\`typescript
// React Native (iOS/Android)
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const handleGoogleLogin = async () => {
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo.idToken;
  
  const response = await fetch('/api/v1/auth/google/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  
  const { accessToken, refreshToken } = await response.json();
  // Store tokens and navigate to home
};
\`\`\`

**Web Integration:**
\`\`\`typescript
// React Web
import { GoogleLogin } from '@react-oauth/google';

<GoogleLogin
  onSuccess={(credentialResponse) => {
    fetch('/api/v1/auth/google/login', {
      method: 'POST',
      body: JSON.stringify({ idToken: credentialResponse.credential }),
    });
  }}
/>
\`\`\`

**Benefits:**
- ✅ One-click login (no password needed)
- ✅ Email auto-verified by Google
- ✅ Faster registration flow
- ✅ Works on mobile and web
`,
  })
  @ApiBody({ type: GoogleLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Google authentication successful',
    schema: {
      example: {
        success: true,
        message: 'Google authentication successful',
        accessToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsImVtYWlsIjoiam9obi5kb2VAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3MDE5NjAwMDAsImV4cCI6MTcwMjA0NjQwMH0.abc123...',
        refreshToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsImVtYWlsIjoiam9obi5kb2VAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3MDE5NjAwMDAsImV4cCI6MTcwNDU1MjAwMH0.xyz789...',
        user: {
          id: 'user_abc123xyz',
          email: 'john.doe@gmail.com',
          firstName: 'John',
          lastName: 'Doe',
          imageUrl: 'https://lh3.googleusercontent.com/a/ACg8ocI...',
          role: 'USER',
          oauthProvider: ['google'],
        },
        isNewUser: false,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired Google ID token',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid Google ID token',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token validation failed',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded (10 requests per 5 minutes)',
  })
  async loginWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto);
  }

  /**
   * � FIREBASE SYNC (Google OAuth via Firebase)
   * ============================================
   * Synchronize Firebase authentication with backend JWT tokens.
   * Used when frontend handles Google OAuth through Firebase SDK.
   *
   * Flow:
   * 1. User clicks "Sign in with Google" in frontend
   * 2. Frontend redirects to Google OAuth screen
   * 3. User authenticates with Google
   * 4. Google redirects back with auth code
   * 5. Frontend exchanges code for Firebase ID token
   * 6. Frontend sends Firebase ID token to this endpoint
   * 7. Backend verifies token with Firebase Admin SDK
   * 8. Backend finds/creates user and generates JWT tokens
   * 9. Backend sets auth-token cookie and returns user data
   * 10. Frontend redirects to dashboard
   *
   * Security:
   * - Rate limited: 10 requests per 5 minutes per IP
   * - Token validated with Firebase Admin SDK (prevents forgery)
   * - Email auto-verified (Firebase verifies via Google)
   * - Sets secure HTTP-only cookie for web apps
   */
  @Post('firebase-sync')
  @Public()
  @Throttle({ short: { limit: 10, ttl: 300000 } }) // 10 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @AuditLog({
    action: AuditAction.LOGIN,
    entity: 'User',
    getEntityId: args => 'firebase_google_oauth',
  })
  @ApiOperation({
    summary: '🔥 Sync Firebase Authentication',
    description: `
**Firebase Google OAuth Sync**

Exchange Firebase ID token (from Google OAuth) for backend JWT tokens.

**Frontend Integration:**
\`\`\`typescript
// React/Next.js with Firebase
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase-config';

const handleGoogleLogin = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  
  // Get Firebase ID token
  const idToken = await result.user.getIdToken();
  
  // Send to backend
  const response = await fetch('/api/v1/auth/firebase-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Important: Include cookies
    body: JSON.stringify({ idToken }),
  });
  
  const data = await response.json();
  // Cookie is set automatically, store access token
  localStorage.setItem('accessToken', data.accessToken);
  window.location.href = '/dashboard';
};
\`\`\`

**Benefits:**
- ✅ Leverages existing Firebase setup
- ✅ Seamless Google OAuth integration
- ✅ Automatic cookie management
- ✅ Email auto-verified by Google
- ✅ Single sign-on across devices
`,
  })
  @ApiBody({ type: FirebaseSyncDto })
  @ApiResponse({
    status: 200,
    description: 'Firebase authentication synced successfully',
    schema: {
      example: {
        success: true,
        message: 'Firebase authentication synchronized',
        accessToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsImVtYWlsIjoiam9obi5kb2VAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3MDE5NjAwMDAsImV4cCI6MTcwMjA0NjQwMH0.abc123...',
        refreshToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsImVtYWlsIjoiam9obi5kb2VAZ21haWwuY29tIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3MDE5NjAwMDAsImV4cCI6MTcwNDU1MjAwMH0.xyz789...',
        user: {
          id: 'user_abc123xyz',
          email: 'john.doe@gmail.com',
          firstName: 'John',
          lastName: 'Doe',
          imageUrl: 'https://lh3.googleusercontent.com/a/...',
          role: 'USER',
          emailVerified: true,
          oauthProvider: ['google'],
        },
        isNewUser: false,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired Firebase ID token',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid Firebase ID token',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token validation failed with Firebase',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded (10 requests per 5 minutes)',
  })
  async firebaseSync(@Body() dto: FirebaseSyncDto, @Request() req: any) {
    return this.authService.firebaseSync(dto, req.res);
  }

  /**
   * �🔐 FACEBOOK LOGIN
   * =================
   * Authenticate user with Facebook Access Token
   *
   * Flow:
   * 1. Client gets Facebook access token from Facebook Login SDK
   * 2. Client sends access token to this endpoint
   * 3. Backend validates token with Facebook Graph API
   * 4. Backend fetches user data from Facebook
   * 5. Backend finds or creates user in database
   * 6. Backend generates JWT tokens
   *
   * Security:
   * - Rate limited: 10 requests per 5 minutes per IP
   * - Token validated with Facebook's Graph API
   * - Email auto-verified (Facebook requires verified emails)
   */
  @Post('facebook/login')
  @Public()
  @Throttle({ short: { limit: 10, ttl: 300000 } }) // 10 requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @AuditLog({
    action: AuditAction.LOGIN,
    entity: 'User',
    getEntityId: args => 'facebook_oauth',
  })
  @ApiOperation({
    summary: '🔐 Login with Facebook',
    description: `
**Facebook Login (Backend Token Validation)**

Authenticate users with their Facebook account using access token validation.

**How It Works:**
1. Client initiates Facebook Login (using Facebook SDK)
2. Facebook returns access token
3. Client sends access token to this endpoint
4. Backend validates token and fetches user data from Facebook Graph API
5. Backend creates/finds user and returns JWT tokens

**Mobile Integration:**
\`\`\`typescript
// React Native
import { LoginManager, AccessToken } from 'react-native-fbsdk-next';

const handleFacebookLogin = async () => {
  const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
  
  if (!result.isCancelled) {
    const data = await AccessToken.getCurrentAccessToken();
    const accessToken = data.accessToken.toString();
    
    const response = await fetch('/api/v1/auth/facebook/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });
    
    const { accessToken: jwtToken } = await response.json();
    // Store JWT and navigate
  }
};
\`\`\`

**Web Integration:**
\`\`\`typescript
// React Web
import FacebookLogin from 'react-facebook-login';

<FacebookLogin
  appId="YOUR_FACEBOOK_APP_ID"
  fields="name,email,picture"
  callback={(response) => {
    fetch('/api/v1/auth/facebook/login', {
      method: 'POST',
      body: JSON.stringify({ accessToken: response.accessToken }),
    });
  }}
/>
\`\`\`
`,
  })
  @ApiBody({ type: FacebookLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Facebook authentication successful',
    schema: {
      example: {
        success: true,
        message: 'Facebook authentication successful',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'user_xyz789',
          email: 'jane.smith@facebook.com',
          firstName: 'Jane',
          lastName: 'Smith',
          imageUrl: 'https://graph.facebook.com/1234567890/picture',
          role: 'USER',
          oauthProvider: ['facebook'],
        },
        isNewUser: true,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired Facebook access token' })
  @ApiResponse({ status: 401, description: 'Token validation failed' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async loginWithFacebook(@Body() dto: FacebookLoginDto) {
    return this.authService.loginWithFacebook(dto);
  }

  /**
   * 🔗 LINK GOOGLE ACCOUNT
   * ======================
   * Link Google account to existing authenticated user
   * Requires JWT authentication
   *
   * Use Case:
   * - User registered with email/password
   * - User wants to add Google login option
   * - After linking, user can login with either method
   *
   * Security:
   * - Requires valid JWT token (user must be logged in)
   * - Prevents linking same Google account to multiple users
   * - Validates email match (optional, configurable)
   */
  @Post('social/link/google')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @AuditLog({
    action: AuditAction.USER_UPDATE,
    entity: 'User',
    getEntityId: args => 'social_link_google',
  })
  @ApiOperation({
    summary: '🔗 Link Google account to existing user',
    description: `
**Link Google Account (Requires Authentication)**

Allows existing users to add Google login as an alternative authentication method.

**Use Cases:**
- User registered with email/password, wants to add Google login
- User has Facebook login, wants to add Google as backup
- User wants convenience of OAuth without losing existing account

**Security:**
- Requires valid JWT token (user must be logged in)
- Prevents duplicate linking (Google account can only link to one user)
- Validates token with Google API

**Example:**
\`\`\`typescript
// User is logged in with password
const jwtToken = localStorage.getItem('accessToken');

// User clicks "Link Google Account"
const googleIdToken = await GoogleSignIn.getIdToken();

await fetch('/api/v1/auth/social/link/google', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${jwtToken}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ idToken: googleIdToken }),
});

// Now user can login with password OR Google
\`\`\`
`,
  })
  @ApiBody({ type: LinkGoogleAccountDto })
  @ApiResponse({
    status: 200,
    description: 'Google account linked successfully',
    schema: {
      example: {
        success: true,
        message: 'Google account linked successfully',
        user: {
          id: 'user_abc123',
          email: 'john.doe@gmail.com',
          oauthProvider: ['google', 'facebook'],
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Google account already linked to another user' })
  @ApiResponse({ status: 401, description: 'JWT token invalid or expired' })
  @ApiResponse({ status: 409, description: 'Email mismatch or conflict' })
  async linkGoogleAccount(@Request() req: AuthenticatedRequest, @Body() dto: LinkGoogleAccountDto) {
    return this.authService.linkGoogleAccount(req.user.id, dto.idToken);
  }

  /**
   * 🔗 LINK FACEBOOK ACCOUNT
   * ========================
   * Link Facebook account to existing authenticated user
   * Requires JWT authentication
   */
  @Post('social/link/facebook')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @AuditLog({
    action: AuditAction.USER_UPDATE,
    entity: 'User',
    getEntityId: args => 'social_link_facebook',
  })
  @ApiOperation({
    summary: '🔗 Link Facebook account to existing user',
    description: `
**Link Facebook Account (Requires Authentication)**

Allows existing users to add Facebook login as an alternative authentication method.

**Security:**
- Requires valid JWT token
- Prevents duplicate linking
- Validates token with Facebook Graph API
`,
  })
  @ApiBody({ type: LinkFacebookAccountDto })
  @ApiResponse({
    status: 200,
    description: 'Facebook account linked successfully',
    schema: {
      example: {
        success: true,
        message: 'Facebook account linked successfully',
        user: {
          id: 'user_abc123',
          email: 'john.doe@gmail.com',
          oauthProvider: ['google', 'facebook'],
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Facebook account already linked to another user' })
  @ApiResponse({ status: 401, description: 'JWT token invalid or expired' })
  @ApiResponse({ status: 409, description: 'Email mismatch or conflict' })
  async linkFacebookAccount(
    @Request() req: AuthenticatedRequest,
    @Body() dto: LinkFacebookAccountDto,
  ) {
    return this.authService.linkFacebookAccount(req.user.id, dto.accessToken);
  }

  /**
   * 🔓 UNLINK SOCIAL ACCOUNT
   * ========================
   * Remove Google or Facebook login from user account
   * Requires JWT authentication
   *
   * Security:
   * - Requires at least one authentication method remaining
   * - Cannot unlink if no password set (would lock user out)
   * - Can unlink if user has password OR another OAuth provider
   */
  @Post('social/unlink/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @AuditLog({
    action: AuditAction.USER_UPDATE,
    entity: 'User',
    getEntityId: args => 'social_unlink',
  })
  @ApiOperation({
    summary: '🔓 Unlink social account (Google or Facebook)',
    description: `
**Unlink Social Account (Requires Authentication)**

Remove Google or Facebook login from user account.

**Security Protection:**
- User must have at least one authentication method
- Cannot unlink if no password set (would lock user out)
- Must have password OR another OAuth provider

**URL Parameter:**
- \`provider\`: "google" or "facebook"

**Example:**
\`\`\`typescript
// Unlink Google account
DELETE /api/v1/auth/social/unlink/google

// Unlink Facebook account
DELETE /api/v1/auth/social/unlink/facebook
\`\`\`

**Error Cases:**
- 400: Cannot unlink (no password, no other OAuth)
- 404: Social account not linked
`,
  })
  @ApiResponse({
    status: 200,
    description: 'Social account unlinked successfully',
    schema: {
      example: {
        success: true,
        message: 'Google account unlinked successfully',
        user: {
          id: 'user_abc123',
          email: 'john.doe@gmail.com',
          oauthProvider: ['facebook'],
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot unlink (no password set, would lock user out)',
  })
  @ApiResponse({ status: 401, description: 'JWT token invalid' })
  @ApiResponse({ status: 404, description: 'Social account not linked' })
  async unlinkSocialAccount(
    @Request() req: AuthenticatedRequest,
    @Query('provider') provider: 'google' | 'facebook',
  ) {
    if (!provider || !['google', 'facebook'].includes(provider)) {
      throw new BadRequestException('Provider must be "google" or "facebook"');
    }
    return this.authService.unlinkSocialAccount(req.user.id, provider);
  }

  /**
   * 📊 GET OAUTH STATUS
   * ===================
   * Get current user's linked OAuth providers and authentication options
   * Requires JWT authentication
   *
   * Returns:
   * - List of linked providers (Google, Facebook)
   * - Whether user has password set
   * - Whether user can safely unlink providers
   * - Detailed info about each linked provider
   */
  @Get('social/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '📊 Get OAuth status and linked providers',
    description: `
**Get OAuth Status (Requires Authentication)**

Returns information about user's linked OAuth providers and authentication options.

**Response includes:**
- List of linked providers (google, facebook)
- Whether user has password set
- Whether user can safely unlink providers
- Details about each linked account

**Use Cases:**
- Display linked accounts in user profile
- Show "Link Google" button if not linked
- Disable "Unlink" button if it would lock user out
- Account security dashboard
`,
  })
  @ApiResponse({
    status: 200,
    description: 'OAuth status retrieved successfully',
    schema: {
      example: {
        success: true,
        linkedProviders: ['google', 'facebook'],
        hasPassword: true,
        canUnlink: true,
        details: {
          google: {
            linkedAt: '2024-11-01T10:30:00Z',
            email: 'john.doe@gmail.com',
            googleId: '1234567890',
          },
          facebook: {
            linkedAt: '2024-10-15T14:20:00Z',
            email: 'john.doe@facebook.com',
            facebookId: '9876543210',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'JWT token invalid' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getOAuthStatus(@Request() req: AuthenticatedRequest) {
    return this.authService.getOAuthStatus(req.user.id);
  }
}
