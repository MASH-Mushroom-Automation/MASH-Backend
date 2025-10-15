import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../common/services/cache.service';
import { OrderStatus } from '@prisma/client';

/**
 * Comparison Service - Comparative Analytics
 *
 * Provides time period comparison, cohort analysis, and product performance comparison
 * for business intelligence and trend analysis.
 */
@Injectable()
export class ComparisonService {
  private readonly logger = new Logger(ComparisonService.name);
  private readonly COMPARISON_CACHE_PREFIX = 'analytics:comparison';
  private readonly COMPARISON_TTL = 1800; // 30 minutes cache

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Compare metrics between two time periods
   */
  async comparePeriods(
    metric: 'revenue' | 'orders' | 'users' | 'products',
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date,
  ): Promise<any> {
    const cacheKey = `${this.COMPARISON_CACHE_PREFIX}:periods:${metric}:${currentStart.toISOString()}:${previousStart.toISOString()}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for period comparison: ${metric}`);
      return cached;
    }

    // Validate date ranges
    if (currentStart >= currentEnd || previousStart >= previousEnd) {
      throw new BadRequestException('Invalid date ranges');
    }

    let currentData: any;
    let previousData: any;

    switch (metric) {
      case 'revenue':
        currentData = await this.getRevenueData(currentStart, currentEnd);
        previousData = await this.getRevenueData(previousStart, previousEnd);
        break;
      case 'orders':
        currentData = await this.getOrdersData(currentStart, currentEnd);
        previousData = await this.getOrdersData(previousStart, previousEnd);
        break;
      case 'users':
        currentData = await this.getUsersData(currentStart, currentEnd);
        previousData = await this.getUsersData(previousStart, previousEnd);
        break;
      case 'products':
        currentData = await this.getProductsData(currentStart, currentEnd);
        previousData = await this.getProductsData(previousStart, previousEnd);
        break;
    }

    // Calculate comparison metrics
    const change = currentData.total - previousData.total;
    const percentChange =
      previousData.total === 0 ? 0 : (change / previousData.total) * 100;

    const result = {
      current: {
        period: { start: currentStart, end: currentEnd },
        total: currentData.total,
        average: currentData.average,
        count: currentData.count,
        daily: currentData.daily,
      },
      previous: {
        period: { start: previousStart, end: previousEnd },
        total: previousData.total,
        average: previousData.average,
        count: previousData.count,
        daily: previousData.daily,
      },
      comparison: {
        change: Math.round(change * 100) / 100,
        percentChange: Math.round(percentChange * 100) / 100,
        trend:
          percentChange > 5
            ? 'increasing'
            : percentChange < -5
              ? 'decreasing'
              : 'stable',
        improvement: change > 0,
      },
      metadata: {
        metric: metric,
        generatedAt: new Date().toISOString(),
      },
    };

    await this.cacheService.set(cacheKey, result, this.COMPARISON_TTL);
    return result;
  }

  /**
   * Analyze user cohorts based on registration date
   */
  async analyzeCohorts(
    cohortType: 'weekly' | 'monthly' = 'monthly',
    months: number = 6,
  ): Promise<any> {
    const cacheKey = `${this.COMPARISON_CACHE_PREFIX}:cohorts:${cohortType}:${months}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for cohort analysis`);
      return cached;
    }

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Get users grouped by cohort
    const users = await this.prisma.user.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    // Get orders for these users
    const orders = await this.prisma.order.findMany({
      where: {
        userId: { in: users.map((u) => u.id) },
        status: OrderStatus.DELIVERED,
      },
      select: {
        userId: true,
        total: true,
        createdAt: true,
      },
    });

    // Group users into cohorts
    const cohorts = this.groupIntoCohorts(users, orders, cohortType);

    // Calculate retention and revenue metrics
    const analysis = this.analyzeCohortMetrics(cohorts);

    const result = {
      cohorts: analysis,
      summary: {
        totalCohorts: analysis.length,
        avgRetention:
          Math.round(
            (analysis.reduce((sum, c) => sum + c.retention, 0) /
              analysis.length) *
              100,
          ) / 100,
        avgLifetimeValue:
          Math.round(
            (analysis.reduce((sum, c) => sum + c.lifetimeValue, 0) /
              analysis.length) *
              100,
          ) / 100,
      },
      metadata: {
        cohortType: cohortType,
        periodMonths: months,
        generatedAt: new Date().toISOString(),
      },
    };

    await this.cacheService.set(cacheKey, result, this.COMPARISON_TTL);
    return result;
  }

  /**
   * Compare product performance
   */
  async compareProducts(
    productIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const cacheKey = `${this.COMPARISON_CACHE_PREFIX}:products:${productIds.join(',')}:${startDate.toISOString()}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for product comparison`);
      return cached;
    }

    if (productIds.length === 0) {
      throw new BadRequestException('At least one product ID required');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        price: true,
      },
    });

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        productId: { in: productIds },
        order: {
          status: OrderStatus.DELIVERED,
          createdAt: { gte: startDate, lte: endDate },
        },
      },
      select: {
        productId: true,
        quantity: true,
        price: true,
        order: {
          select: {
            createdAt: true,
          },
        },
      },
    });

    // Calculate metrics for each product
    const comparisons = products.map((product) => {
      const sales = orderItems.filter((item) => item.productId === product.id);
      const totalQuantity = sales.reduce((sum, s) => sum + s.quantity, 0);
      const totalRevenue = sales.reduce(
        (sum, s) => sum + Number(s.price) * s.quantity,
        0,
      );
      const avgOrderValue = sales.length > 0 ? totalRevenue / sales.length : 0;

      // Calculate daily sales trend
      const dailySales = this.aggregateDailySales(sales);

      return {
        product: {
          id: product.id,
          name: product.name,
          price: Number(product.price),
        },
        metrics: {
          totalQuantity: totalQuantity,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          orderCount: sales.length,
        },
        performance: {
          dailyAverage:
            Math.round((totalQuantity / dailySales.length) * 100) / 100,
          trend: this.calculateProductTrend(dailySales),
        },
      };
    });

    // Rank products
    const ranked = comparisons
      .sort((a, b) => b.metrics.totalRevenue - a.metrics.totalRevenue)
      .map((comp, index) => ({
        ...comp,
        rank: index + 1,
      }));

    const result = {
      products: ranked,
      summary: {
        productsCompared: ranked.length,
        topPerformer: ranked[0]?.product.name,
        totalRevenue:
          Math.round(
            ranked.reduce((sum, p) => sum + p.metrics.totalRevenue, 0) * 100,
          ) / 100,
      },
      metadata: {
        period: { start: startDate, end: endDate },
        generatedAt: new Date().toISOString(),
      },
    };

    await this.cacheService.set(cacheKey, result, this.COMPARISON_TTL);
    return result;
  }

  /**
   * Compare category performance
   */
  async compareCategories(startDate: Date, endDate: Date): Promise<any> {
    const cacheKey = `${this.COMPARISON_CACHE_PREFIX}:categories:${startDate.toISOString()}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for category comparison`);
      return cached;
    }

    const categories = await this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: {
          status: OrderStatus.DELIVERED,
          createdAt: { gte: startDate, lte: endDate },
        },
      },
      select: {
        quantity: true,
        price: true,
        productId: true,
        product: {
          select: {
            id: true,
            categories: true,
          },
        },
      },
    });

    // Calculate metrics for each category
    const comparisons = categories.map((category) => {
      const sales = orderItems.filter((item) => {
        if (!item.product || !Array.isArray(item.product.categories))
          return false;
        return (item.product.categories as any[]).includes(category.id);
      });
      const totalQuantity = sales.reduce((sum, s) => sum + s.quantity, 0);
      const totalRevenue = sales.reduce(
        (sum, s) => sum + Number(s.price) * s.quantity,
        0,
      );

      return {
        category: {
          id: category.id,
          name: category.name,
        },
        metrics: {
          totalQuantity: totalQuantity,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          orderCount: sales.length,
        },
      };
    });

    // Rank categories
    const ranked = comparisons
      .sort((a, b) => b.metrics.totalRevenue - a.metrics.totalRevenue)
      .map((comp, index) => ({
        ...comp,
        rank: index + 1,
        marketShare: 0, // Will calculate below
      }));

    const totalRevenue = ranked.reduce(
      (sum, c) => sum + c.metrics.totalRevenue,
      0,
    );
    ranked.forEach((category) => {
      category.marketShare =
        totalRevenue > 0
          ? Math.round((category.metrics.totalRevenue / totalRevenue) * 10000) /
            100
          : 0;
    });

    const result = {
      categories: ranked,
      summary: {
        categoriesCompared: ranked.length,
        topCategory: ranked[0]?.category.name,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
      },
      metadata: {
        period: { start: startDate, end: endDate },
        generatedAt: new Date().toISOString(),
      },
    };

    await this.cacheService.set(cacheKey, result, this.COMPARISON_TTL);
    return result;
  }

  // Helper methods

  private async getRevenueData(start: Date, end: Date): Promise<any> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        createdAt: { gte: start, lte: end },
      },
      select: {
        total: true,
        createdAt: true,
      },
    });

    const total = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const days = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      total: Math.round(total * 100) / 100,
      average: Math.round((total / days) * 100) / 100,
      count: orders.length,
      daily: this.aggregateByDay(
        orders.map((o) => ({ date: o.createdAt, value: Number(o.total) })),
      ),
    };
  }

  private async getOrdersData(start: Date, end: Date): Promise<any> {
    const orders = await this.prisma.order.count({
      where: {
        createdAt: { gte: start, lte: end },
      },
    });

    const days = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      total: orders,
      average: Math.round((orders / days) * 100) / 100,
      count: orders,
      daily: [],
    };
  }

  private async getUsersData(start: Date, end: Date): Promise<any> {
    const users = await this.prisma.user.count({
      where: {
        createdAt: { gte: start, lte: end },
      },
    });

    const days = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      total: users,
      average: Math.round((users / days) * 100) / 100,
      count: users,
      daily: [],
    };
  }

  private async getProductsData(start: Date, end: Date): Promise<any> {
    const products = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          status: OrderStatus.DELIVERED,
          createdAt: { gte: start, lte: end },
        },
      },
      _sum: { quantity: true },
    });

    const total = products.reduce((sum, p) => sum + (p._sum.quantity || 0), 0);
    const days = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      total: total,
      average: Math.round((total / days) * 100) / 100,
      count: products.length,
      daily: [],
    };
  }

  private groupIntoCohorts(
    users: any[],
    orders: any[],
    cohortType: 'weekly' | 'monthly',
  ): any[] {
    const cohortMap = new Map<string, any>();

    users.forEach((user) => {
      const cohortKey = this.getCohortKey(user.createdAt, cohortType);

      if (!cohortMap.has(cohortKey)) {
        cohortMap.set(cohortKey, {
          cohort: cohortKey,
          users: [],
          orders: [],
        });
      }

      cohortMap.get(cohortKey)!.users.push(user);
    });

    orders.forEach((order) => {
      const user = users.find((u) => u.id === order.userId);
      if (user) {
        const cohortKey = this.getCohortKey(user.createdAt, cohortType);
        if (cohortMap.has(cohortKey)) {
          cohortMap.get(cohortKey)!.orders.push(order);
        }
      }
    });

    return Array.from(cohortMap.values());
  }

  private getCohortKey(date: Date, type: 'weekly' | 'monthly'): string {
    if (type === 'monthly') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else {
      const weekNumber = this.getWeekNumber(date);
      return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    }
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  private analyzeCohortMetrics(cohorts: any[]): any[] {
    return cohorts.map((cohort) => {
      const userCount = cohort.users.length;
      const orderCount = cohort.orders.length;
      const activeUsers = new Set(cohort.orders.map((o: any) => o.userId)).size;
      const totalRevenue = cohort.orders.reduce(
        (sum: number, o: any) => sum + Number(o.total),
        0,
      );

      return {
        cohort: cohort.cohort,
        userCount: userCount,
        activeUsers: activeUsers,
        retention:
          userCount > 0
            ? Math.round((activeUsers / userCount) * 10000) / 100
            : 0,
        orderCount: orderCount,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        lifetimeValue:
          userCount > 0
            ? Math.round((totalRevenue / userCount) * 100) / 100
            : 0,
      };
    });
  }

  private aggregateByDay(data: any[]): any[] {
    const dailyMap = new Map<string, number>();

    data.forEach((item) => {
      const date = item.date.toISOString().split('T')[0];
      const current = dailyMap.get(date) || 0;
      dailyMap.set(date, current + item.value);
    });

    return Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, value }));
  }

  private aggregateDailySales(sales: any[]): any[] {
    const dailyMap = new Map<string, number>();

    sales.forEach((sale) => {
      const date = sale.order.createdAt.toISOString().split('T')[0];
      const current = dailyMap.get(date) || 0;
      dailyMap.set(date, current + sale.quantity);
    });

    return Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, quantity]) => ({ date, quantity }));
  }

  private calculateProductTrend(dailySales: any[]): string {
    if (dailySales.length < 2) return 'stable';

    const firstHalf = dailySales.slice(0, Math.floor(dailySales.length / 2));
    const secondHalf = dailySales.slice(Math.floor(dailySales.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, d) => sum + d.quantity, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, d) => sum + d.quantity, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }
}
