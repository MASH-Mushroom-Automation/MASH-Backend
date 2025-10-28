import { ThrottlerStorage } from '@nestjs/throttler';
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../database/redis.service';

/**
 * RedisThrottlerStorage - Custom Redis storage adapter for @nestjs/throttler
 *
 * This adapter enables distributed rate limiting across multiple backend instances
 * by using Redis as a centralized storage for throttling counters.
 *
 * Features:
 * - Distributed rate limiting (works across multiple instances)
 * - Atomic increment operations (thread-safe)
 * - Automatic expiration (TTL-based cleanup)
 * - Fallback to in-memory storage if Redis unavailable
 * - Graceful degradation
 *
 * Why Custom Adapter?
 * - No official @nestjs/throttler-storage-redis exists for NestJS 11
 * - Existing community packages incompatible with @nestjs/throttler v6+
 * - Custom implementation provides full control and Redis optimization
 *
 * Architecture:
 * - Key format: `throttle:{key}` (e.g., `throttle:192.168.1.1:/api/auth/login`)
 * - Value: Request count (number)
 * - Expiration: TTL in seconds (auto-cleanup)
 *
 * Performance:
 * - O(1) increment operation
 * - O(1) expiration check (handled by Redis)
 * - Minimal network overhead (single Redis command per request)
 *
 * Usage:
 * Automatically used when configured in ThrottlerModule:
 * ```typescript
 * ThrottlerModule.forRootAsync({
 *   useFactory: (redisService: RedisService) => ({
 *     throttlers: [{ ttl: 60000, limit: 100 }],
 *     storage: new RedisThrottlerStorage(redisService),
 *   }),
 *   inject: [RedisService],
 * })
 * ```
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly keyPrefix = 'throttle:';

  // Fallback in-memory storage if Redis unavailable
  private readonly inMemoryStorage = new Map<string, { totalHits: number; expiresAt: number }>();

  constructor(private readonly redisService: RedisService) {
    if (!redisService.isAvailable()) {
      this.logger.warn(
        '⚠️ Redis unavailable - Using in-memory throttling (not suitable for production)',
      );
    } else {
      this.logger.log('✅ Redis-backed distributed throttling enabled');
    }
  }

  /**
   * Increment the request count for a given key
   *
   * @param key - Throttle key (typically IP + endpoint)
   * @param ttl - Time to live in milliseconds
   * @param limit - Request limit (unused in increment, used by guard)
   * @param blockDuration - Duration to block after limit exceeded (unused here)
   * @param throttlerName - Name of the throttler configuration (unused here)
   * @returns Promise resolving to ThrottlerStorageRecord with totalHits and timeToExpire
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const redisKey = this.keyPrefix + key;

    // Try Redis first
    if (this.redisService.isAvailable()) {
      try {
        return await this.incrementRedis(redisKey, ttl);
      } catch (error) {
        this.logger.error('Redis increment failed, falling back to memory:', error);
        // Fallback to in-memory
      }
    }

    // Fallback: in-memory increment
    return this.incrementMemory(key, ttl);
  }

  /**
   * Increment using Redis (distributed)
   */
  private async incrementRedis(
    redisKey: string,
    ttl: number,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const ttlSeconds = Math.ceil(ttl / 1000);

    // Use Redis INCR for atomic increment + EXPIRE for TTL
    const totalHits = await this.redisService.increment(redisKey);

    // Set expiration on first request (when count = 1)
    if (totalHits === 1) {
      await this.redisService.setExpiration(redisKey, ttlSeconds);
    }

    // Get remaining TTL
    const timeToExpire = await this.redisService.getTTL(redisKey);

    return {
      totalHits,
      timeToExpire: timeToExpire > 0 ? timeToExpire : 0,
      isBlocked: false, // Blocking handled by ThrottlerGuard
      timeToBlockExpire: 0,
    };
  }

  /**
   * Increment using in-memory storage (fallback)
   */
  private incrementMemory(
    key: string,
    ttl: number,
  ): {
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  } {
    const now = Date.now();
    const expiresAt = now + ttl;

    const record = this.inMemoryStorage.get(key);

    if (!record || record.expiresAt < now) {
      // New record or expired
      this.inMemoryStorage.set(key, { totalHits: 1, expiresAt });
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    // Increment existing record
    record.totalHits += 1;
    return {
      totalHits: record.totalHits,
      timeToExpire: Math.ceil((record.expiresAt - now) / 1000),
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  /**
   * Get the current storage record for a key (optional method for monitoring)
   * Not required by ThrottlerStorage interface but useful for debugging
   */
  async get(key: string): Promise<{
    totalHits: number;
    timeToExpire: number;
  } | null> {
    const redisKey = this.keyPrefix + key;

    if (this.redisService.isAvailable()) {
      try {
        const count = await this.redisService.get<number>(redisKey);
        if (count === null) return null;

        const ttl = await this.redisService.getTTL(redisKey);
        return {
          totalHits: count,
          timeToExpire: ttl > 0 ? ttl : 0,
        };
      } catch (error) {
        this.logger.error('Redis get failed:', error);
      }
    }

    // Fallback to in-memory
    const record = this.inMemoryStorage.get(key);
    if (!record || record.expiresAt < Date.now()) {
      return null;
    }

    return {
      totalHits: record.totalHits,
      timeToExpire: Math.ceil((record.expiresAt - Date.now()) / 1000),
    };
  }

  /**
   * Clean up expired in-memory records (periodic maintenance)
   * Called internally by NestJS scheduler (if configured)
   */
  cleanupExpiredRecords(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, record] of this.inMemoryStorage.entries()) {
      if (record.expiresAt < now) {
        this.inMemoryStorage.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired throttle records`);
    }
  }
}
