import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../database/redis.service';
import {
  IRateLimitStrategy,
  IRateLimitConfig,
  IRateLimitResult,
} from '../interfaces/rate-limit-strategy.interface';

/**
 * LeakyBucketStrategy - Leaky Bucket Rate Limiting Algorithm
 *
 * How it works:
 * - Requests are added to a bucket queue
 * - Bucket "leaks" (processes requests) at a constant rate
 * - If bucket is full, new requests are rejected
 * - Smooths out traffic spikes
 *
 * Use Cases:
 * - APIs that need consistent processing rate
 * - Protecting downstream services with fixed capacity
 * - When you want to eliminate bursts entirely
 * - Background job queues
 *
 * Example:
 * - Leak rate: 10 requests/second, Capacity: 50 requests
 * - System processes exactly 10 requests/second
 * - Can queue up to 50 requests waiting
 * - Excess requests rejected immediately
 *
 * Advantages:
 * - Smooth, predictable processing rate
 * - Good for protecting backend services
 * - Eliminates traffic spikes
 *
 * Disadvantages:
 * - No bursts allowed (can frustrate users)
 * - More complex than token bucket
 * - Requires tracking queue
 */
@Injectable()
export class LeakyBucketStrategy implements IRateLimitStrategy {
  private readonly KEY_PREFIX = 'ratelimit:leakybucket:';

  constructor(private readonly redis: RedisService) {}

  getName(): string {
    return 'LEAKY_BUCKET';
  }

  async checkLimit(key: string, config: IRateLimitConfig): Promise<IRateLimitResult> {
    const storeKey = `${this.KEY_PREFIX}${key}`;
    const now = Date.now();

    // Get or initialize bucket state
    const stateJson = await this.redis.get(storeKey);
    let state: {
      queueSize: number;
      lastLeakMs: number;
    };

    if (stateJson) {
      state = JSON.parse(stateJson as string);
    } else {
      // Initialize empty bucket
      state = {
        queueSize: 0,
        lastLeakMs: now,
      };
    }

    // Calculate leak rate (requests per millisecond)
    const leakRate = (config.options?.leakRate || config.limit / (config.windowMs / 1000)) / 1000;
    const elapsedMs = now - state.lastLeakMs;
    const leaked = Math.floor(elapsedMs * leakRate);

    // Leak from bucket
    state.queueSize = Math.max(0, state.queueSize - leaked);
    state.lastLeakMs = now;

    // Check if bucket has capacity
    const allowed = state.queueSize < config.limit;

    if (allowed) {
      // Add request to bucket
      state.queueSize += 1;
    }

    // Calculate time until bucket has space
    const timeUntilSpaceMs = allowed ? 0 : (state.queueSize - config.limit + 1) / leakRate;

    // Save state
    await this.redis.set(storeKey, JSON.stringify(state), config.windowMs * 2);

    return {
      allowed,
      current: state.queueSize,
      limit: config.limit,
      remaining: Math.max(0, config.limit - state.queueSize),
      resetMs: Math.ceil(timeUntilSpaceMs),
      retryAfterMs: allowed ? undefined : Math.ceil(timeUntilSpaceMs),
      metadata: {
        bucketLevel: state.queueSize,
        lastUpdateMs: state.lastLeakMs,
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

    const state = JSON.parse(stateJson as string);
    const ttl = await this.redis.getTTL(storeKey);

    return {
      allowed: state.queueSize < 100, // Placeholder
      current: state.queueSize,
      limit: 100, // Placeholder
      remaining: Math.max(0, 100 - state.queueSize),
      resetMs: ttl * 1000,
      metadata: {
        bucketLevel: state.queueSize,
        lastUpdateMs: state.lastLeakMs,
      },
    };
  }
}
