import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnalyticsService } from '../analytics.service';
import { ConfigService } from '@nestjs/config';
import { startOfDay, subDays, endOfDay } from 'date-fns';

/**
 * CacheWarmerService
 *
 * Proactively warms the analytics cache by pre-loading popular queries.
 * This improves response times and reduces database load for frequently accessed data.
 *
 * Features:
 * - Scheduled cache warming every 5 minutes
 * - Pre-loads common date ranges (today, 7 days, 30 days)
 * - Monitors cache hit rates
 * - Predictive pre-loading based on usage patterns
 */
@Injectable()
export class CacheWarmerService {
  private readonly logger = new Logger(CacheWarmerService.name);
  private readonly enabled: boolean;
  private cacheHits = 0;
  private totalRequests = 0;

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly configService: ConfigService,
  ) {
    this.enabled =
      this.configService.get<string>('ANALYTICS_CACHE_WARMER_ENABLED', 'true') === 'true';
  }

  /**
   * Warm cache every 5 minutes with popular queries
   * This ensures frequently accessed analytics data is always available in cache
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async warmPopularQueries(): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('Cache warmer is disabled');
      return;
    }

    this.logger.debug('Starting cache warming process...');
    const startTime = Date.now();

    try {
      // Define popular date ranges
      const dateRanges = [
        { name: 'Today', ...this.getTodayRange() },
        { name: '7 Days', ...this.get7DaysRange() },
        { name: '30 Days', ...this.get30DaysRange() },
        { name: 'Yesterday', ...this.getYesterdayRange() },
        { name: 'This Week', ...this.getThisWeekRange() },
        { name: 'This Month', ...this.getThisMonthRange() },
      ];

      // Warm dashboard statistics
      await Promise.allSettled(
        dateRanges.map(async range => {
          try {
            await this.analyticsService.getDashboardStats({
              startDate: range.startDate,
              endDate: range.endDate,
            });
            this.logger.debug(`Warmed dashboard stats for: ${range.name}`);
          } catch (error) {
            this.logger.error(`Failed to warm dashboard stats for ${range.name}:`, error.message);
          }
        }),
      );

      // Warm sales analytics
      await Promise.allSettled(
        dateRanges.map(async range => {
          try {
            await this.analyticsService.getSalesAnalytics({
              startDate: range.startDate,
              endDate: range.endDate,
            });
            this.logger.debug(`Warmed sales analytics for: ${range.name}`);
          } catch (error) {
            this.logger.error(`Failed to warm sales analytics for ${range.name}:`, error.message);
          }
        }),
      );

      // Warm additional popular endpoints
      await this.warmAdditionalQueries();

      const duration = Date.now() - startTime;
      this.logger.log(`Cache warming completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Cache warming failed:', error.message);
    }
  }

  /**
   * Warm additional popular analytics queries
   */
  private async warmAdditionalQueries(): Promise<void> {
    try {
      const today = this.getTodayRange();

      // Warm product metrics
      await this.analyticsService.getProductMetrics({
        startDate: today.startDate,
        endDate: today.endDate,
      });

      // Warm user engagement
      await this.analyticsService.getUserEngagement({
        startDate: today.startDate,
        endDate: today.endDate,
      });

      // Warm device statistics
      await this.analyticsService.getDeviceStatistics({
        startDate: today.startDate,
        endDate: today.endDate,
      });

      this.logger.debug('Additional queries warmed successfully');
    } catch (error) {
      this.logger.error('Failed to warm additional queries:', error.message);
    }
  }

  /**
   * Get cache hit rate statistics
   */
  getCacheHitRate(): { hits: number; total: number; rate: number } {
    const rate = this.totalRequests > 0 ? (this.cacheHits / this.totalRequests) * 100 : 0;
    return {
      hits: this.cacheHits,
      total: this.totalRequests,
      rate: Math.round(rate * 100) / 100,
    };
  }

  /**
   * Record a cache hit for monitoring
   */
  recordCacheHit(isHit: boolean): void {
    this.totalRequests++;
    if (isHit) {
      this.cacheHits++;
    }
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.cacheHits = 0;
    this.totalRequests = 0;
  }

  // Date range helpers

  private getTodayRange() {
    const today = new Date();
    return {
      startDate: startOfDay(today).toISOString(),
      endDate: endOfDay(today).toISOString(),
    };
  }

  private getYesterdayRange() {
    const yesterday = subDays(new Date(), 1);
    return {
      startDate: startOfDay(yesterday).toISOString(),
      endDate: endOfDay(yesterday).toISOString(),
    };
  }

  private get7DaysRange() {
    const today = new Date();
    return {
      startDate: startOfDay(subDays(today, 7)).toISOString(),
      endDate: endOfDay(today).toISOString(),
    };
  }

  private get30DaysRange() {
    const today = new Date();
    return {
      startDate: startOfDay(subDays(today, 30)).toISOString(),
      endDate: endOfDay(today).toISOString(),
    };
  }

  private getThisWeekRange() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = subDays(today, dayOfWeek);
    return {
      startDate: startOfDay(startOfWeek).toISOString(),
      endDate: endOfDay(today).toISOString(),
    };
  }

  private getThisMonthRange() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      startDate: startOfDay(startOfMonth).toISOString(),
      endDate: endOfDay(today).toISOString(),
    };
  }
}
