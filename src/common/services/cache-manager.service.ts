/**
 * CacheManagerService - Advanced cache management with warming, statistics, and monitoring
 *
 * Features:
 * - Cache warming on application startup
 * - Cache statistics tracking (hit rate, miss rate, memory usage)
 * - Performance metrics collection
 * - Event-driven cache invalidation
 * - Cache health monitoring
 *
 * Usage:
 * ```typescript
 * // Warm cache on startup
 * await cacheManagerService.warmCache();
 *
 * // Get cache statistics
 * const stats = await cacheManagerService.getCacheStatistics();
 *
 * // Monitor cache health
 * const health = await cacheManagerService.getCacheHealth();
 * ```
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CacheService } from './cache.service';
import { PrismaService } from '../../database/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface CacheStatistics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  missRate: number;
  averageResponseTime: number;
  memoryUsage: number;
  topKeys: { key: string; hits: number }[];
  recentErrors: string[];
}

export interface CacheHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  redisConnected: boolean;
  hitRate: number;
  averageResponseTime: number;
  memoryUsage: number;
  lastCheck: Date;
  alerts: string[];
}

export interface WarmCacheConfig {
  categories?: boolean;
  featuredProducts?: boolean;
  systemConfig?: boolean;
  topProducts?: boolean;
  dashboardStats?: boolean;
}

@Injectable()
export class CacheManagerService implements OnModuleInit {
  private readonly logger = new Logger(CacheManagerService.name);

  // Cache statistics tracking
  private statistics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    responseTimes: [] as number[],
    keyHitCount: new Map<string, number>(),
    recentErrors: [] as string[],
  };

  // Performance thresholds for alerting
  private readonly ALERT_HIT_RATE_THRESHOLD = 0.75; // Alert if hit rate < 75%
  private readonly ALERT_RESPONSE_TIME_THRESHOLD = 100; // Alert if avg response > 100ms
  private readonly ALERT_MEMORY_THRESHOLD = 0.8; // Alert if memory usage > 80%
  private readonly MAX_RECENT_ERRORS = 10; // Keep last 10 errors

  constructor(
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Initialize cache on module startup
   */
  async onModuleInit() {
    this.logger.log('?? Initializing Cache Manager...');

    // Warm cache on startup (async, don't block startup)
    // Use setTimeout to defer execution until after module initialization completes
    setTimeout(() => {
      void this.warmCache().catch(error => {
        this.logger.error('Failed to warm cache on startup', error);
      });
    }, 1000); // Wait 1 second after module init

    // Start monitoring
    this.logger.log('? Cache Manager initialized successfully');
  }

  /**
   * Warm cache on application startup
   * Preload frequently accessed data to reduce cold start latency
   */
  async warmCache(config?: WarmCacheConfig): Promise<void> {
    const warmConfig: WarmCacheConfig = {
      categories: true,
      featuredProducts: true,
      systemConfig: true,
      topProducts: true,
      dashboardStats: true,
      ...config,
    };

    this.logger.log('?? Starting cache warming...');
    const startTime = Date.now();

    try {
      const warmingTasks: Promise<void>[] = [];

      // 1. Warm system configuration (critical for app startup)
      if (warmConfig.systemConfig) {
        warmingTasks.push(
          this.warmSystemConfig().catch(err =>
            this.logger.warn('Failed to warm system config', err),
          ),
        );
      }

      // 2. Warm categories (frequently accessed in navigation)
      if (warmConfig.categories) {
        warmingTasks.push(
          this.warmCategories().catch(err => this.logger.warn('Failed to warm categories', err)),
        );
      }

      // 3. Warm featured products (homepage)
      if (warmConfig.featuredProducts) {
        warmingTasks.push(
          this.warmFeaturedProducts().catch(err =>
            this.logger.warn('Failed to warm featured products', err),
          ),
        );
      }

      // 4. Warm top products (analytics)
      if (warmConfig.topProducts) {
        warmingTasks.push(
          this.warmTopProducts().catch(err => this.logger.warn('Failed to warm top products', err)),
        );
      }

      // 5. Warm dashboard stats (admin panel)
      if (warmConfig.dashboardStats) {
        warmingTasks.push(
          this.warmDashboardStats().catch(err =>
            this.logger.warn('Failed to warm dashboard stats', err),
          ),
        );
      }

      // Execute all warming tasks in parallel
      await Promise.all(warmingTasks);

      const duration = Date.now() - startTime;
      this.logger.log(`? Cache warming completed successfully in ${duration}ms`);
    } catch (error) {
      this.logger.error('Cache warming failed', error);
      this.trackError('Cache warming failed');
    }
  }

  /**
   * Warm system configuration cache
   */
  private async warmSystemConfig(): Promise<void> {
    try {
      const config = await this.prisma.systemConfig.findMany({
        // Note: Remove isActive filter if the field doesn't exist in schema
        // where: { isActive: true },
      });

      await this.cacheService.set(
        'system:config',
        config,
        3600, // 1 hour
        ['system', 'config'],
      );

      this.logger.debug(`? Warmed system config (${config.length} items)`);
    } catch (error) {
      this.logger.error('Failed to warm system config', error);
      // Non-fatal: system can start without cached config
    }
  }

  /**
   * Warm categories cache
   */
  private async warmCategories(): Promise<void> {
    try {
      const categories = await this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });

      await this.cacheService.set(
        'categories:list:{}',
        { data: categories, meta: { total: categories.length } },
        600, // 10 minutes
        ['categories', 'categories:list'],
      );

      this.logger.debug(`? Warmed categories (${categories.length} items)`);
    } catch (error) {
      this.logger.error('Failed to warm categories', error);
      // Non-fatal: categories can load on-demand
    }
  }

  /**
   * Warm featured products cache
   */
  private async warmFeaturedProducts(): Promise<void> {
    try {
      const products = await this.prisma.product.findMany({
        where: { isActive: true, isFeatured: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      await this.cacheService.set(
        'products:list:featured',
        { data: products, meta: { total: products.length } },
        600, // 10 minutes
        ['products', 'products:list'],
      );

      this.logger.debug(`? Warmed featured products (${products.length} items)`);
    } catch (error) {
      this.logger.error('Failed to warm featured products', error);
      // Non-fatal: products can load on-demand
    }
  }

  /**
   * Warm top products analytics cache
   */
  private async warmTopProducts(): Promise<void> {
    try {
      // Get top 10 products by order count (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const orderItems = await this.prisma.orderItem.findMany({
        where: {
          order: {
            createdAt: { gte: thirtyDaysAgo },
            status: 'DELIVERED',
          },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
              images: true,
            },
          },
        },
        take: 100, // Limit for performance
      });

      const productStats = orderItems.reduce(
        (acc, item) => {
          const productId = item.productId;
          if (!acc[productId]) {
            acc[productId] = {
              product: item.product,
              totalQuantity: 0,
              totalRevenue: 0,
              orderCount: 0,
            };
          }
          acc[productId].totalQuantity += item.quantity;
          acc[productId].totalRevenue += Number(item.total);
          acc[productId].orderCount += 1;
          return acc;
        },
        {} as Record<string, any>,
      );

      const topProducts = Object.values(productStats)
        .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

      await this.cacheService.set(
        'analytics:products:top:{}',
        { topProducts },
        1800, // 30 minutes
        ['analytics', 'analytics:products'],
      );

      this.logger.debug(`? Warmed top products analytics (${topProducts.length} items)`);
    } catch (error) {
      this.logger.error('Failed to warm top products', error);
      // Non-fatal: analytics can load on-demand
    }
  }

  /**
   * Warm dashboard statistics cache
   */
  private async warmDashboardStats(): Promise<void> {
    try {
      const [totalOrders, totalRevenue, totalUsers, deviceStats] = await Promise.all([
        this.prisma.order.count(),
        this.prisma.order.aggregate({
          _sum: { total: true },
        }),
        this.prisma.user.count(),
        this.prisma.device.aggregate({
          _count: true,
        }),
      ]);

      const stats = {
        totalOrders,
        totalRevenue: Number(totalRevenue._sum.total) || 0,
        totalUsers,
        totalDevices: deviceStats._count,
      };

      await this.cacheService.set(
        'analytics:dashboard:{}',
        stats,
        300, // 5 minutes
        ['analytics', 'analytics:dashboard'],
      );

      this.logger.debug('? Warmed dashboard statistics');
    } catch (error) {
      this.logger.error('Failed to warm dashboard statistics', error);
      // Non-fatal: dashboard stats can load on-demand
    }
  }

  /**
   * Track cache hit
   */
  trackCacheHit(key: string, responseTime: number): void {
    this.statistics.totalRequests++;
    this.statistics.cacheHits++;
    this.statistics.responseTimes.push(responseTime);

    // Track key-level hit count
    const currentCount = this.statistics.keyHitCount.get(key) || 0;
    this.statistics.keyHitCount.set(key, currentCount + 1);

    // Keep only last 1000 response times to prevent memory leak
    if (this.statistics.responseTimes.length > 1000) {
      this.statistics.responseTimes.shift();
    }
  }

  /**
   * Track cache miss
   */
  trackCacheMiss(key: string, responseTime: number): void {
    this.statistics.totalRequests++;
    this.statistics.cacheMisses++;
    this.statistics.responseTimes.push(responseTime);

    // Keep only last 1000 response times to prevent memory leak
    if (this.statistics.responseTimes.length > 1000) {
      this.statistics.responseTimes.shift();
    }
  }

  /**
   * Track cache error
   */
  trackError(error: string): void {
    this.statistics.recentErrors.push(error);

    // Keep only last N errors
    if (this.statistics.recentErrors.length > this.MAX_RECENT_ERRORS) {
      this.statistics.recentErrors.shift();
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  async getCacheStatistics(): Promise<CacheStatistics> {
    const hitRate =
      this.statistics.totalRequests > 0
        ? (this.statistics.cacheHits / this.statistics.totalRequests) * 100
        : 0;

    const missRate = 100 - hitRate;

    const averageResponseTime =
      this.statistics.responseTimes.length > 0
        ? this.statistics.responseTimes.reduce((a, b) => a + b, 0) /
          this.statistics.responseTimes.length
        : 0;

    // Get top 10 most accessed keys
    const topKeys = Array.from(this.statistics.keyHitCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, hits]) => ({ key, hits }));

    // Get Redis memory usage
    let memoryUsage = 0;
    try {
      // Estimate based on key count (rough estimate)
      memoryUsage = this.statistics.keyHitCount.size * 1024; // Assume 1KB per key
    } catch (error) {
      this.logger.warn('Failed to get memory usage', error);
    }

    return {
      totalRequests: this.statistics.totalRequests,
      cacheHits: this.statistics.cacheHits,
      cacheMisses: this.statistics.cacheMisses,
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round(missRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      memoryUsage,
      topKeys,
      recentErrors: [...this.statistics.recentErrors],
    };
  }

  /**
   * Get cache health status
   */
  async getCacheHealth(): Promise<CacheHealth> {
    const stats = await this.getCacheStatistics();
    const alerts: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check Redis connection using CacheService's test operation
    let redisConnected = false;
    try {
      // Try a simple cache operation to test connectivity
      await this.cacheService.set('health:check', { timestamp: Date.now() }, 10);
      const result = await this.cacheService.get<any>('health:check');
      redisConnected = result !== null;
    } catch (error) {
      this.logger.debug('Redis health check failed', error);
      redisConnected = false;
    }

    if (!redisConnected) {
      alerts.push('Redis connection is not available');
      status = 'unhealthy';
    }

    // Check hit rate
    if (stats.hitRate < this.ALERT_HIT_RATE_THRESHOLD * 100) {
      alerts.push(
        `Cache hit rate is low: ${stats.hitRate.toFixed(2)}% (threshold: ${this.ALERT_HIT_RATE_THRESHOLD * 100}%)`,
      );
      status = status === 'healthy' ? 'degraded' : status;
    }

    // Check response time
    if (stats.averageResponseTime > this.ALERT_RESPONSE_TIME_THRESHOLD) {
      alerts.push(
        `Average response time is high: ${stats.averageResponseTime.toFixed(2)}ms (threshold: ${this.ALERT_RESPONSE_TIME_THRESHOLD}ms)`,
      );
      status = status === 'healthy' ? 'degraded' : status;
    }

    // Check for recent errors
    if (stats.recentErrors.length > 0) {
      alerts.push(`${stats.recentErrors.length} recent cache errors detected`);
      status = status === 'healthy' ? 'degraded' : status;
    }

    return {
      status,
      redisConnected,
      hitRate: stats.hitRate,
      averageResponseTime: stats.averageResponseTime,
      memoryUsage: stats.memoryUsage,
      lastCheck: new Date(),
      alerts,
    };
  }

  /**
   * Reset cache statistics
   * Useful for testing and periodic resets
   */
  resetStatistics(): void {
    this.statistics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      responseTimes: [],
      keyHitCount: new Map(),
      recentErrors: [],
    };
    this.logger.log('? Cache statistics reset');
  }

  /**
   * Periodic cache health monitoring (every 5 minutes)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async monitorCacheHealth(): Promise<void> {
    try {
      const health = await this.getCacheHealth();

      if (health.status === 'unhealthy') {
        this.logger.error(`?? Cache health is UNHEALTHY: ${health.alerts.join(', ')}`);
      } else if (health.status === 'degraded') {
        this.logger.warn(`??  Cache health is DEGRADED: ${health.alerts.join(', ')}`);
      } else {
        this.logger.debug(
          `? Cache health is HEALTHY (hit rate: ${health.hitRate.toFixed(2)}%, avg response: ${health.averageResponseTime.toFixed(2)}ms)`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to monitor cache health', error);
    }
  }

  /**
   * Periodic cache warming (every 30 minutes)
   * Keeps hot data in cache
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async periodicCacheWarming(): Promise<void> {
    this.logger.debug('?? Running periodic cache warming...');
    await this.warmCache({
      categories: true,
      featuredProducts: true,
      systemConfig: true,
      topProducts: false, // Skip expensive analytics
      dashboardStats: false, // Skip expensive stats
    });
  }

  /**
   * Get cache key patterns summary
   */
  async getCacheKeySummary(): Promise<{
    totalKeys: number;
    keysByPrefix: Record<string, number>;
  }> {
    const keys = Array.from(this.statistics.keyHitCount.keys());
    const totalKeys = keys.length;

    const keysByPrefix = keys.reduce(
      (acc, key) => {
        const prefix = key.split(':')[0];
        acc[prefix] = (acc[prefix] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return { totalKeys, keysByPrefix };
  }
}
