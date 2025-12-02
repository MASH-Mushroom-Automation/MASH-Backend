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
  private isShuttingDown = false; // Flag to prevent operations during shutdown

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn('[WARN] REDIS_URL not configured - Redis caching disabled');
      this.logger.warn(
        '[NOTE] App will continue without Redis (cache, rate limiting, sessions disabled)',
      );
      this.client = null;
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true, // Don't connect immediately
        retryStrategy: (times: number) => {
          if (times > 3) {
            // Reduce retries to fail fast
            this.logger.error('[ERROR] Redis: Max retries reached. Continuing without Redis.');
            this.isConnected = false;
            return null; // Stop retrying
          }
          const delay = Math.min(times * 50, 1000);
          this.logger.warn(`Redis: Retry attempt ${times} in ${delay}ms...`);
          return delay;
        },
      });

      // Try to connect but don't block app startup
      this.client
        .connect()
        .then(() => {
          this.logger.log('[SUCCESS] Redis connected successfully');
          this.isConnected = true;
        })
        .catch(error => {
          this.handleConnectionError(error);
        });

      this.client.on('connect', () => {
        this.logger.log('[SUCCESS] Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('error', error => {
        this.handleConnectionError(error);
      });

      this.client.on('close', () => {
        this.logger.warn('[WARN] Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        this.logger.log('[RETRY] Redis reconnecting...');
      });
    } catch (error) {
      this.logger.error('[ERROR] Failed to initialize Redis client:', error);
      this.client = null;
    }
  }

  /**
   * Handle Redis connection errors with specific messages
   */
  private handleConnectionError(error: any): void {
    this.isConnected = false;

    // Check for quota exceeded error
    if (
      error.message?.includes('max requests limit exceeded') ||
      error.message?.includes('Usage:')
    ) {
      this.logger.error('[ERROR] REDIS QUOTA EXCEEDED!');
      this.logger.error('[INFO] Your Upstash Redis free tier limit has been reached');
      this.logger.error(
        '[NOTE] Options: 1) Upgrade Upstash plan, 2) Reset database, 3) Continue without Redis',
      );
      this.logger.warn('[WARN] App will continue WITHOUT Redis caching');

      // Disconnect to prevent further errors
      if (this.client) {
        this.client.disconnect(false);
      }
    } else if (error.message?.includes('ECONNREFUSED')) {
      this.logger.error('[ERROR] Redis connection refused (server not reachable)');
      this.logger.warn('[WARN] App will continue WITHOUT Redis caching');
    } else if (error.message?.includes('Invalid password')) {
      this.logger.error('[ERROR] Redis authentication failed (invalid password)');
      this.logger.error('[AUTH] Check REDIS_URL and REDIS_PASSWORD in environment');
      this.logger.warn('[WARN] App will continue WITHOUT Redis caching');
    } else {
      this.logger.error('[ERROR] Redis connection error:', error.message);
      this.logger.warn('[WARN] App will continue WITHOUT Redis caching');
    }
  }

  /**
   * Check if Redis is available and connected
   */
  isAvailable(): boolean {
    return this.client !== null && this.isConnected && !this.isShuttingDown;
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
      const value = await this.client.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(
        `Redis GET error for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
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
      await this.client.setex(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      this.logger.error(
        `Redis SET error for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
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
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(
        `Redis DEL error for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
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
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(...keys);
      this.logger.debug(`Deleted ${keys.length} keys matching ${pattern}`);
      return keys.length;
    } catch (error) {
      this.logger.error(
        `Redis DELETE PATTERN error for ${pattern}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
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
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Redis EXISTS error for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
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
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(
        `Redis TTL error for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return -2;
    }
  }

  /**
   * Alias for ttl() - Get remaining TTL for a key
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async getTTL(key: string): Promise<number> {
    return this.ttl(key);
  }

  /**
   * Atomically increment a key's value
   * @param key - Cache key
   * @returns New value after increment
   */
  async increment(key: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(
        `Redis INCR error for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 0;
    }
  }

  /**
   * Atomically increment a key's value by a specific amount
   * @param key - Cache key
   * @param amount - Amount to increment by
   * @returns New value after increment
   */
  async incrementBy(key: string, amount: number): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      return await this.client.incrby(key, amount);
    } catch (error) {
      this.logger.error(
        `Redis INCRBY error for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 0;
    }
  }

  /**
   * Set expiration on a key
   * @param key - Cache key
   * @param seconds - TTL in seconds
   * @returns true if expiration was set, false otherwise
   */
  async setExpiration(key: string, seconds: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Redis EXPIRE error for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  /**
   * Flush all keys from the current database
   * WARNING: Use with caution - this deletes ALL cached data
   */
  async flushAll(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client.flushdb();
      this.logger.warn('[WARN] Redis: Flushed all keys');
      return true;
    } catch (error) {
      this.logger.error(
        `Redis FLUSHDB error: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  /**
   * Graceful shutdown - close Redis connection
   */
  async onModuleDestroy() {
    if (this.client && !this.isShuttingDown) {
      this.logger.log('Closing Redis connection...');
      this.isShuttingDown = true; // Set flag to prevent new operations
      
      // Wait a short time for in-flight operations to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        await this.client.quit();
        this.logger.log('[SUCCESS] Redis connection closed gracefully');
      } catch (error) {
        this.logger.warn('[WARN] Error closing Redis connection:', error);
        // Force disconnect if quit fails
        this.client.disconnect(false);
      }
    }
  }
}

