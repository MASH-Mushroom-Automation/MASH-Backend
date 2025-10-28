/**
 * CacheInterceptor - Automatic caching for controller methods
 *
 * Features:
 * - Automatically caches responses based on @Cacheable decorator
 * - Invalidates cache based on @CacheEvict decorator
 * - Updates cache based on @CachePut decorator
 * - Generates cache keys from method name and arguments
 * - Supports HTTP methods filtering (GET only by default)
 *
 * Usage:
 * Apply globally in AppModule or per-controller:
 * ```typescript
 * @UseInterceptors(CacheInterceptor)
 * @Controller('products')
 * export class ProductsController {}
 * ```
 */
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from '../services/cache.service';
import {
  CACHEABLE_KEY,
  CACHE_EVICT_KEY,
  CACHE_PUT_KEY,
  CacheableOptions,
  CacheEvictOptions,
  CachePutOptions,
  generateCacheKey,
} from '../decorators/cache.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Get cache metadata
    const cacheableOptions = this.reflector.get<CacheableOptions>(CACHEABLE_KEY, handler);
    const cacheEvictOptions = this.reflector.get<CacheEvictOptions>(CACHE_EVICT_KEY, handler);
    const cachePutOptions = this.reflector.get<CachePutOptions>(CACHE_PUT_KEY, handler);

    // Handle cache eviction (before invocation if specified)
    if (cacheEvictOptions?.beforeInvocation) {
      await this.handleCacheEvict(cacheEvictOptions);
    }

    // Handle cacheable methods (GET requests only)
    if (cacheableOptions && request.method === 'GET') {
      return this.handleCacheable(context, next, cacheableOptions, controller, handler);
    }

    // Execute the handler
    const result$ = next.handle();

    // Handle post-execution operations
    return result$.pipe(
      tap(async response => {
        // Handle cache eviction (after invocation)
        if (cacheEvictOptions && !cacheEvictOptions.beforeInvocation) {
          await this.handleCacheEvict(cacheEvictOptions);
        }

        // Handle cache put
        if (cachePutOptions) {
          await this.handleCachePut(
            cachePutOptions,
            response,
            controller,
            handler,
            context.getArgs(),
          );
        }
      }),
    );
  }

  /**
   * Handle cacheable methods - check cache first, then execute if miss
   */
  private async handleCacheable(
    context: ExecutionContext,
    next: CallHandler,
    options: CacheableOptions,
    controller: any,
    handler: any,
  ): Promise<Observable<any>> {
    const args = context.getArgs();
    const cacheKey = generateCacheKey(controller.name, handler.name, args, options);

    // Try to get from cache
    const cachedResult = await this.cacheService.get(cacheKey, {
      namespace: options.namespace,
    });

    if (cachedResult !== null) {
      this.logger.debug(`Cache HIT for ${cacheKey}`);
      return of(cachedResult);
    }

    this.logger.debug(`Cache MISS for ${cacheKey}`);

    // Execute handler and cache result
    return next.handle().pipe(
      tap(async response => {
        await this.cacheService.set(cacheKey, response, options.ttl, options.tags);
        this.logger.debug(`Cached result for ${cacheKey}`);
      }),
    );
  }

  /**
   * Handle cache eviction
   */
  private async handleCacheEvict(options: CacheEvictOptions): Promise<void> {
    if (options.tags && options.tags.length > 0) {
      const count = await this.cacheService.invalidateByTags(options.tags);
      this.logger.debug(`Evicted ${count} cache entries by tags: ${options.tags.join(', ')}`);
    }

    if (options.pattern) {
      const count = await this.cacheService.invalidateByPattern(options.pattern);
      this.logger.debug(`Evicted ${count} cache entries by pattern: ${options.pattern}`);
    }
  }

  /**
   * Handle cache put - update cache with new data
   */
  private async handleCachePut(
    options: CachePutOptions,
    response: any,
    controller: any,
    handler: any,
    args: any[],
  ): Promise<void> {
    const cacheKey = generateCacheKey(controller.name, handler.name, args, options);

    await this.cacheService.set(cacheKey, response, options.ttl, options.tags);
    this.logger.debug(`Updated cache for ${cacheKey}`);
  }
}
