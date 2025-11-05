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
      this.logger.warn('⚠️ REDIS_URL not configured - Redis caching disabled');
      this.logger.warn(
        '📝 App will continue without Redis (cache, rate limiting, sessions disabled)',
      );
      this.client = null;
      return;
    }

    try {
      // Make retry/backoff more forgiving for transient network blips
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 10,
        enableReadyCheck: true,
        lazyConnect: true, // Don't connect immediately
        // Exponential backoff: increase delay with attempts, but do not stop permanently
        retryStrategy: (times: number) => {
          // Cap attempts to a reasonable number but keep trying
          const capped = Math.min(times, 30);
          const delay = Math.min(Math.pow(2, capped) * 50, 5000);
          this.logger.warn(`Redis: Retry attempt ${times} in ${delay}ms...`);
          return delay;
        },
        // Slightly increase connect timeout so slow networks can establish
        connectTimeout: 10000,
      });

      // Attempt connect asynchronously but don't block startup
      const tryConnect = async () => {
        if (!this.client) return;
        try {
          await this.client.connect();
          this.logger.log('✅ Redis connected successfully');
          this.isConnected = true;
        } catch (error) {
          // Log and let retryStrategy handle reconnection attempts
          this.logger.warn('⚠️ Initial Redis connect attempt failed');
          this.handleConnectionError(error);
        }
      };

      tryConnect();

      this.client.on('connect', () => {
        this.logger.log('✅ Redis connected (event)');
        this.isConnected = true;
      });

      this.client.on('error', (error) => {
        this.handleConnectionError(error);
      });

      this.client.on('close', () => {
        this.logger.warn('⚠️ Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        this.logger.log('🔄 Redis reconnecting...');
      });

      // Background reconnect loop: try reconnecting every 30s if disconnected
      const reconnectIntervalMs = 30000;
      const reconnectHandle = setInterval(async () => {
        try {
          if (this.client && !this.isConnected) {
            this.logger.debug('Redis: background reconnect attempt...');
            try {
              await this.client.connect();
              this.logger.log('✅ Redis reconnected by background loop');
              this.isConnected = true;
            } catch (err) {
              // Suppress noisy errors; handler will log details
              this.logger.debug('Redis background reconnect failed');
            }
          }
        } catch (err) {
          this.logger.debug('Redis background reconnect unexpected error');
        }
      }, reconnectIntervalMs);

      // Clear interval on process exit
      process.on('exit', () => clearInterval(reconnectHandle));
    } catch (error) {
      this.logger.error('❌ Failed to initialize Redis client:', error);
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
      this.logger.error('❌ REDIS QUOTA EXCEEDED!');
      this.logger.error(
        '💰 Your Upstash Redis free tier limit has been reached',
      );
      this.logger.error(
        '📝 Options: 1) Upgrade Upstash plan, 2) Reset database, 3) Continue without Redis',
      );
      this.logger.warn('⚠️ App will continue WITHOUT Redis caching');

      // Disconnect to prevent further errors
      if (this.client) {
        this.client.disconnect(false);
      }
    } else if (error.message?.includes('ECONNREFUSED')) {
      this.logger.error('❌ Redis connection refused (server not reachable)');
      this.logger.warn('⚠️ App will continue WITHOUT Redis caching');
    } else if (error.message?.includes('Invalid password')) {
      this.logger.error('❌ Redis authentication failed (invalid password)');
      this.logger.error('🔑 Check REDIS_URL and REDIS_PASSWORD in environment');
      this.logger.warn('⚠️ App will continue WITHOUT Redis caching');
    } else {
      this.logger.error('❌ Redis connection error:', error.message);
      this.logger.warn('⚠️ App will continue WITHOUT Redis caching');
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
   * ⚠️ Use with caution - this deletes ALL cached data
   */
  async flushAll(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client.flushdb();
      this.logger.warn('⚠️ Redis: Flushed all keys');
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
    if (this.client) {
      this.logger.log('Closing Redis connection...');
      await this.client.quit();
    }
  }
}
