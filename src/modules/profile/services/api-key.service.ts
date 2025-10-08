import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a new crypto-secure API key
   * Format: mash_sk_{64_random_chars}
   * @returns Full API key (only shown once)
   */
  async generateApiKey(
    userId: string,
    name: string,
    scopes: string[] = [],
    expiresAt?: Date,
  ) {
    // Generate crypto-secure random key
    const randomKey = randomBytes(32).toString('hex'); // 64 chars
    const fullKey = `mash_sk_${randomKey}`;

    // Hash the key with bcrypt for secure storage
    const keyHash = await bcrypt.hash(fullKey, 10);

    // Generate key prefix (first 12 chars) for identification
    const keyPrefix = fullKey.substring(0, 12); // "mash_sk_" + first 4 chars of random

    // Create API key record
    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        name,
        keyHash,
        keyPrefix,
        scopes: scopes.length > 0 ? scopes : ['read'],
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return {
      ...apiKey,
      fullKey, // ⚠️ ONLY SHOWN ONCE - User must save it
      warning:
        'This is the only time you will see the full API key. Please save it securely.',
    };
  }

  /**
   * List all API keys for a user (masked, no full keys returned)
   */
  async listApiKeys(userId: string) {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: {
        userId,
        revokedAt: null, // Only show active keys
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Mask the key prefix (show first 8 chars + last 4)
    return apiKeys.map((key) => ({
      ...key,
      maskedKey: `${key.keyPrefix}...${key.keyPrefix.slice(-4)}`, // e.g., "mash_sk_1234...1234"
    }));
  }

  /**
   * Revoke an API key (soft delete)
   */
  async revokeApiKey(
    userId: string,
    keyId: string,
    reason?: string,
  ): Promise<{ message: string; keyId: string }> {
    // Check if key exists and belongs to user
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: keyId },
      select: { id: true, userId: true, revokedAt: true, name: true },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    if (apiKey.userId !== userId) {
      throw new BadRequestException(
        'You do not have permission to revoke this API key',
      );
    }

    if (apiKey.revokedAt) {
      throw new BadRequestException('API key is already revoked');
    }

    // Soft delete: Set revokedAt timestamp
    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: {
        revokedAt: new Date(),
        revokedReason: reason || 'User revoked API key',
      },
    });

    return {
      message: `API key "${apiKey.name}" revoked successfully`,
      keyId,
    };
  }

  /**
   * Verify an API key and return associated user
   * @param fullKey The full API key string
   */
  async verifyApiKey(fullKey: string) {
    if (!fullKey || !fullKey.startsWith('mash_sk_')) {
      throw new BadRequestException('Invalid API key format');
    }

    // Extract prefix for quick lookup
    const keyPrefix = fullKey.substring(0, 12);

    // Find keys with matching prefix
    const apiKeys = await this.prisma.apiKey.findMany({
      where: {
        keyPrefix,
        revokedAt: null, // Only active keys
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Check if any key matches (using bcrypt compare)
    for (const apiKey of apiKeys) {
      const isValid = await bcrypt.compare(fullKey, apiKey.keyHash);

      if (isValid) {
        // Check expiration
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
          throw new BadRequestException('API key has expired');
        }

        // Update last used timestamp
        await this.prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        });

        return {
          userId: apiKey.userId,
          user: apiKey.user,
          scopes: apiKey.scopes as string[],
          keyId: apiKey.id,
        };
      }
    }

    throw new BadRequestException('Invalid API key');
  }

  /**
   * Get statistics about API keys for a user
   */
  async getApiKeyStats(userId: string) {
    const [total, active, expired, revoked] = await Promise.all([
      this.prisma.apiKey.count({
        where: { userId },
      }),
      this.prisma.apiKey.count({
        where: {
          userId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
      }),
      this.prisma.apiKey.count({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { lt: new Date() },
        },
      }),
      this.prisma.apiKey.count({
        where: {
          userId,
          revokedAt: { not: null },
        },
      }),
    ]);

    return { total, active, expired, revoked };
  }
}
