import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { PrometheusService } from '../../../../monitoring/prometheus/prometheus.service';
import { RateLimitStrategy } from '@prisma/client';
import { TokenBucketStrategy } from '../strategies/token-bucket.strategy';
import { LeakyBucketStrategy } from '../strategies/leaky-bucket.strategy';
import { SlidingWindowStrategy } from '../strategies/sliding-window.strategy';
import {
  IRateLimitStrategy,
  IRateLimitConfig,
  IRateLimitResult,
} from '../interfaces/rate-limit-strategy.interface';
import {
  CreateRateLimitOverrideDto,
  UpdateRateLimitOverrideDto,
} from '../dto/rate-limit-override.dto';

/**
 * DynamicRateLimitService
 *
 * Manages dynamic rate limiting with per-user/API-key custom limits
 *
 * Features:
 * - Per-user custom rate limits
 * - API key-based limits
 * - Endpoint-specific overrides
 * - Priority-based limit selection
 * - Multiple strategies (token bucket, leaky bucket, sliding window)
 * - Database persistence
 * - Prometheus metrics
 *
 * Priority System:
 * - Higher priority overrides are checked first
 * - User-specific overrides > Endpoint overrides > Default limits
 * - Expired overrides are automatically ignored
 *
 * Strategy Selection:
 * - TOKEN_BUCKET: Best for APIs allowing bursts
 * - LEAKY_BUCKET: Best for smooth processing rate
 * - SLIDING_WINDOW: Most accurate, prevents gaming
 *
 * Usage:
 * ```typescript
 * const result = await dynamicRateLimit.checkLimit(
 *   'user_123',
 *   '/api/v1/orders',
 *   'POST'
 * );
 * if (!result.allowed) {
 *   throw new TooManyRequestsException();
 * }
 * ```
 */
