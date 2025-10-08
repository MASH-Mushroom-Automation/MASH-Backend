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
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
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
