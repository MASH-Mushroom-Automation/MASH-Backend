import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../common/services/cache.service';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
  format,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
} from 'date-fns';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface LineChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    tension: number;
  }>;
}

export interface BarChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
    borderWidth: number;
  }>;
}

export interface PieChartData {
  labels: string[];
  datasets: Array<{
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
    borderWidth: number;
  }>;
}

export interface AreaChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    fill: boolean;
    backgroundColor: string;
    borderColor: string;
  }>;
}

@Injectable()
export class ChartDataService {
  private readonly logger = new Logger(ChartDataService.name);

  private readonly colors = [
    { bg: 'rgba(54, 162, 235, 0.2)', border: 'rgba(54, 162, 235, 1)' },
    { bg: 'rgba(255, 99, 132, 0.2)', border: 'rgba(255, 99, 132, 1)' },
    { bg: 'rgba(255, 206, 86, 0.2)', border: 'rgba(255, 206, 86, 1)' },
    { bg: 'rgba(75, 192, 192, 0.2)', border: 'rgba(75, 192, 192, 1)' },
    { bg: 'rgba(153, 102, 255, 0.2)', border: 'rgba(153, 102, 255, 1)' },
    { bg: 'rgba(255, 159, 64, 0.2)', border: 'rgba(255, 159, 64, 1)' },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get line chart data with time-series aggregation
   */
  async getLineChartData(
    metric: string,
    dateRange: DateRange,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<LineChartData> {
    const cacheKey = `chart:line:${metric}:${groupBy}:${dateRange.start.toISOString()}:${dateRange.end.toISOString()}`;
    const cached = await this.cacheService.get<LineChartData>(cacheKey);

    if (cached) {
      return cached;
    }

    this.logger.log(`Generating line chart data for metric: ${metric}, groupBy: ${groupBy}`);

    // Generate date labels based on groupBy
    const labels = this.generateDateLabels(dateRange, groupBy);
    const data = await this.getMetricDataForDates(metric, dateRange, labels, groupBy);

    const chartData: LineChartData = {
      labels: labels.map(date => format(date, groupBy === 'month' ? 'MMM yyyy' : 'MMM dd')),
      datasets: [
        {
          label: this.getMetricLabel(metric),
          data,
          borderColor: this.colors[0].border,
          backgroundColor: this.colors[0].bg,
          tension: 0.4,
        },
      ],
    };

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, chartData, 300);

    return chartData;
  }

  /**
   * Get bar chart data for comparing metrics across categories
   */
  async getBarChartData(
    metrics: string[],
    categories: string[],
    dateRange: DateRange,
  ): Promise<BarChartData> {
    const cacheKey = `chart:bar:${metrics.join(',')}:${categories.join(',')}:${dateRange.start.toISOString()}`;
    const cached = await this.cacheService.get<BarChartData>(cacheKey);

    if (cached) {
      return cached;
    }

    this.logger.log(`Generating bar chart data for metrics: ${metrics.join(', ')}`);

    const datasets = await Promise.all(
      metrics.map(async (metric, index) => {
        const data = await this.getMetricDataForCategories(metric, categories, dateRange);

        return {
          label: this.getMetricLabel(metric),
          data,
          backgroundColor: categories.map((_, i) => this.colors[i % this.colors.length].bg),
          borderColor: categories.map((_, i) => this.colors[i % this.colors.length].border),
          borderWidth: 1,
        };
      }),
    );

    const chartData: BarChartData = {
      labels: categories,
      datasets,
    };

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, chartData, 300);

    return chartData;
  }

  /**
   * Get pie chart data for metric distribution
   */
  async getPieChartData(
    metric: string,
    groupBy: string,
    dateRange: DateRange,
  ): Promise<PieChartData> {
    const cacheKey = `chart:pie:${metric}:${groupBy}:${dateRange.start.toISOString()}`;
    const cached = await this.cacheService.get<PieChartData>(cacheKey);

    if (cached) {
      return cached;
    }

    this.logger.log(`Generating pie chart data for metric: ${metric}, groupBy: ${groupBy}`);

    const distributionData = await this.getMetricDistribution(metric, groupBy, dateRange);

    const chartData: PieChartData = {
      labels: distributionData.labels,
      datasets: [
        {
          data: distributionData.values,
          backgroundColor: distributionData.labels.map(
            (_, i) => this.colors[i % this.colors.length].bg,
          ),
          borderColor: distributionData.labels.map(
            (_, i) => this.colors[i % this.colors.length].border,
          ),
          borderWidth: 1,
        },
      ],
    };

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, chartData, 300);

