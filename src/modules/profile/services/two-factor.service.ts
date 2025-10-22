import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * TwoFactorService
 *
 * Manages two-factor authentication (2FA) with TOTP.
 * Provides methods for enabling/disabling 2FA, verifying TOTP codes, and managing backup codes.
 */
@Injectable()
export class TwoFactorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enable 2FA - Step 1: Generate TOTP secret and QR code
   * @param userId User ID
   * @returns QR code data URL, secret, and otpauth URL
   */
  async enable2FA(userId: string) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled',
      );
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `MASH Backend (${user.email})`,
      issuer: 'MASH',
      length: 32,
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret temporarily (not enabled yet)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret.base32,
      },
    });

    return {
      qrCodeUrl,
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      message:
        'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)',
    };
  }

  /**
   * Enable 2FA - Step 2: Verify TOTP code and enable 2FA
   * @param userId User ID
   * @param token 6-digit TOTP code from authenticator app
   * @returns Success message and backup codes (shown only once)
   */
  async verify2FA(userId: string, token: string) {
    // Get user with temporary secret
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException(
        'Two-factor authentication setup not started. Call enable2FA first.',
      );
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled',
      );
    }

    // Verify TOTP code
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps (60 seconds) of drift
    });

    if (!verified) {
      throw new BadRequestException(
        'Invalid verification code. Please try again.',
      );
    }

    // Generate 10 backup codes
    const backupCodes: string[] = [];
    const hashedBackupCodes: string[] = [];

    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(5).toString('hex'); // 10 characters
      backupCodes.push(code);
      const hashedCode = await bcrypt.hash(code, 10);
      hashedBackupCodes.push(hashedCode);
    }

    // Enable 2FA and store hashed backup codes
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: hashedBackupCodes,
      },
    });

    return {
      enabled: true,
      backupCodes,
      message:
        '⚠️ Two-factor authentication enabled! Save these backup codes in a secure place. They will only be shown once.',
    };
  }

  /**
   * Disable 2FA
   * @param userId User ID
   * @returns Success message
   */
  async disable2FA(userId: string) {
    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    // Disable 2FA and clear secret and backup codes
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });

    return {
      disabled: true,
      message: 'Two-factor authentication has been disabled',
    };
  }

  /**
   * Regenerate backup codes
   * @param userId User ID
   * @returns New backup codes (shown only once)
   */
  async regenerateBackupCodes(userId: string) {
    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    // Generate 10 new backup codes
    const backupCodes: string[] = [];
    const hashedBackupCodes: string[] = [];

    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(5).toString('hex'); // 10 characters
      backupCodes.push(code);
      const hashedCode = await bcrypt.hash(code, 10);
      hashedBackupCodes.push(hashedCode);
    }

    // Replace old backup codes
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorBackupCodes: hashedBackupCodes,
      },
    });

    return {
      backupCodes,
      message:
        '⚠️ New backup codes generated! Save these in a secure place. They will only be shown once.',
    };
  }

  /**
   * Verify TOTP code for authentication
   * @param userId User ID
   * @param token 6-digit TOTP code
   * @returns Verification result
   */
  async verifyTOTP(userId: string, token: string): Promise<boolean> {
    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }

    // Verify TOTP code
    return speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps (60 seconds) of drift
    });
  }

  /**
   * Verify backup code for authentication
   * @param userId User ID
   * @param code Backup code
   * @returns Verification result and remaining backup codes count
   */
  async verifyBackupCode(userId: string, code: string) {
    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    // Check if backup codes exist
    if (!user.twoFactorBackupCodes || user.twoFactorBackupCodes.length === 0) {
      throw new BadRequestException('No backup codes available');
    }

    // Compare backup code with hashed codes
    let matchedIndex = -1;
    for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
      const match = await bcrypt.compare(code, user.twoFactorBackupCodes[i]);
      if (match) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      throw new BadRequestException('Invalid backup code');
    }

    // Remove used backup code
    const updatedBackupCodes = [...user.twoFactorBackupCodes];
    updatedBackupCodes.splice(matchedIndex, 1);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorBackupCodes: updatedBackupCodes,
      },
    });

    return {
      valid: true,
      remaining: updatedBackupCodes.length,
      message: `Backup code used successfully. ${updatedBackupCodes.length} backup codes remaining.`,
    };
  }

  /**
   * Get 2FA status for a user
   * @param userId User ID
   * @returns 2FA status and backup codes count
   */
  async get2FAStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      enabled: user.twoFactorEnabled,
      backupCodesCount: user.twoFactorBackupCodes?.length || 0,
    };
  }
}
