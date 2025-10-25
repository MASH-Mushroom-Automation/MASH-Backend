import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../database/redis.service';
import {
  IRateLimitStrategy,
  IRateLimitConfig,
  IRateLimitResult,
} from '../interfaces/rate-limit-strategy.interface';

/**
 * SlidingWindowStrategy - Sliding Window Log Rate Limiting Algorithm
 *
 * How it works:
 * - Maintains a log of all request timestamps in current window
 * - Slides the window forward with each request
 * - Removes expired timestamps from the log
 * - Most accurate rate limiting algorithm
 *
 * Use Cases:
 * - When accuracy is critical (financial APIs, payment processing)
 * - High-security endpoints
 * - When you need to avoid fixed window reset spikes
 * - SLA enforcement
 *
 * Example:
 * - Limit: 100 requests/minute
 * - At any point, count requests in last 60 seconds
 * - No reset spike at minute boundaries
 * - Perfectly smooth enforcement
 *
 * Advantages:
 * - Most accurate rate limiting
 * - No reset spikes
 * - Fair to all users
 * - Prevents gaming the system
 *
 * Disadvantages:
 * - Higher memory usage (stores all timestamps)
 * - More CPU intensive (needs to clean old entries)
 * - More Redis operations
 */
@Injectable()
export class SlidingWindowStrategy implements IRateLimitStrategy {
  private readonly KEY_PREFIX = 'ratelimit:slidingwindow:';

  constructor(private readonly redis: RedisService) {}

  getName(): string {
    return 'SLIDING_WINDOW';
  }

  async checkLimit(
    key: string,
    config: IRateLimitConfig,
  ): Promise<IRateLimitResult> {
    const storeKey = `${this.KEY_PREFIX}${key}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get existing timestamps
    const stateJson = await this.redis.get(storeKey);
    let timestamps: number[] = [];

    if (stateJson) {
      timestamps = JSON.parse(stateJson as string);
    }

    // Remove expired timestamps (outside window)
    timestamps = timestamps.filter((ts) => ts > windowStart);

    // Check if we're within limit
    const allowed = timestamps.length < config.limit;

    if (allowed) {
      // Add current timestamp
      timestamps.push(now);
    }

    // Calculate time until oldest request expires
    const oldestTimestamp = timestamps[0] || now;
    const resetMs = Math.max(0, oldestTimestamp + config.windowMs - now);

    // Save updated timestamps
    await this.redis.set(
      storeKey,
      JSON.stringify(timestamps),
      config.windowMs + 1000, // TTL: window + 1 second buffer
    );

    return {
      allowed,
      current: timestamps.length,
      limit: config.limit,
      remaining: Math.max(0, config.limit - timestamps.length),
      resetMs: Math.ceil(resetMs),
      retryAfterMs: allowed ? undefined : Math.ceil(resetMs),
      metadata: {
        windowRequests: timestamps,
        lastUpdateMs: now,
      },
    };
  }

  async reset(key: string): Promise<void> {
    const storeKey = `${this.KEY_PREFIX}${key}`;
    await this.redis.delete(storeKey);
  }

  async getState(key: string): Promise<IRateLimitResult | null> {
    const storeKey = `${this.KEY_PREFIX}${key}`;
    const stateJson = await this.redis.get(storeKey);

    if (!stateJson) {
      return null;
    }

    const timestamps = JSON.parse(stateJson as string);
    const ttl = await this.redis.getTTL(storeKey);

    return {
      allowed: timestamps.length < 100, // Placeholder
      current: timestamps.length,
      limit: 100, // Placeholder
      remaining: Math.max(0, 100 - timestamps.length),
      resetMs: ttl * 1000,
      metadata: {
        windowRequests: timestamps,
        lastUpdateMs: Date.now(),
      },
    };
  }
}