    return chartData;
  }

  /**
   * Get area chart data for multiple metrics with filled areas
   */
  async getAreaChartData(
    metrics: string[],
    dateRange: DateRange,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<AreaChartData> {
    const cacheKey = `chart:area:${metrics.join(',')}:${groupBy}:${dateRange.start.toISOString()}`;
    const cached = await this.cacheService.get<AreaChartData>(cacheKey);

    if (cached) {
      return cached;
    }

    this.logger.log(`Generating area chart data for metrics: ${metrics.join(', ')}`);

    const labels = this.generateDateLabels(dateRange, groupBy);

    const datasets = await Promise.all(
      metrics.map(async (metric, index) => {
        const data = await this.getMetricDataForDates(metric, dateRange, labels, groupBy);

        return {
          label: this.getMetricLabel(metric),
          data,
          fill: true,
          backgroundColor: this.colors[index % this.colors.length].bg,
          borderColor: this.colors[index % this.colors.length].border,
        };
      }),
    );

    const chartData: AreaChartData = {
      labels: labels.map(date => format(date, groupBy === 'month' ? 'MMM yyyy' : 'MMM dd')),
      datasets,
    };

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, chartData, 300);

    return chartData;
  }

  /**
   * Generate date labels based on grouping
   */
  private generateDateLabels(dateRange: DateRange, groupBy: 'day' | 'week' | 'month'): Date[] {
    switch (groupBy) {
      case 'day':
        return eachDayOfInterval(dateRange);
      case 'week':
        return eachWeekOfInterval(dateRange);
      case 'month':
        return eachMonthOfInterval(dateRange);
    }
  }

  /**
   * Get metric data for date intervals
   */
  private async getMetricDataForDates(
    metric: string,
    dateRange: DateRange,
    dates: Date[],
    groupBy: 'day' | 'week' | 'month',
  ): Promise<number[]> {
    switch (metric) {
      case 'revenue':
        return this.getRevenueByDates(dates, groupBy);
      case 'orders':
        return this.getOrdersByDates(dates, groupBy);
      case 'users':
        return this.getUsersByDates(dates, groupBy);
      case 'products':
        return this.getProductsSoldByDates(dates, groupBy);
      default:
        return dates.map(() => 0);
    }
  }

  /**
   * Get metric data for categories
   */
  private async getMetricDataForCategories(
    metric: string,
    categories: string[],
    dateRange: DateRange,
  ): Promise<number[]> {
    const data = await Promise.all(
      categories.map(async category => {
        switch (metric) {
          case 'revenue':
            return this.getRevenueByCategory(category, dateRange);
          case 'orders':
            return this.getOrdersByCategory(category, dateRange);
          case 'products':
            return this.getProductsSoldByCategory(category, dateRange);
          default:
            return 0;
        }
      }),
    );

    return data;
  }

  /**
   * Get metric distribution
   */
  private async getMetricDistribution(
    metric: string,
    groupBy: string,
    dateRange: DateRange,
  ): Promise<{ labels: string[]; values: number[] }> {
    switch (groupBy) {
      case 'category':
        return this.getDistributionByCategory(metric, dateRange);
      case 'status':
        return this.getDistributionByStatus(metric, dateRange);
      case 'product':
        return this.getDistributionByProduct(metric, dateRange);
      default:
        return { labels: [], values: [] };
    }
  }

  /**
   * Get revenue by dates
   */
  private async getRevenueByDates(
    dates: Date[],
    groupBy: 'day' | 'week' | 'month',
  ): Promise<number[]> {
    return Promise.all(
      dates.map(async date => {
        const start = this.getStartOfPeriod(date, groupBy);
        const end = endOfDay(this.getEndOfPeriod(date, groupBy));

        const result = await this.prisma.order.aggregate({
          where: {
            createdAt: { gte: start, lte: end },
            status: { in: ['DELIVERED'] },
          },
          _sum: { total: true },
        });

        return Number(result._sum?.total || 0);
      }),
    );
  }

  /**
   * Get orders by dates
   */
  private async getOrdersByDates(
    dates: Date[],
    groupBy: 'day' | 'week' | 'month',
  ): Promise<number[]> {
    return Promise.all(
      dates.map(async date => {
        const start = this.getStartOfPeriod(date, groupBy);
        const end = endOfDay(this.getEndOfPeriod(date, groupBy));

        return this.prisma.order.count({
          where: {
            createdAt: { gte: start, lte: end },
          },
        });
      }),
    );
  }

  /**
   * Get users by dates
   */
  private async getUsersByDates(
    dates: Date[],
    groupBy: 'day' | 'week' | 'month',
  ): Promise<number[]> {
    return Promise.all(
      dates.map(async date => {
        const start = this.getStartOfPeriod(date, groupBy);
        const end = endOfDay(this.getEndOfPeriod(date, groupBy));

        return this.prisma.user.count({
          where: {
            createdAt: { gte: start, lte: end },
          },
        });
      }),
    );
  }

  /**
   * Get products sold by dates
   */
  private async getProductsSoldByDates(
    dates: Date[],
    groupBy: 'day' | 'week' | 'month',
  ): Promise<number[]> {
    return Promise.all(
      dates.map(async date => {
        const start = this.getStartOfPeriod(date, groupBy);
        const end = endOfDay(this.getEndOfPeriod(date, groupBy));

        const result = await this.prisma.orderItem.aggregate({
          where: {
            order: {
              createdAt: { gte: start, lte: end },
              status: { in: ['DELIVERED'] },
            },
          },
          _sum: { quantity: true },
        });

        return result._sum?.quantity || 0;
      }),
    );
  }

  /**
   * Get revenue by category
   * Note: Product.categories is a Json array, not a relation
   * Uses Prisma JSON filtering with array_contains to filter products by category
   */
  private async getRevenueByCategory(categoryId: string, dateRange: DateRange): Promise<number> {
    // Use Prisma JSON filtering for Product.categories array
    const result = await this.prisma.orderItem.aggregate({
      where: {
        product: {
          categories: {
            path: [],
            array_contains: categoryId,
          } as any, // Type assertion needed for Prisma JSON filtering
        },
        order: {
          createdAt: { gte: dateRange.start, lte: dateRange.end },
          status: { in: ['DELIVERED'] },
        },
      },
      _sum: { total: true }, // Sum line totals (price × quantity), not unit price
    });

    return Number(result._sum?.total || 0);
  }

  /**
   * Get orders by category
   * Note: Product.categories is a Json array, not a relation
   * Uses Prisma JSON filtering with array_contains to filter products by category
   */
  private async getOrdersByCategory(categoryId: string, dateRange: DateRange): Promise<number> {
    // Use Prisma JSON filtering for Product.categories array
    return this.prisma.order.count({
      where: {
        createdAt: { gte: dateRange.start, lte: dateRange.end },
        orderItems: {
          some: {
            product: {
              categories: {
                path: [],
                array_contains: categoryId,
              } as any, // Type assertion needed for Prisma JSON filtering
            },
          },
        },
      },
    });
  }

  /**
   * Get products sold by category
   * Note: Product.categories is a Json array, not a relation
   * Uses Prisma JSON filtering with array_contains to filter products by category
   */
  private async getProductsSoldByCategory(
    categoryId: string,
    dateRange: DateRange,
  ): Promise<number> {
    // Use Prisma JSON filtering for Product.categories array
    const result = await this.prisma.orderItem.aggregate({
      where: {
        product: {
          categories: {
            path: [],
            array_contains: categoryId,
          } as any, // Type assertion needed for Prisma JSON filtering
        },
        order: {
          createdAt: { gte: dateRange.start, lte: dateRange.end },
          status: { in: ['DELIVERED'] },
        },
      },
      _sum: { quantity: true },
    });

    return result._sum?.quantity || 0;
  }

  /**
   * Get distribution by category
   */
  private async getDistributionByCategory(
    metric: string,
    dateRange: DateRange,
  ): Promise<{ labels: string[]; values: number[] }> {
    const categories = await this.prisma.category.findMany({
      select: { id: true, name: true },
    });

    const values = await Promise.all(
      categories.map(cat => this.getMetricDataForCategories(metric, [cat.id], dateRange)),
    );

    return {
      labels: categories.map(cat => cat.name),
      values: values.map(v => v[0]),
    };
  }

  /**
   * Get distribution by status
   */
  private async getDistributionByStatus(
    metric: string,
    dateRange: DateRange,
  ): Promise<{ labels: string[]; values: number[] }> {
    const orders = await this.prisma.order.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
      _count: true,
      _sum: { total: true },
    });

    return {
      labels: orders.map(o => o.status),
      values:
        metric === 'revenue'
          ? orders.map(o => Number(o._sum?.total || 0))
          : orders.map(o => o._count),
    };
  }

  /**
   * Get distribution by product
   */
  private async getDistributionByProduct(
    metric: string,
    dateRange: DateRange,
  ): Promise<{ labels: string[]; values: number[] }> {
    const topProducts = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          createdAt: { gte: dateRange.start, lte: dateRange.end },
          status: { in: ['DELIVERED'] },
        },
      },
      _sum: { quantity: true, total: true }, // Include total (price × quantity) for revenue
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });

    const products = await this.prisma.product.findMany({
      where: { id: { in: topProducts.map(p => p.productId) } },
    });

    return {
      labels: topProducts.map(item => {
        const product = products.find(p => p.id === item.productId);
        return product?.name || 'Unknown';
      }),
      values:
        metric === 'revenue'
          ? topProducts.map(item => Number(item._sum?.total || 0)) // Sum line totals, not unit price
          : topProducts.map(item => item._sum?.quantity || 0),
    };
  }

  /**
   * Get start of period based on groupBy
   */
  private getStartOfPeriod(date: Date, groupBy: 'day' | 'week' | 'month'): Date {
    switch (groupBy) {
      case 'day':
        return startOfDay(date);
      case 'week':
        return startOfWeek(date);
      case 'month':
        return startOfMonth(date);
    }
  }

  /**
   * Get end of period
   */
  private getEndOfPeriod(date: Date, groupBy: 'day' | 'week' | 'month'): Date {
    switch (groupBy) {
      case 'day':
        return endOfDay(date);
      case 'week':
        return endOfWeek(date);
      case 'month':
        return endOfMonth(date);
    }
  }

  /**
   * Get human-readable metric label
   */
  private getMetricLabel(metric: string): string {
    const labels = {
      revenue: 'Revenue ($)',
      orders: 'Orders',
      users: 'Users',
      products: 'Products Sold',
    };

    return labels[metric] || metric;
  }
}