@Injectable()
export class DynamicRateLimitService {
  private readonly logger = new Logger(DynamicRateLimitService.name);
  private readonly strategies: Map<RateLimitStrategy, IRateLimitStrategy>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly prometheus: PrometheusService,
    private readonly tokenBucket: TokenBucketStrategy,
    private readonly leakyBucket: LeakyBucketStrategy,
    private readonly slidingWindow: SlidingWindowStrategy,
  ) {
    // Initialize strategy registry with proper typing
    this.strategies = new Map<RateLimitStrategy, IRateLimitStrategy>();
    this.strategies.set(RateLimitStrategy.TOKEN_BUCKET, tokenBucket);
    this.strategies.set(RateLimitStrategy.LEAKY_BUCKET, leakyBucket);
    this.strategies.set(RateLimitStrategy.SLIDING_WINDOW, slidingWindow);

    this.logger.log('Initialized with 3 rate limiting strategies');
  }

  /**
   * Check if request should be rate limited
   *
   * Priority order:
   * 1. User + Endpoint override
   * 2. Endpoint override
   * 3. User global override
   * 4. Default limit
   */
  async checkLimit(
    userId: string | null,
    endpoint: string,
    method: string,
  ): Promise<IRateLimitResult> {
    const startMs = Date.now();

    try {
      // Find applicable override (highest priority)
      const override = await this.findApplicableOverride(userId, endpoint);

      let config: IRateLimitConfig;
      let strategy: IRateLimitStrategy;
      let key: string;

      if (override) {
        // Use custom override
        config = {
          limit: override.requestLimit,
          windowMs: override.timeWindowMs,
        };
        strategy = this.strategies.get(override.strategy)!;
        key = this.buildRateLimitKey(userId, endpoint, method, 'custom');

        this.logger.debug(
          `Using custom override for ${userId || 'anonymous'}:${endpoint} - ` +
            `${override.requestLimit} req/${override.timeWindowMs}ms`,
        );
      } else {
        // Use default limits (from existing throttler config)
        config = {
          limit: 100, // Default from THROTTLER_TIERS.DEFAULT
          windowMs: 60000, // 1 minute
        };
        strategy = this.strategies.get(RateLimitStrategy.TOKEN_BUCKET)!;
        key = this.buildRateLimitKey(userId, endpoint, method, 'default');
      }

      // Execute rate limit check
      const result = await strategy.checkLimit(key, config);

      // Record metrics
      this.prometheus.rateLimitViolationsTotal.inc({
        endpoint,
        strategy: strategy.getName(),
        allowed: result.allowed ? 'yes' : 'no',
      });

      const durationMs = Date.now() - startMs;
      this.logger.debug(
        `Rate limit check completed in ${durationMs}ms: ${result.allowed ? 'ALLOWED' : 'DENIED'}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Rate limit check failed for ${userId}:${endpoint}`, error);
      // Fail open (allow request) if rate limiting fails
      return {
        allowed: true,
        current: 0,
        limit: 0,
        remaining: 0,
        resetMs: 0,
      };
    }
  }

  /**
   * Find most applicable rate limit override
   *
   * Priority:
   * 1. User + Endpoint
   * 2. Endpoint only
   * 3. User only
   */
  private async findApplicableOverride(userId: string | null, endpoint: string) {
    const now = new Date();

    // Build where clauses
    const where = {
      OR: [
        // User + Endpoint specific
        ...(userId
          ? [
              {
                userId,
                endpoint,
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gte: now } }, // Not expired
                ],
              },
            ]
          : []),
        // Endpoint only (any user)
        {
          userId: null,
          endpoint,
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        // User only (any endpoint)
        ...(userId
          ? [
              {
                userId,
                endpoint: '*', // Wildcard
                OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
              },
            ]
          : []),
      ],
    };

    // Find override with highest priority
    const override = await this.prisma.rateLimitOverride.findFirst({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return override;
  }

  /**
   * Build rate limit key for storage
   */
  private buildRateLimitKey(
    userId: string | null,
    endpoint: string,
    method: string,
    type: 'custom' | 'default',
  ): string {
    const userPart = userId || 'anonymous';
    return `ratelimit:${type}:${userPart}:${method}:${endpoint}`;
  }

  /**
   * Create new rate limit override
   */
  async createOverride(dto: CreateRateLimitOverrideDto) {
    const override = await this.prisma.rateLimitOverride.create({
      data: {
        userId: dto.userId,
        apiKey: dto.apiKey,
        endpoint: dto.endpoint,
        requestLimit: dto.requestLimit,
        timeWindowMs: dto.timeWindowMs,
        strategy: dto.strategy,
        priority: dto.priority || 0,
        reason: dto.reason,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    this.logger.log(
      `Created rate limit override: ${override.id} for ${dto.userId || 'anonymous'}:${dto.endpoint}`,
    );

    return override;
  }

  /**
   * Update existing override
   */
  async updateOverride(id: string, dto: UpdateRateLimitOverrideDto) {
    const override = await this.prisma.rateLimitOverride.findUnique({
      where: { id },
    });

    if (!override) {
      throw new NotFoundException(`Rate limit override ${id} not found`);
    }

    const updated = await this.prisma.rateLimitOverride.update({
      where: { id },
      data: {
        requestLimit: dto.requestLimit,
        timeWindowMs: dto.timeWindowMs,
        strategy: dto.strategy,
        priority: dto.priority,
        reason: dto.reason,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    this.logger.log(`Updated rate limit override: ${id}`);

    return updated;
  }

  /**
   * Delete override
   */
  async deleteOverride(id: string) {
    const override = await this.prisma.rateLimitOverride.findUnique({
      where: { id },
    });

    if (!override) {
      throw new NotFoundException(`Rate limit override ${id} not found`);
    }

    await this.prisma.rateLimitOverride.delete({ where: { id } });

    this.logger.log(`Deleted rate limit override: ${id}`);

    return override;
  }

  /**
   * Get all overrides (with pagination)
   */
  async getOverrides(skip = 0, take = 50) {
    const [overrides, total] = await Promise.all([
      this.prisma.rateLimitOverride.findMany({
        skip,
        take,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
      }),
      this.prisma.rateLimitOverride.count(),
    ]);

    return { overrides, total, skip, take };
  }

  /**
   * Get overrides for specific user
   */
  async getUserOverrides(userId: string) {
    return this.prisma.rateLimitOverride.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Clean up expired overrides (cron job)
   */
  async cleanupExpiredOverrides() {
    const result = await this.prisma.rateLimitOverride.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired rate limit overrides`);

    return result.count;
  }
}
