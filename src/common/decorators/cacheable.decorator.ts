import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';

export interface CacheableOptions {
  key: string;
  ttl?: number; // seconds, default 300 (5 min)
}

/**
 * Cache decorator for controller methods and service methods
 *
 * Caches the response of a method in Redis with a specified TTL.
 * Cache keys can include placeholders like :id, :userId that will be replaced
 * with actual values from request parameters.
 *
 * @param key - Redis cache key (can include :id, :userId, etc. placeholders)
 * @param ttl - Time to live in seconds (default: 300 = 5 minutes)
 *
 * @example
 * // Cache featured products for 5 minutes
 * @Get('featured')
 * @Cacheable('products:featured', 300)
 * getFeaturedProducts() { ... }
 *
 * @example
 * // Cache product details with dynamic ID for 5 minutes
 * @Get(':id')
 * @Cacheable('products:details::id', 300)
 * findOne(@Param('id') id: string) { ... }
 *
 * @example
 * // Cache user session for 15 minutes
 * @Get('session')
 * @Cacheable('auth:session::userId', 900)
 * getSession(@Request() req) { ... }
 */
export function Cacheable(key: string, ttl: number = 300) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY_METADATA, key)(target, propertyKey, descriptor);
    SetMetadata(CACHE_TTL_METADATA, ttl)(target, propertyKey, descriptor);
    return descriptor;
  };
}
