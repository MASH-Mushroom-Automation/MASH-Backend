import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../../database/redis.service';
import {
  IRateLimitStrategy,
  IRateLimitConfig,
  IRateLimitResult,
} from '../interfaces/rate-limit-strategy.interface';

/**
 * Fixed Window Rate Limiting Strategy
 *
 * Algorithm:
 * - Counter resets at fixed time intervals (windows)
 * - Simple increment counter for each request
 * - When counter reaches limit, reject requests
 * - Counter resets to 0 when window expires
 *
 * Example (100 requests per minute):
 * - Window: 00:00:00 - 00:01:00
 * - Requests: 1, 2, 3, ..., 100 (all allowed)
 * - Request 101: DENIED (limit reached)
 * - At 00:01:00: Counter resets to 0
 * - Window: 00:01:00 - 00:02:00 (fresh start)
 *
 * Advantages:
 * - Simplest algorithm (minimal code)
 * - Lowest memory usage (single counter)
 * - Fastest performance (O(1) operations)
 * - Easy to understand and debug
 *
 * Disadvantages:
 * - Reset spike vulnerability (traffic burst at window boundary)
 * - Users can "game" the system by timing requests
 * - Less accurate than sliding window
 * - Unfair to users at window boundaries
 *
 * Reset Spike Example:
 * - User sends 100 requests at 00:00:59 (all allowed)
 * - Window resets at 00:01:00
 * - User sends 100 more at 00:01:01 (all allowed)
 * - Total: 200 requests in 2 seconds (should be limited!)
 *
 * Use Cases:
 * - Low-stakes endpoints (public APIs, read-only data)
 * - Internal APIs with trusted clients
 * - Simple quota enforcement (daily/hourly limits)
 * - High-traffic endpoints needing performance
 *
 * NOT Recommended For:
 * - Authentication endpoints (brute-force attacks)
 * - Payment/financial APIs (requires accuracy)
 * - APIs with malicious users (gaming vulnerability)
 */
@Injectable()
export class FixedWindowStrategy implements IRateLimitStrategy {
  private readonly logger = new Logger(FixedWindowStrategy.name);
  private readonly KEY_PREFIX = 'ratelimit:fixedwindow:';

  constructor(private readonly redis: RedisService) {}

  /**
   * Check if request should be rate limited
   */
  async checkLimit(key: string, config: IRateLimitConfig): Promise<IRateLimitResult> {
    const redisKey = `${this.KEY_PREFIX}${key}`;
    const now = Date.now();

    // Calculate current window start time (aligned to windowMs boundaries)
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    const windowEnd = windowStart + config.windowMs;
    const resetMs = windowEnd - now;

    try {
      // Get current count
      const countStr = await this.redis.get(redisKey);
      const currentCount = countStr && typeof countStr === 'string' ? parseInt(countStr, 10) : 0;

      // Check if limit reached
      const allowed = currentCount < config.limit;

      if (allowed) {
        // Increment counter and set TTL
        const newCount = await this.redis.increment(redisKey);
        // Set expiration only if key is new (first request in window)
        if (newCount === 1) {
          await this.redis.setExpiration(redisKey, Math.ceil(config.windowMs / 1000));
        }

        return {
          allowed: true,
          current: newCount,
          limit: config.limit,
          remaining: Math.max(0, config.limit - newCount),
          resetMs,
          metadata: {
            strategy: 'FIXED_WINDOW',
            windowStart,
          },
        };
      } else {
        // Limit reached - deny request
        return {
          allowed: false,
          current: currentCount,
          limit: config.limit,
          remaining: 0,
          resetMs,
          retryAfterMs: resetMs, // Retry after window resets
          metadata: {
            strategy: 'FIXED_WINDOW',
            windowStart,
            message: 'Rate limit exceeded - wait for window reset',
          },
        };
      }
    } catch (error) {
      this.logger.error(`Fixed window check failed for key ${key}:`, error);
      // Fail open (allow request) on errors
      return {
        allowed: true,
        current: 0,
        limit: config.limit,
        remaining: config.limit,
        resetMs: config.windowMs,
      };
    }
  }

  /**
   * Reset rate limit for key
   */
  async reset(key: string): Promise<void> {
    const redisKey = `${this.KEY_PREFIX}${key}`;
    await this.redis.delete(redisKey);
    this.logger.debug(`Reset fixed window for key: ${key}`);
  }

  /**
   * Get current state
   */
  async getState(key: string): Promise<IRateLimitResult | null> {
    const redisKey = `${this.KEY_PREFIX}${key}`;
    const countStr = await this.redis.get(redisKey);

    if (!countStr) return null;

    const count = countStr && typeof countStr === 'string' ? parseInt(countStr, 10) : 0;
    const ttl = await this.redis.getTTL(redisKey);
    const now = Date.now();
    const windowStart = now - ttl * 1000; // TTL is in seconds

    // Assume default limit for getState (should be passed as param in production)
    const limit = 100;

    return {
      allowed: count < limit,
      current: count,
      limit,
      remaining: Math.max(0, limit - count),
      resetMs: ttl * 1000,
      metadata: {
        strategy: 'FIXED_WINDOW',
        windowStart,
      },
    };
  }

  /**
   * Get strategy name
   */
  getName(): string {
    return 'FIXED_WINDOW';
  }
}
