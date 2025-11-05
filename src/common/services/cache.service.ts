/**
 * CacheService - Enhanced caching abstraction layer
 *
 * Features:
 * - Automatic key prefixing and namespacing
 * - TTL management with default values
 * - Tag-based cache invalidation
 * - Cache statistics tracking
 * - Graceful degradation when Redis unavailable
 * - Type-safe get/set operations
 * - Batch operations support
 *
 * Usage:
 * ```typescript
 * // Cache with tags for easy invalidation
 * await cacheService.set('product:123', product, 300, ['products', 'product:123']);
 *
 * // Invalidate all products
 * await cacheService.invalidateByTags(['products']);
 *
 * // Get with automatic type casting
 * const product = await cacheService.get<Product>('product:123');
 * ```
 */
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../database/redis.service';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
  namespace?: string; // Cache key namespace
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  operations: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTTL = 300; // 5 minutes
  private readonly keyPrefix = 'mash:cache:';
  private readonly tagPrefix = 'mash:tag:';

  // Cache statistics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    operations: 0,
  };

  constructor(private readonly redisService: RedisService) {}

  /**
   * Get a value from cache
   * @param key - Cache key
   * @param options - Cache options
   * @returns Cached value or null if not found
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.redisService.isAvailable()) {
      this.logger.warn('Redis unavailable, cache miss');
      return null;
    }

    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const value = await this.redisService.get<T>(fullKey);

      this.updateStats(value !== null);

      if (value !== null) {
        this.logger.debug(`Cache HIT: ${fullKey}`);
      } else {
        this.logger.debug(`Cache MISS: ${fullKey}`);
      }

      return value;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL and tags
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (default: 300)
   * @param tags - Tags for invalidation (default: [])
   */
  async set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<boolean> {
    if (!this.redisService.isAvailable()) {
      this.logger.warn('Redis unavailable, skipping cache set');
      return false;
    }

    try {
      const fullKey = this.buildKey(key);
      const cacheTTL = ttl || this.defaultTTL;

      // Store the value
      const success = await this.redisService.set(fullKey, value, cacheTTL);

      // Associate with tags if provided
      if (success && tags && tags.length > 0) {
        await this.associateTags(fullKey, tags, cacheTTL);
      }

      if (success) {
        this.logger.debug(`Cache SET: ${fullKey} (TTL: ${cacheTTL}s)`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a specific key from cache
   * @param key - Cache key
   */
  async delete(key: string, namespace?: string): Promise<boolean> {
    if (!this.redisService.isAvailable()) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key, namespace);
      const success = await this.redisService.delete(fullKey);

      if (success) {
        this.logger.debug(`Cache DELETE: ${fullKey}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Invalidate cache entries by tags
   * @param tags - Tags to invalidate
   * @returns Number of keys invalidated
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    if (!this.redisService.isAvailable()) {
      return 0;
    }

    let totalDeleted = 0;

    try {
      for (const tag of tags) {
        const tagKey = this.buildTagKey(tag);
        const keys = await this.redisService.get<string[]>(tagKey);

        if (keys && keys.length > 0) {
          for (const key of keys) {
            await this.redisService.delete(key);
            totalDeleted++;
          }

          // Delete the tag key itself
          await this.redisService.delete(tagKey);
        }
      }

      this.logger.log(
        `Cache invalidated by tags [${tags.join(', ')}]: ${totalDeleted} keys deleted`,
      );

      return totalDeleted;
    } catch (error) {
      this.logger.error(`Cache invalidation error for tags ${tags}:`, error);
      return totalDeleted;
    }
  }

  /**
   * Invalidate cache entries by pattern
   * @param pattern - Redis key pattern (e.g., "products:*")
   * @returns Number of keys deleted
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    if (!this.redisService.isAvailable()) {
      return 0;
    }

    try {
      const fullPattern = this.buildKey(pattern);
      const deleted = await this.redisService.deletePattern(fullPattern);

      this.logger.log(`Cache invalidated by pattern "${pattern}": ${deleted} keys deleted`);

      return deleted;
    } catch (error) {
      this.logger.error(`Cache invalidation error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   * @param key - Cache key
   */
  async exists(key: string, namespace?: string): Promise<boolean> {
    if (!this.redisService.isAvailable()) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key, namespace);
      return await this.redisService.exists(fullKey);
    } catch (error) {
      this.logger.error(`Cache exists check error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async getTTL(key: string, namespace?: string): Promise<number> {
    if (!this.redisService.isAvailable()) {
      return -2;
    }

    try {
      const fullKey = this.buildKey(key, namespace);
      return await this.redisService.getTTL(fullKey);
    } catch (error) {
      this.logger.error(`Cache TTL check error for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      hitRate: this.stats.operations > 0 ? (this.stats.hits / this.stats.operations) * 100 : 0,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      operations: 0,
    };
    this.logger.log('Cache statistics reset');
  }

  /**
   * Clear all cache (use with caution!)
   */
  async clearAll(): Promise<boolean> {
    if (!this.redisService.isAvailable()) {
      return false;
    }

    try {
      await this.redisService.deletePattern(`${this.keyPrefix}*`);
      await this.redisService.deletePattern(`${this.tagPrefix}*`);
      this.logger.warn('All cache cleared');
      return true;
    } catch (error) {
      this.logger.error('Cache clear all error:', error);
      return false;
    }
  }

  /**
   * Wrap a function with caching (memoization)
   * @param key - Cache key
   * @param fn - Function to execute if cache miss
   * @param ttl - Time to live in seconds
   * @param tags - Tags for invalidation
   */
  async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number, tags?: string[]): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, ttl, tags);

    return result;
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Build full cache key with prefix and namespace
   */
  private buildKey(key: string, namespace?: string): string {
    if (namespace) {
      return `${this.keyPrefix}${namespace}:${key}`;
    }
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Build tag key
   */
  private buildTagKey(tag: string): string {
    return `${this.tagPrefix}${tag}`;
  }

  /**
   * Associate cache key with tags
   */
  private async associateTags(key: string, tags: string[], ttl: number): Promise<void> {
    for (const tag of tags) {
      const tagKey = this.buildTagKey(tag);

      // Get existing keys for this tag
      const taggedKeys = (await this.redisService.get<string[]>(tagKey)) || [];

      // Add current key if not already present
      if (!taggedKeys.includes(key)) {
        taggedKeys.push(key);
      }

      // Update tag key with extended TTL (tag should live longer than cached values)
      await this.redisService.set(tagKey, taggedKeys, ttl + 60);
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(isHit: boolean): void {
    this.stats.operations++;
    if (isHit) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    this.stats.hitRate =
      this.stats.operations > 0 ? (this.stats.hits / this.stats.operations) * 100 : 0;
  }

  /**
   * Check if Redis is available
   * @returns true if Redis is connected and available
   */
  isRedisAvailable(): boolean {
    return this.redisService.isAvailable();
  }
}
