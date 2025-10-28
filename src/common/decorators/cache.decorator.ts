/**
 * Cache Decorators - Method-level caching with decorators
 *
 * Features:
 * - @Cacheable(): Cache method results automatically
 * - @CacheEvict(): Invalidate cache entries
 * - @CachePut(): Update cache with new data
 * - Customizable TTL and tags
 * - Dynamic key generation
 *
 * Usage:
 * ```typescript
 * @Cacheable({ ttl: 300, tags: ['products'] })
 * async findAll() {
 *   return this.prisma.product.findMany();
 * }
 *
 * @CacheEvict({ tags: ['products'] })
 * async create(data: CreateProductDto) {
 *   return this.prisma.product.create({ data });
 * }
 * ```
 */
import { SetMetadata } from '@nestjs/common';

export interface CacheableOptions {
  /** Cache key prefix (defaults to class.method name) */
  key?: string;

  /** Time to live in seconds (default: 300 = 5 minutes) */
  ttl?: number;

  /** Tags for cache invalidation */
  tags?: string[];

  /** Namespace for grouping related cache entries */
  namespace?: string;

  /** Whether to include method arguments in cache key (default: true) */
  includeArgs?: boolean;

  /** Custom key generator function */
  keyGenerator?: (...args: any[]) => string;
}

export interface CacheEvictOptions {
  /** Tags to invalidate */
  tags?: string[];

  /** Pattern to invalidate (e.g., "products:*") */
  pattern?: string;

  /** Whether to evict before method execution (default: false) */
  beforeInvocation?: boolean;
}

export interface CachePutOptions {
  /** Cache key prefix */
  key?: string;

  /** Time to live in seconds */
  ttl?: number;

  /** Tags for cache invalidation */
  tags?: string[];

  /** Namespace for grouping */
  namespace?: string;

  /** Custom key generator function */
  keyGenerator?: (...args: any[]) => string;
}

// Metadata keys
export const CACHEABLE_KEY = 'cache:cacheable';
export const CACHE_EVICT_KEY = 'cache:evict';
export const CACHE_PUT_KEY = 'cache:put';

/**
 * Cacheable decorator - Cache method results
 *
 * @example
 * ```typescript
 * @Cacheable({ ttl: 600, tags: ['products', 'catalog'] })
 * async findAll(@Query() query: PaginationDto) {
 *   return this.prisma.product.findMany();
 * }
 * ```
 */
export const Cacheable = (options: CacheableOptions = {}): MethodDecorator => {
  return SetMetadata(CACHEABLE_KEY, {
    ttl: options.ttl || 300,
    tags: options.tags || [],
    namespace: options.namespace,
    key: options.key,
    includeArgs: options.includeArgs !== false,
    keyGenerator: options.keyGenerator,
  });
};

/**
 * CacheEvict decorator - Invalidate cache entries
 *
 * @example
 * ```typescript
 * @CacheEvict({ tags: ['products'] })
 * async create(@Body() dto: CreateProductDto) {
 *   return this.prisma.product.create({ data: dto });
 * }
 *
 * @CacheEvict({ pattern: 'products:*' })
 * async deleteAll() {
 *   return this.prisma.product.deleteMany();
 * }
 * ```
 */
export const CacheEvict = (options: CacheEvictOptions = {}): MethodDecorator => {
  return SetMetadata(CACHE_EVICT_KEY, {
    tags: options.tags || [],
    pattern: options.pattern,
    beforeInvocation: options.beforeInvocation || false,
  });
};

/**
 * CachePut decorator - Update cache with new data
 *
 * @example
 * ```typescript
 * @CachePut({ key: 'product', tags: ['products'] })
 * async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
 *   return this.prisma.product.update({ where: { id }, data: dto });
 * }
 * ```
 */
export const CachePut = (options: CachePutOptions = {}): MethodDecorator => {
  return SetMetadata(CACHE_PUT_KEY, {
    ttl: options.ttl || 300,
    tags: options.tags || [],
    namespace: options.namespace,
    key: options.key,
    keyGenerator: options.keyGenerator,
  });
};

/**
 * Helper function to generate cache key from class, method, and arguments
 */
export function generateCacheKey(
  className: string,
  methodName: string,
  args: any[],
  options: CacheableOptions = {},
): string {
  // Use custom key generator if provided
  if (options.keyGenerator) {
    return options.keyGenerator(...args);
  }

  // Use custom key prefix if provided
  const baseKey = options.key || `${className}.${methodName}`;

  // Include arguments in key if enabled
  if (options.includeArgs && args.length > 0) {
    // Simple serialization of arguments (stringify IDs, omit complex objects)
    const argsKey = args
      .map(arg => {
        if (typeof arg === 'string' || typeof arg === 'number') {
          return arg;
        }
        if (arg && typeof arg === 'object' && arg.id) {
          return arg.id;
        }
        return JSON.stringify(arg);
      })
      .join(':');

    return `${baseKey}:${argsKey}`;
  }

  return baseKey;
}
