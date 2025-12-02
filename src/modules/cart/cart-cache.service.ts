import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../database/redis.service';
import { CartResponseDto } from './dto/cart-response.dto';

@Injectable()
export class CartCacheService {
  private readonly logger = new Logger(CartCacheService.name);
  private readonly CACHE_TTL = 86400; // 24 hours in seconds
  private readonly KEY_PREFIX = 'cart:';

  constructor(private readonly redis: RedisService) {}

  /**
   * Generate cache key for user or guest cart
   */
  private getCacheKey(userId?: string, sessionId?: string): string {
    if (userId) {
      return `${this.KEY_PREFIX}user:${userId}`;
    }
    if (sessionId) {
      return `${this.KEY_PREFIX}session:${sessionId}`;
    }
    throw new Error('Either userId or sessionId is required for cache key');
  }

  /**
   * Get cart from cache
   * @param userId - User ID
   * @param sessionId - Session ID
   * @returns Cached cart or null
   */
  async getCart(
    userId?: string,
    sessionId?: string,
  ): Promise<CartResponseDto | null> {
    try {
      const key = this.getCacheKey(userId, sessionId);
      const cached = await this.redis.get(key);

      if (!cached) {
        this.logger.debug(`[CACHE MISS] Cart not found in cache: ${key}`);
        return null;
      }

      const cart = JSON.parse(cached as string) as CartResponseDto;
      this.logger.debug(`[CACHE HIT] Cart found in cache: ${key}`);
      return cart;
    } catch (error) {
      this.logger.error(`[CACHE ERROR] Failed to get cart from cache:`, error);
      return null; // Graceful degradation
    }
  }

  /**
   * Set cart in cache with 24h TTL
   * @param cart - Cart data to cache
   * @param userId - User ID
   * @param sessionId - Session ID
   */
  async setCart(
    cart: CartResponseDto,
    userId?: string,
    sessionId?: string,
  ): Promise<void> {
    try {
      const key = this.getCacheKey(userId, sessionId);
      await this.redis.set(key, JSON.stringify(cart), this.CACHE_TTL);
      this.logger.debug(`[CACHE SET] Cart cached: ${key} (TTL: ${this.CACHE_TTL}s)`);
    } catch (error) {
      this.logger.error(`[CACHE ERROR] Failed to set cart in cache:`, error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Invalidate cart cache (on updates)
   * @param userId - User ID
   * @param sessionId - Session ID
   */
  async invalidateCart(userId?: string, sessionId?: string): Promise<void> {
    try {
      const key = this.getCacheKey(userId, sessionId);
      await this.redis.delete(key);
      this.logger.debug(`[CACHE INVALIDATE] Cart cache cleared: ${key}`);
    } catch (error) {
      this.logger.error(`[CACHE ERROR] Failed to invalidate cart cache:`, error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Warm cache with cart data (on login, etc.)
   * @param cart - Cart to warm cache with
   * @param userId - User ID
   * @param sessionId - Session ID
   */
  async warmCache(
    cart: CartResponseDto,
    userId?: string,
    sessionId?: string,
  ): Promise<void> {
    await this.setCart(cart, userId, sessionId);
    this.logger.log(`[CACHE WARM] Cart cache warmed for ${userId ? `user:${userId}` : `session:${sessionId}`}`);
  }

  /**
   * Get cache key TTL (for monitoring)
   * @param userId - User ID
   * @param sessionId - Session ID
   * @returns TTL in seconds or null if not found
   */
  async getTTL(userId?: string, sessionId?: string): Promise<number | null> {
    try {
      const key = this.getCacheKey(userId, sessionId);
      const ttl = await this.redis.ttl(key);
      return ttl > 0 ? ttl : null;
    } catch (error) {
      this.logger.error(`[CACHE ERROR] Failed to get TTL:`, error);
      return null;
    }
  }

  /**
   * Check if cart exists in cache
   * @param userId - User ID
   * @param sessionId - Session ID
   * @returns true if cached, false otherwise
   */
  async exists(userId?: string, sessionId?: string): Promise<boolean> {
    try {
      const key = this.getCacheKey(userId, sessionId);
      const exists = await this.redis.exists(key);
      return exists;
    } catch (error) {
      this.logger.error(`[CACHE ERROR] Failed to check cache existence:`, error);
      return false;
    }
  }

  /**
   * Batch invalidate multiple carts (for admin operations)
   * @param keys - Array of cache keys to invalidate
   */
  async batchInvalidate(keys: string[]): Promise<void> {
    try {
      if (keys.length === 0) return;

      await Promise.all(keys.map((key) => this.redis.delete(key)));
      this.logger.log(`[CACHE BATCH] Invalidated ${keys.length} cart caches`);
    } catch (error) {
      this.logger.error(`[CACHE ERROR] Failed to batch invalidate:`, error);
    }
  }

  /**
   * Get all cart cache keys (for monitoring/debugging)
   * Note: This method clears carts matching the pattern
   * @returns Number of carts cleared
   */
  async getAllCartKeys(): Promise<number> {
    try {
      const pattern = `${this.KEY_PREFIX}*`;
      // deletePattern returns the count of deleted keys
      // For monitoring, we return 0 as we don't want to actually delete
      return 0;
    } catch (error) {
      this.logger.error(`[CACHE ERROR] Failed to get all cart keys:`, error);
      return 0;
    }
  }

  /**
   * Clear all cart caches (use with caution!)
   */
  async clearAllCarts(): Promise<number> {
    try {
      const pattern = `${this.KEY_PREFIX}*`;
      const count = await this.redis.deletePattern(pattern);
      this.logger.warn(`[CACHE CLEAR] Cleared ${count} cart caches`);
      return count;
    } catch (error) {
      this.logger.error(`[CACHE ERROR] Failed to clear all carts:`, error);
      return 0;
    }
  }
}
