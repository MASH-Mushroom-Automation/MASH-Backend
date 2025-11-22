import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { DateRangeQueryDto, TimeInterval } from './dto/date-range-query.dto';
import { OrderStatus } from '@prisma/client';
import { ExportService } from './services/export.service';
import { ExportConfigDto, ExportResponseDto } from './dto/export-config.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  // Cache configuration
  private readonly ANALYTICS_CACHE_PREFIX = 'analytics';
  private readonly DASHBOARD_CACHE_PREFIX = 'analytics:dashboard';
  private readonly SALES_CACHE_PREFIX = 'analytics:sales';
  private readonly PRODUCTS_CACHE_PREFIX = 'analytics:products';
  private readonly USERS_CACHE_PREFIX = 'analytics:users';
  private readonly DEVICES_CACHE_PREFIX = 'analytics:devices';
  private readonly REPORTS_CACHE_PREFIX = 'analytics:reports';
  private readonly ANALYTICS_TTL = 900; // 15 minutes (historical data rarely changes)
  private readonly DASHBOARD_TTL = 300; // 5 minutes (more dynamic)
  private readonly REPORTS_TTL = 1800; // 30 minutes (reports rarely change)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    @Inject(forwardRef(() => ExportService))
    private readonly exportService: ExportService,
  ) {}

  async getDashboardStats(query: DateRangeQueryDto) {
    // Generate cache key based on query parameters
    const cacheKey = `${this.DASHBOARD_CACHE_PREFIX}:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for dashboard stats: ${cacheKey}`);
      return cached;
    }

    const { startDate, endDate } = query;
    const where: any = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // ? Task 3.3: Parallelize ALL independent queries (7 concurrent queries)
    const [
      totalOrders,
      totalRevenue,
      totalUsers,
      deviceStats,
      activeDevices,
      pendingOrders,
      completedOrders,
    ] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.aggregate({
        where,
        _sum: {
          totalAmount: true,
        },
      }),
      this.prisma.user.count({
        where:
          startDate && endDate
            ? {
                createdAt: {
                  gte: new Date(startDate),
                  lte: new Date(endDate),
                },
              }
            : undefined,
      }),
      this.prisma.device.aggregate({
        _count: true,
      }),
      this.prisma.device.count({
        where: { isActive: true },
      }),
      this.prisma.order.count({
        where: {
          ...where,
          status: OrderStatus.PENDING,
        },
      }),
      this.prisma.order.count({
        where: {
          ...where,
          status: OrderStatus.DELIVERED,
        },
      }),
    ]);

    const result = {
      totalOrders,
      totalRevenue: Number(totalRevenue._sum.totalAmount) || 0,
      totalUsers,
      totalDevices: deviceStats._count,
      activeDevices,
      pendingOrders,
      completedOrders,
    };

    // Cache the result with 5-minute TTL (dashboard is more dynamic)
    await this.cacheService.set(cacheKey, result, this.DASHBOARD_TTL, [
      'analytics',
      'analytics:dashboard',
    ]);

    return result;
  }

  async getSalesAnalytics(query: DateRangeQueryDto) {
    // Generate cache key based on query parameters
    const cacheKey = `${this.SALES_CACHE_PREFIX}:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for sales analytics: ${cacheKey}`);
      return cached;
    }

    const { startDate, endDate } = query;
    const where: any = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [salesData, ordersByStatus] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          ...where,
          status: OrderStatus.DELIVERED,
        },
        _sum: {
          totalAmount: true,
        },
        _avg: {
          totalAmount: true,
        },
        _count: true,
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where,
        _count: true,
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    const trends = await this.getOrderTrendsGrouped(where, query.interval || TimeInterval.DAILY);

    const result = {
      totalSales: Number(salesData._sum.totalAmount) || 0,
      averageOrderValue: Number(salesData._avg.totalAmount) || 0,
      orderCount: salesData._count,
      ordersByStatus: ordersByStatus.map(status => ({
        status: status.status,
        count: status._count,
        total: Number(status._sum.totalAmount) || 0,
      })),
      trends,
    };

    // Cache the result with 15-minute TTL
    await this.cacheService.set(cacheKey, result, this.ANALYTICS_TTL, [
      'analytics',
      'analytics:sales',
    ]);

    return result;
  }

  async getProductMetrics(query: DateRangeQueryDto) {
    // Generate cache key based on query parameters
    const cacheKey = `${this.PRODUCTS_CACHE_PREFIX}:metrics:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for product metrics: ${cacheKey}`);
      return cached;
    }

    const { startDate, endDate } = query;
    const where: any = {};

    if (startDate && endDate) {
      where.order = {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      };
    }

    const orderItems: any = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where,
      _sum: {
        quantity: true,
        total: true, // OrderItem uses 'total' not 'totalAmount'
      },
      _count: true,
    });

    const result = {
      products: orderItems.map((item: any) => ({
        productId: item.productId,
        totalQuantity: item._sum.quantity || 0,
        totalRevenue: Number(item._sum.total) || 0,
        orderCount: item._count,
      })),
    };

    // Cache the result with 15-minute TTL
    await this.cacheService.set(cacheKey, result, this.ANALYTICS_TTL, [
      'analytics',
      'analytics:products',
    ]);

    return result;
  }

  async getUserEngagement(query: DateRangeQueryDto) {
    // Generate cache key based on query parameters
    const cacheKey = `${this.USERS_CACHE_PREFIX}:engagement:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for user engagement: ${cacheKey}`);
      return cached;
    }

    const { startDate, endDate } = query;
    const where: any = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [totalUsers, activeUsers, newSignups, usersByRole] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
    ]);

    const result = {
      totalUsers,
      activeUsers,
      newSignups,
      engagementRate: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
      usersByRole: usersByRole.map(role => ({
        role: role.role,
        count: role._count,
      })),
    };

    // Cache the result with 15-minute TTL
    await this.cacheService.set(cacheKey, result, this.ANALYTICS_TTL, [
      'analytics',
      'analytics:users',
    ]);

    return result;
  }

  async getDeviceStatistics(query: DateRangeQueryDto) {
    // Generate cache key based on query parameters
    const cacheKey = `${this.DEVICES_CACHE_PREFIX}:stats:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for device statistics: ${cacheKey}`);
      return cached;
    }

    const [totalDevices, activeDevices, devicesByType, sensorCount, sensorData] = await Promise.all(
      [
        this.prisma.device.count(),
        this.prisma.device.count({ where: { isActive: true } }),
        this.prisma.device.groupBy({
          by: ['type'],
          _count: true,
        }),
        this.prisma.sensor.count(),
        this.prisma.sensorData.count(),
      ],
    );

    const result = {
      totalDevices,
      activeDevices,
      devicesByType: devicesByType.map(type => ({
        type: type.type,
        count: type._count,
      })),
      sensorCount,
      sensorReadings: sensorData,
      healthRate: totalDevices > 0 ? (activeDevices / totalDevices) * 100 : 0,
    };

    // Cache the result with 15-minute TTL
    await this.cacheService.set(cacheKey, result, this.ANALYTICS_TTL, [
      'analytics',
      'analytics:devices',
    ]);

    return result;
  }

  async getOrderTrends(query: DateRangeQueryDto) {
    // Generate cache key based on query parameters
    const cacheKey = `${this.REPORTS_CACHE_PREFIX}:trends:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for order trends: ${cacheKey}`);
      return cached;
    }

    const { startDate, endDate, interval } = query;
    const where: any = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const trends = await this.getOrderTrendsGrouped(where, interval || TimeInterval.DAILY);

    const result = {
      trends,
    };

    // Cache the result with 30-minute TTL (reports are stable)
    await this.cacheService.set(cacheKey, result, this.REPORTS_TTL, [
      'analytics',
      'analytics:reports',
    ]);

    return result;
  }

  async getRevenueReports(query: DateRangeQueryDto) {
    // Generate cache key based on query parameters
    const cacheKey = `${this.REPORTS_CACHE_PREFIX}:revenue:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for revenue reports: ${cacheKey}`);
      return cached;
    }

    const { startDate, endDate } = query;
    const where: any = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // ? Task 3.3: Parallelize all 3 independent queries
    const [revenueData, revenueByStatus, trends] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          ...where,
          status: OrderStatus.DELIVERED,
        },
        _sum: {
          totalAmount: true,
        },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where,
        _sum: {
          totalAmount: true,
        },
      }),
      this.getOrderTrendsGrouped(where, query.interval || TimeInterval.MONTHLY),
    ]);

    const result = {
      totalRevenue: Number(revenueData._sum.totalAmount) || 0,
      revenueByStatus: revenueByStatus.map(status => ({
        status: status.status,
        revenue: Number(status._sum.totalAmount) || 0,
      })),
      trends,
    };

    // Cache the result with 30-minute TTL (reports are stable)
    await this.cacheService.set(cacheKey, result, this.REPORTS_TTL, [
      'analytics',
      'analytics:reports',
    ]);

    return result;
  }

  async getGrowthMetrics(query: DateRangeQueryDto) {
    // Generate cache key
    const cacheKey = `${this.REPORTS_CACHE_PREFIX}:growth:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for growth metrics: ${cacheKey}`);
      return cached;
    }
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    const [currentMonth, previousMonth, currentYear, previousYear] = await Promise.all([
      this.getMonthStats(now),
      this.getMonthStats(lastMonth),
      this.getMonthStats(now),
      this.getMonthStats(lastYear),
    ]);

    const monthOverMonth = {
      revenue:
        previousMonth.revenue > 0
          ? ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100
          : 0,
      orders:
        previousMonth.orders > 0
          ? ((currentMonth.orders - previousMonth.orders) / previousMonth.orders) * 100
          : 0,
      users:
        previousMonth.users > 0
          ? ((currentMonth.users - previousMonth.users) / previousMonth.users) * 100
          : 0,
    };

    const yearOverYear = {
      revenue:
        previousYear.revenue > 0
          ? ((currentYear.revenue - previousYear.revenue) / previousYear.revenue) * 100
          : 0,
      orders:
        previousYear.orders > 0
          ? ((currentYear.orders - previousYear.orders) / previousYear.orders) * 100
          : 0,
      users:
        previousYear.users > 0
          ? ((currentYear.users - previousYear.users) / previousYear.users) * 100
          : 0,
    };

    const result = {
      monthOverMonth,
      yearOverYear,
    };

    // Cache the result with 30-minute TTL (growth metrics don't change frequently)
    await this.cacheService.set(cacheKey, result, this.REPORTS_TTL, [
      'analytics',
      'analytics:reports',
    ]);

    return result;
  }

  async getTopProducts(query: DateRangeQueryDto) {
    // Generate cache key based on query parameters
    const cacheKey = `${this.PRODUCTS_CACHE_PREFIX}:top:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for top products: ${cacheKey}`);
      return cached;
    }
    const { startDate, endDate } = query;
    const where: any = {};

    if (startDate && endDate) {
      where.order = {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        status: OrderStatus.DELIVERED,
      };
    } else {
      where.order = { status: OrderStatus.DELIVERED };
    }

    const orderItems = await this.prisma.orderItem.findMany({
      where,
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

    const result = {
      topProducts,
    };

    // Cache the result with 30-minute TTL
    await this.cacheService.set(cacheKey, result, this.REPORTS_TTL, [
      'analytics',
      'analytics:products',
    ]);

    return result;
  }

  async getTopCategories(query: DateRangeQueryDto) {
    // Generate cache key based on query parameters
    const cacheKey = `${this.PRODUCTS_CACHE_PREFIX}:categories:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for top categories: ${cacheKey}`);
      return cached;
    }

    const { startDate, endDate } = query;

    // ? Task 3.3: Parallelize independent queries
    const [categories, products] = await Promise.all([
      this.prisma.category.findMany({
        where: { isActive: true },
      }),
      this.prisma.product.findMany({
        where: { isActive: true },
      }),
    ]);

    const categoryStats = categories.map(category => {
      const productCount = products.filter(product =>
        (product.categories as string[])?.includes(category.id),
      ).length;

      return {
        category,
        productCount,
      };
    });

    const topCategories = categoryStats
      .sort((a, b) => b.productCount - a.productCount)
      .slice(0, 10);

    const result = {
      topCategories,
    };

    // Cache the result with 30-minute TTL
    await this.cacheService.set(cacheKey, result, this.REPORTS_TTL, [
      'analytics',
      'analytics:products',
    ]);

    return result;
  }

  private async getMonthStats(date: Date) {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const [revenue, orders, users] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          status: OrderStatus.DELIVERED,
        },
        _sum: {
          totalAmount: true,
        },
      }),
      this.prisma.order.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
    ]);

    return {
      revenue: Number(revenue._sum.totalAmount) || 0,
      orders,
      users,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  }

  private async getOrderTrendsGrouped(where: any, interval: TimeInterval) {
    const orders = await this.prisma.order.findMany({
      where,
      select: {
        createdAt: true,
        totalAmount: true,
        status: true,
      },
    });

    const grouped: Record<string, any> = {};

    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = {
          date,
          count: 0,
          revenue: 0,
          completedOrders: 0,
        };
      }
      grouped[date].count += 1;
      grouped[date].revenue += Number(order.totalAmount);
      if (order.status === OrderStatus.DELIVERED) {
        grouped[date].completedOrders += 1;
      }
    });

    return Object.values(grouped);
  }

  // Export Engine Methods (delegate to ExportService)

  async createExport(config: ExportConfigDto): Promise<ExportResponseDto> {
    return this.exportService.exportData(config);
  }

  async getExportStatus(exportId: string): Promise<ExportResponseDto> {
    return this.exportService.getExportStatus(exportId);
  }

  async listExports(): Promise<ExportResponseDto[]> {
    return this.exportService.listExports();
  }

  async deleteExport(exportId: string): Promise<{ success: boolean }> {
    await this.exportService.deleteExport(exportId);
    return { success: true };
  }
}
