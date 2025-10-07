import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileService } from './profile.service';
import { AvatarService } from './services/avatar.service';
import { SessionManagementService } from './services/session-management.service';
import { ApiKeyService } from './services/api-key.service';
import { SecurityLogService } from './services/security-log.service';
import { TwoFactorService } from './services/two-factor.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Profile')
@Controller('profile')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth()
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly avatarService: AvatarService,
    private readonly sessionService: SessionManagementService,
    private readonly apiKeyService: ApiKeyService,
    private readonly securityLogService: SecurityLogService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.profileService.getProfile(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(userId, updateProfileDto);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get user preferences' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User preferences retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.profileService.getPreferences(userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferences updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid preferences data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ) {
    return this.profileService.updatePreferences(userId, updatePreferencesDto);
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Avatar uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file or file validation failed',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const imageUrl = await this.avatarService.uploadAvatar(userId, file);
    return {
      imageUrl,
      message: 'Avatar uploaded successfully',
    };
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Delete user avatar' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Avatar deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User does not have an avatar',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async deleteAvatar(@CurrentUser('id') userId: string) {
    await this.avatarService.deleteAvatar(userId);
    return {
      message: 'Avatar deleted successfully',
    };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get all active sessions for current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User sessions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              token: { type: 'string', description: 'Masked token' },
              deviceInfo: { type: 'object' },
              ipAddress: { type: 'string' },
              userAgent: { type: 'string' },
              lastActivity: { type: 'string', format: 'date-time' },
              expiresAt: { type: 'string', format: 'date-time' },
              createdAt: { type: 'string', format: 'date-time' },
              isCurrent: { type: 'boolean' },
            },
          },
        },
        stats: {
          type: 'object',
          properties: {
            active: { type: 'number' },
            total: { type: 'number' },
            revoked: { type: 'number' },
            expired: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async getSessions(@CurrentUser('id') userId: string) {
    const [sessions, stats] = await Promise.all([
      this.sessionService.getUserSessions(userId),
      this.sessionService.getSessionStats(userId),
    ]);

    return {
      sessions,
      stats,
    };
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiParam({
    name: 'id',
    description: 'Session ID to revoke',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session revoked successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        sessionId: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not authorized to revoke this session',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot revoke current session or session already revoked',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    return this.sessionService.revokeSession(userId, sessionId);
  }

  @Delete('sessions')
  @ApiOperation({ summary: 'Logout from all devices (revoke all sessions except current)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All sessions revoked successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        count: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async revokeAllSessions(@CurrentUser('id') userId: string) {
    return this.sessionService.revokeAllSessions(userId);
  }

  // ==================== API Key Management ====================

  @Get('api-keys')
  @ApiOperation({ summary: 'List all active API keys (masked)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'API keys retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          maskedKey: { type: 'string', example: 'mash_sk_1234...abcd' },
          scopes: { type: 'array', items: { type: 'string' } },
          lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async listApiKeys(@CurrentUser('id') userId: string) {
    return this.apiKeyService.listApiKeys(userId);
  }

  @Post('api-keys')
  @ApiOperation({ 
    summary: 'Generate a new API key',
    description: '⚠️ The full API key will ONLY be shown once. Save it securely!',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'API key generated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        fullKey: { type: 'string', example: 'mash_sk_abc123def456...' },
        keyPrefix: { type: 'string', example: 'mash_sk_abc1' },
        scopes: { type: 'array', items: { type: 'string' } },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        warning: { 
          type: 'string', 
          example: 'This is the only time you will see the full API key. Please save it securely.' 
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async createApiKey(
    @CurrentUser('id') userId: string,
    @Body() createApiKeyDto: CreateApiKeyDto,
  ) {
    const { name, scopes, expiresAt } = createApiKeyDto;
    return this.apiKeyService.generateApiKey(
      userId,
      name,
      scopes,
      expiresAt ? new Date(expiresAt) : undefined,
    );
  }

  @Delete('api-keys/:id')
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({
    name: 'id',
    description: 'API key ID to revoke',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'API key revoked successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        keyId: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'API key not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request (key already revoked or unauthorized)',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async revokeApiKey(
    @CurrentUser('id') userId: string,
    @Param('id') keyId: string,
  ) {
    return this.apiKeyService.revokeApiKey(userId, keyId, 'User revoked API key');
  }

  // ==================== Security Audit Trail ====================

  @Get('security-log')
  @ApiOperation({
    summary: 'Get security audit trail',
    description: 'View security events and login history with filtering options',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Security log retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        logs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'cm5xyz789' },
              event: { type: 'string', example: 'LOGIN' },
              severity: { type: 'string', example: 'INFO', enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] },
              ipAddress: { type: 'string', example: '192.168.1.100' },
              userAgent: { type: 'string', example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...' },
              metadata: {
                type: 'object',
                example: { device: 'Desktop', browser: 'Chrome', os: 'Windows' },
              },
              timestamp: { type: 'string', format: 'date-time', example: '2025-10-07T10:30:00.000Z' },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 50 },
            total: { type: 'number', example: 247 },
            totalPages: { type: 'number', example: 5 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async getSecurityLog(
    @CurrentUser('id') userId: string,
    @Req() req: any,
  ) {
    // Extract query params
    const action = req.query?.action;
    const dateFrom = req.query?.dateFrom ? new Date(req.query.dateFrom) : undefined;
    const dateTo = req.query?.dateTo ? new Date(req.query.dateTo) : undefined;
    const severity = req.query?.severity;
    const page = req.query?.page ? parseInt(req.query.page, 10) : 1;
    const limit = req.query?.limit ? parseInt(req.query.limit, 10) : 50;

    return this.securityLogService.getSecurityLog(userId, {
      action,
      dateFrom,
      dateTo,
      severity,
      page,
      limit,
    });
  }

  // ==================== Two-Factor Authentication (2FA) ====================

  @Post('2fa/enable')
  @ApiOperation({
    summary: 'Enable 2FA - Step 1: Generate QR code',
    description: 'Generate TOTP secret and QR code for authenticator app setup',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'QR code generated successfully',
    schema: {
      type: 'object',
      properties: {
        qrCodeUrl: {
          type: 'string',
          example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
          description: 'QR code as data URL (scan with authenticator app)',
        },
        secret: {
          type: 'string',
          example: 'JBSWY3DPEHPK3PXP',
          description: 'TOTP secret (base32 encoded)',
        },
        otpauthUrl: {
          type: 'string',
          example: 'otpauth://totp/MASH%20Backend%20(user@example.com)?secret=JBSWY3DPEHPK3PXP&issuer=MASH',
          description: 'OTPAuth URL for manual entry',
        },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '2FA already enabled',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async enable2FA(@CurrentUser('id') userId: string) {
    return this.twoFactorService.enable2FA(userId);
  }

  @Post('2fa/verify')
  @ApiOperation({
    summary: 'Enable 2FA - Step 2: Verify TOTP code',
    description: 'Verify 6-digit TOTP code and enable 2FA. Returns backup codes (shown only once).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '2FA enabled successfully',
    schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', example: true },
        backupCodes: {
          type: 'array',
          items: { type: 'string' },
          example: ['abc1234567', 'def8901234', 'ghi5678901'],
          description: '⚠️ Backup codes (shown only once)',
        },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid TOTP code or 2FA setup not started',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async verify2FA(
    @CurrentUser('id') userId: string,
    @Body() verifyDto: Verify2FADto,
  ) {
    return this.twoFactorService.verify2FA(userId, verifyDto.token);
  }

  @Delete('2fa/disable')
  @ApiOperation({
    summary: 'Disable 2FA',
    description: 'Disable two-factor authentication (clears secret and backup codes)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '2FA disabled successfully',
    schema: {
      type: 'object',
      properties: {
        disabled: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Two-factor authentication has been disabled' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '2FA not enabled',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async disable2FA(@CurrentUser('id') userId: string) {
    return this.twoFactorService.disable2FA(userId);
  }

  @Post('2fa/backup-codes')
  @ApiOperation({
    summary: 'Regenerate backup codes',
    description: 'Generate new backup codes (invalidates old ones). Shown only once.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Backup codes regenerated successfully',
    schema: {
      type: 'object',
      properties: {
        backupCodes: {
          type: 'array',
          items: { type: 'string' },
          example: ['xyz1234567', 'uvw8901234', 'rst5678901'],
          description: '⚠️ New backup codes (shown only once)',
        },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '2FA not enabled',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async regenerateBackupCodes(@CurrentUser('id') userId: string) {
    return this.twoFactorService.regenerateBackupCodes(userId);
  }
}
