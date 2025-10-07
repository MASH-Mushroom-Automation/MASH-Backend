import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RedisService - Redis client for caching and session management
 *
 * Features:
 * - Connection management with automatic reconnection
 * - Type-safe get/set operations with TTL
 * - Pattern-based key deletion
 * - Health checks
 * - Graceful shutdown
 *
 * Usage:
 * ```typescript
 * // Cache permissions for 5 minutes
 * await redisService.set('permissions:user123', permissions, 300);
 *
 * // Retrieve cached data
 * const permissions = await redisService.get('permissions:user123');
 *
 * // Delete all permission caches
 * await redisService.deletePattern('permissions:*');
 * ```
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;
  private isConnected = false;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn(
        '⚠️ REDIS_URL not configured - Redis caching disabled',
      );
      // Create a mock client that does nothing
      this.client = null;
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times: number) => {
          if (times > 10) {
            this.logger.error('Redis: Max retries reached, giving up');
            return null;
          }
          const delay = Math.min(times * 50, 2000);
          this.logger.warn(`Redis: Reconnecting in ${delay}ms...`);
          return delay;
        },
      });

      this.client.on('connect', () => {
        this.logger.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('error', (error) => {
        this.logger.error('Redis connection error:', error);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.logger.warn('Redis connection closed');
        this.isConnected = false;
      });
    } catch (error) {
      this.logger.error('Failed to initialize Redis client:', error);
      this.client = null;
    }
  }

  /**
   * Check if Redis is available and connected
   */
  isAvailable(): boolean {
    return this.client !== null && this.isConnected;
  }

  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Parsed value or null if not found/expired
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const value = await this.client!.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   * @param key - Cache key
   * @param value - Value to cache (will be JSON stringified)
   * @param ttlSeconds - Time to live in seconds (default: 300 = 5 minutes)
   */
  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client!.setex(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      this.logger.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a specific key from cache
   * @param key - Cache key to delete
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client!.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   * @param pattern - Redis key pattern (e.g., "permissions:*")
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const keys = await this.client!.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      await this.client!.del(...keys);
      this.logger.debug(`Deleted ${keys.length} keys matching ${pattern}`);
      return keys.length;
    } catch (error) {
      this.logger.error(`Redis DELETE PATTERN error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   * @param key - Cache key
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    if (!this.isAvailable()) {
      return -2;
    }

    try {
      return await this.client!.ttl(key);
    } catch (error) {
      this.logger.error(`Redis TTL error for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Flush all keys from the current database
   * ⚠️ Use with caution - this deletes ALL cached data
   */
  async flushAll(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client!.flushdb();
      this.logger.warn('⚠️ Redis: Flushed all keys');
      return true;
    } catch (error) {
      this.logger.error('Redis FLUSHDB error:', error);
      return false;
    }
  }

  /**
   * Graceful shutdown - close Redis connection
   */
  async onModuleDestroy() {
    if (this.client) {
      this.logger.log('Closing Redis connection...');
      await this.client.quit();
    }
  }
}
