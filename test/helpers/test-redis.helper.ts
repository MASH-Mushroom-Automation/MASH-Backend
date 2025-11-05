/**
 * Test Redis Helper
 *
 * Provides utilities for managing Redis in tests.
 * Ensures test isolation with separate key prefixes and database.
 */

import { Redis } from 'ioredis';

export class TestRedisHelper {
  private redis: Redis;
  private static instance: TestRedisHelper;
  private readonly keyPrefix = 'test:';

  private constructor() {
    this.redis = new Redis(process.env.TEST_REDIS_URL || 'redis://localhost:6379/1', {
      keyPrefix: this.keyPrefix,
      lazyConnect: true,
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TestRedisHelper {
    if (!TestRedisHelper.instance) {
      TestRedisHelper.instance = new TestRedisHelper();
    }
    return TestRedisHelper.instance;
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      console.log('✅ Test Redis connected');
    } catch (error) {
      console.error('❌ Failed to connect to test Redis:', error);
      throw error;
    }
  }

  /**
   * Flush all keys with test prefix
   */
  async flush(): Promise<void> {
    try {
      // Get all keys with test prefix
      const keys = await this.redis.keys(`${this.keyPrefix}*`);

      if (keys.length > 0) {
        // Remove prefix before deleting
        const keysWithoutPrefix = keys.map(key => key.replace(this.keyPrefix, ''));
        await this.redis.del(...keysWithoutPrefix);
      }

      console.log(`🧹 Flushed ${keys.length} test Redis keys`);
    } catch (error) {
      console.error('❌ Failed to flush test Redis:', error);
      throw error;
    }
  }

  /**
   * Flush entire Redis database (use with caution!)
   */
  async flushAll(): Promise<void> {
    try {
      await this.redis.flushdb();
      console.log('🧹 Flushed entire test Redis database');
    } catch (error) {
      console.error('❌ Failed to flush Redis database:', error);
      throw error;
    }
  }

  /**
   * Get Redis client
   */
  getClient(): Redis {
    return this.redis;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
    console.log('👋 Test Redis disconnected');
  }

  /**
   * Check Redis connection
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Set key with test prefix
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.setex(key, ttl, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  /**
   * Get key with test prefix
   */
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  /**
   * Delete key with test prefix
   */
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Increment counter (useful for rate limiting tests)
   */
  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  /**
   * Get TTL of key
   */
  async getTTL(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  /**
   * Set hash field
   */
  async hset(key: string, field: string, value: string): Promise<void> {
    await this.redis.hset(key, field, value);
  }

  /**
   * Get hash field
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }

  /**
   * Get all hash fields
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }
}

/**
 * Global test Redis helper instance
 */
export const testRedis = TestRedisHelper.getInstance();
