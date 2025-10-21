import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface SearchAnalytics {
  totalSearches: number;
  avgResponseTime: number;
  slowQueries: number;
  popularQueries: Array<{ query: string; count: number }>;
  zeroResultQueries: Array<{ query: string; count: number }>;
  topClickedProducts: Array<{ productId: string; clicks: number }>;
}

export interface SearchPerformanceMetrics {
  p50: number; // 50th percentile (median)
  p95: number; // 95th percentile
  p99: number; // 99th percentile
  avg: number;
  max: number;
  min: number;
}

@Injectable()
export class SearchAnalyticsService {
  private readonly logger = new Logger(SearchAnalyticsService.name);
  private readonly SLOW_QUERY_THRESHOLD = 500; // ms

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a search query
   */
  async logSearch(params: {
    query: string;
    index: string;
    resultsCount: number;
    took: number;
    filters?: any;
    sort?: any;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const isSlowQuery = params.took > this.SLOW_QUERY_THRESHOLD;

      await this.prisma.searchLog.create({
        data: {
          query: params.query,
          index: params.index,
          resultsCount: params.resultsCount,
          took: params.took,
          filters: params.filters || null,
          sort: params.sort || null,
          userId: params.userId || null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          isSlowQuery,
        },
      });

      if (isSlowQuery) {
        this.logger.warn(
          `🐌 Slow query detected: "${params.query}" took ${params.took}ms (index: ${params.index})`,
        );
      }
    } catch (error) {
      // Don't fail the search if logging fails
      this.logger.error(`Failed to log search: ${error.message}`);
    }
  }

  /**
   * Track when a user clicks on a search result
   */
  async trackClick(searchLogId: string, productId: string): Promise<void> {
    try {
      await this.prisma.searchLog.update({
        where: { id: searchLogId },
        data: { clickedResult: productId },
      });
    } catch (error) {
      this.logger.error(`Failed to track click: ${error.message}`);
    }
  }

  /**
   * Get popular search queries
   */
  async getPopularQueries(limit = 20): Promise<Array<{ query: string; count: number }>> {
    const result = await this.prisma.searchLog.groupBy({
      by: ['query'],
      _count: {
        query: true,
      },
      orderBy: {
        _count: {
          query: 'desc',
        },
      },
      take: limit,
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    return result.map((item) => ({
      query: item.query,
      count: item._count.query,
    }));
  }

  /**
   * Get queries that returned zero results
   */
  async getZeroResultQueries(limit = 20): Promise<Array<{ query: string; count: number }>> {
    const result = await this.prisma.searchLog.groupBy({
      by: ['query'],
      _count: {
        query: true,
      },
      where: {
        resultsCount: 0,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: {
        _count: {
          query: 'desc',
        },
      },
      take: limit,
    });

    return result.map((item) => ({
      query: item.query,
      count: item._count.query,
    }));
  }

  /**
   * Get slow query statistics
   */
  async getSlowQueries(limit = 20): Promise<any[]> {
    return this.prisma.searchLog.findMany({
      where: {
        isSlowQuery: true,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: {
        took: 'desc',
      },
      take: limit,
      select: {
        query,
        index: true,
        took: true,
        resultsCount: true,
        filters: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<SearchPerformanceMetrics> {
    const searches = await this.prisma.searchLog.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      select: {
        took: true,
      },
      orderBy: {
        took: 'asc',
      },
    });

    if (searches.length === 0) {
      return {
        p50: 0,
        p95: 0,
        p99: 0,
        avg: 0,
        max: 0,
        min: 0,
      };
    }

    const times = searches.map((s) => s.took);
    const sum = times.reduce((a, b) => a + b, 0);

    return {
      p50: this.percentile(times, 0.5),
      p95: this.percentile(times, 0.95),
      p99: this.percentile(times, 0.99),
      avg: Math.round(sum / times.length),
      max: Math.max(...times),
      min: Math.min(...times),
    };
  }

  /**
   * Get comprehensive analytics
   */
  async getAnalytics(): Promise<SearchAnalytics> {
    const [totalSearches, avgResponse, slowQueries, popularQueries, zeroResultQueries, topClicked] =
      await Promise.all([
        // Total searches (last 30 days)
        this.prisma.searchLog.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),

        // Average response time
        this.prisma.searchLog.aggregate({
          _avg: {
            took: true,
          },
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        }),

        // Slow queries count
        this.prisma.searchLog.count({
          where: {
            isSlowQuery: true,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),

        // Popular queries
        this.getPopularQueries(10),

        // Zero result queries
        this.getZeroResultQueries(10),

        // Top clicked products
        this.getTopClickedProducts(10),
      ]);

    return {
      totalSearches,
      avgResponseTime: Math.round(avgResponse._avg.took || 0),
      slowQueries,
      popularQueries,
      zeroResultQueries,
      topClickedProducts: topClicked,
    };
  }

  /**
   * Get top clicked products from search results
   */
  private async getTopClickedProducts(limit = 10): Promise<Array<{ productId: string; clicks: number }>> {
    const result = await this.prisma.searchLog.groupBy({
      by: ['clickedResult'],
      _count: {
        clickedResult: true,
      },
      where: {
        clickedResult: {
          not: null,
        },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: {
        _count: {
          clickedResult: 'desc',
        },
      },
      take: limit,
    });

    return result.map((item) => ({
      productId: item.clickedResult,
      clicks: item._count.clickedResult,
    }));
  }

  /**
   * Calculate percentile
   */
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }

  /**
   * Clean up old search logs (retention policy)
   */
  async cleanupOldLogs(daysToKeep = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await this.prisma.searchLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`🗑️ Cleaned up ${result.count} search logs older than ${daysToKeep} days`);
    return result.count;
  }
}
