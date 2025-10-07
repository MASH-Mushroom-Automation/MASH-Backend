import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DateRangeQueryDto, TimeInterval } from './dto/date-range-query.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(query: DateRangeQueryDto) {
    const { startDate, endDate } = query;
    const where: any = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [
      totalOrders,
      totalRevenue,
      totalUsers,
      deviceStats,
      pendingOrders,
      completedOrders,
    ] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.aggregate({
        where,
        _sum: {
          total: true,
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

    const activeDevices = await this.prisma.device.count({
      where: { isActive: true },
    });

    return {
      totalOrders,
      totalRevenue: Number(totalRevenue._sum.total) || 0,
      totalUsers,
      totalDevices: deviceStats._count,
      activeDevices,
      pendingOrders,
      completedOrders,
    };
  }

  async getSalesAnalytics(query: DateRangeQueryDto) {
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
          total: true,
        },
        _avg: {
          total: true,
        },
        _count: true,
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where,
        _count: true,
        _sum: {
          total: true,
        },
      }),
    ]);

    const trends = await this.getOrderTrendsGrouped(
      where,
      query.interval || TimeInterval.DAILY,
    );

    return {
      totalSales: Number(salesData._sum.total) || 0,
      averageOrderValue: Number(salesData._avg.total) || 0,
      orderCount: salesData._count,
      ordersByStatus: ordersByStatus.map((status) => ({
        status: status.status,
        count: status._count,
        total: Number(status._sum.total) || 0,
      })),
      trends,
    };
  }

  async getProductMetrics(query: DateRangeQueryDto) {
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

    const orderItems = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where,
      _sum: {
        quantity: true,
        total: true,
      },
      _count: true,
    });

    return {
      products: orderItems.map((item) => ({
        productId: item.productId,
        totalQuantity: item._sum.quantity || 0,
        totalRevenue: Number(item._sum.total) || 0,
        orderCount: item._count,
      })),
    };
  }

  async getUserEngagement(query: DateRangeQueryDto) {
    const { startDate, endDate } = query;
    const where: any = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [totalUsers, activeUsers, newSignups, usersByRole] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.user.count({ where }),
        this.prisma.user.groupBy({
          by: ['role'],
          _count: true,
        }),
      ]);

    return {
      totalUsers,
      activeUsers,
      newSignups,
      engagementRate: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
      usersByRole: usersByRole.map((role) => ({
        role: role.role,
        count: role._count,
      })),
    };
  }

  async getDeviceStatistics(query: DateRangeQueryDto) {
    const [
      totalDevices,
      activeDevices,
      devicesByType,
      sensorCount,
      sensorData,
    ] = await Promise.all([
      this.prisma.device.count(),
      this.prisma.device.count({ where: { isActive: true } }),
      this.prisma.device.groupBy({
        by: ['type'],
        _count: true,
      }),
      this.prisma.sensor.count(),
      this.prisma.sensorData.count(),
    ]);

    return {
      totalDevices,
      activeDevices,
      devicesByType: devicesByType.map((type) => ({
        type: type.type,
        count: type._count,
      })),
      sensorCount,
      sensorReadings: sensorData,
      healthRate: totalDevices > 0 ? (activeDevices / totalDevices) * 100 : 0,
    };
  }

  async getOrderTrends(query: DateRangeQueryDto) {
    const { startDate, endDate, interval } = query;
    const where: any = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const trends = await this.getOrderTrendsGrouped(
      where,
      interval || TimeInterval.DAILY,
    );

    return {
      trends,
    };
  }

  async getRevenueReports(query: DateRangeQueryDto) {
    const { startDate, endDate } = query;
    const where: any = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [revenueData, revenueByStatus] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          ...where,
          status: OrderStatus.DELIVERED,
        },
        _sum: {
          total: true,
        },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where,
        _sum: {
          total: true,
        },
      }),
    ]);

    const trends = await this.getOrderTrendsGrouped(
      where,
      query.interval || TimeInterval.MONTHLY,
    );

    return {
      totalRevenue: Number(revenueData._sum.total) || 0,
      revenueByStatus: revenueByStatus.map((status) => ({
        status: status.status,
        revenue: Number(status._sum.total) || 0,
      })),
      trends,
    };
  }

  async getGrowthMetrics(query: DateRangeQueryDto) {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    const [currentMonth, previousMonth, currentYear, previousYear] =
      await Promise.all([
        this.getMonthStats(now),
        this.getMonthStats(lastMonth),
        this.getMonthStats(now),
        this.getMonthStats(lastYear),
      ]);

    const monthOverMonth = {
      revenue:
        previousMonth.revenue > 0
          ? ((currentMonth.revenue - previousMonth.revenue) /
              previousMonth.revenue) *
            100
          : 0,
      orders:
        previousMonth.orders > 0
          ? ((currentMonth.orders - previousMonth.orders) /
              previousMonth.orders) *
            100
          : 0,
      users:
        previousMonth.users > 0
          ? ((currentMonth.users - previousMonth.users) / previousMonth.users) *
            100
          : 0,
    };

    const yearOverYear = {
      revenue:
        previousYear.revenue > 0
          ? ((currentYear.revenue - previousYear.revenue) /
              previousYear.revenue) *
            100
          : 0,
      orders:
        previousYear.orders > 0
          ? ((currentYear.orders - previousYear.orders) / previousYear.orders) *
            100
          : 0,
      users:
        previousYear.users > 0
          ? ((currentYear.users - previousYear.users) / previousYear.users) *
            100
          : 0,
    };

    return {
      monthOverMonth,
      yearOverYear,
    };
  }

  async getTopProducts(query: DateRangeQueryDto) {
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

    return {
      topProducts,
    };
  }

  async getTopCategories(query: DateRangeQueryDto) {
    const { startDate, endDate } = query;

    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
    });

    const products = await this.prisma.product.findMany({
      where: { isActive: true },
    });

    const categoryStats = categories.map((category) => {
      const productCount = products.filter((product) =>
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

    return {
      topCategories,
    };
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
          total: true,
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
      revenue: Number(revenue._sum.total) || 0,
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
        total: true,
        status: true,
      },
    });

    const grouped: Record<string, any> = {};

    orders.forEach((order) => {
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
      grouped[date].revenue += Number(order.total);
      if (order.status === OrderStatus.DELIVERED) {
        grouped[date].completedOrders += 1;
      }
    });

    return Object.values(grouped);
  }
}
