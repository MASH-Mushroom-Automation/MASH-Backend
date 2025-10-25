import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../database/redis.service';
import {
  IRateLimitStrategy,
  IRateLimitConfig,
  IRateLimitResult,
} from '../interfaces/rate-limit-strategy.interface';

/**
 * TokenBucketStrategy - Token Bucket Rate Limiting Algorithm
 *
 * How it works:
 * - Tokens are added to a bucket at a fixed rate (refill rate)
 * - Each request consumes 1 token
 * - If bucket is empty, request is rejected
 * - Allows bursts up to bucket capacity
 *
 * Use Cases:
 * - APIs that allow occasional bursts (e.g., batch operations)
 * - User-facing endpoints with variable traffic
 * - Services where flexibility is more important than strict rate control
 *
 * Example:
 * - Limit: 100 tokens, Refill: 10 tokens/second
 * - User can make 100 requests instantly (burst)
 * - Then limited to 10 requests/second sustained
 *
 * Advantages:
 * - Allows bursts (better UX)
 * - Simple to implement
 * - Efficient (constant time operations)
 *
 * Disadvantages:
 * - Can allow large bursts that may overwhelm downstream
 * - More complex than fixed window
 */
@Injectable()
export class TokenBucketStrategy implements IRateLimitStrategy {
  private readonly KEY_PREFIX = 'ratelimit:tokenbucket:';

  constructor(private readonly redis: RedisService) {}

  getName(): string {
    return 'TOKEN_BUCKET';
  }

  async checkLimit(
    key: string,
    config: IRateLimitConfig,
  ): Promise<IRateLimitResult> {
    const storeKey = `${this.KEY_PREFIX}${key}`;
    const now = Date.now();

    // Get or initialize bucket state
    const stateJson = await this.redis.get(storeKey);
    let state: {
      tokens: number;
      lastRefillMs: number;
    };

    if (stateJson) {
      state = JSON.parse(stateJson);
    } else {
      // Initialize with full bucket
      state = {
        tokens: config.limit,
        lastRefillMs: now,
      };
    }

    // Calculate tokens to add based on time elapsed
    const refillRate = config.options?.refillRate || config.limit; // tokens per windowMs
    const elapsedMs = now - state.lastRefillMs;
    const tokensToAdd = (elapsedMs / config.windowMs) * refillRate;

    // Refill bucket (up to max capacity)
    state.tokens = Math.min(config.limit, state.tokens + tokensToAdd);
    state.lastRefillMs = now;

    // Check if we have tokens
    const allowed = state.tokens >= 1;

    if (allowed) {
      // Consume 1 token
      state.tokens -= 1;
    }

    // Calculate time until next token
    const msPerToken = config.windowMs / refillRate;
    const resetMs = allowed ? msPerToken : msPerToken * (1 - state.tokens);

    // Save state
    await this.redis.set(
      storeKey,
      JSON.stringify(state),
      config.windowMs * 2, // TTL: 2x window to handle refill
    );

    return {
      allowed,
      current: config.limit - Math.floor(state.tokens),
      limit: config.limit,
      remaining: Math.floor(state.tokens),
      resetMs: Math.ceil(resetMs),
      retryAfterMs: allowed ? undefined : Math.ceil(resetMs),
      metadata: {
        bucketLevel: state.tokens,
        lastUpdateMs: state.lastRefillMs,
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

    const state = JSON.parse(stateJson);
    const ttl = await this.redis.getTTL(storeKey);

    return {
      allowed: state.tokens >= 1,
      current: 0, // Not tracked in state
      limit: 0, // Not tracked in state
      remaining: Math.floor(state.tokens),
      resetMs: ttl * 1000,
      metadata: {
        bucketLevel: state.tokens,
        lastUpdateMs: state.lastRefillMs,
      },
    };
  }
}
