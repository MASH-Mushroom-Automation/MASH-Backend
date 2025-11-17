import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../common/services/cache.service';

@Injectable()
export class RealtimeAnalyticsService {
  private readonly logger = new Logger(RealtimeAnalyticsService.name);
  private readonly REALTIME_CACHE_TTL = 5; // 5 seconds for real-time

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async getLiveMetrics() {
    const cacheKey = 'realtime:metrics';
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [todayOrders, todayRevenue, activeUsers, onlineDevices] = await Promise.all([
      this.prisma.order.count({
        where: { createdAt: { gte: today } },
      }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { totalAmount: true },
      }),
      this.prisma.session.count({
        where: { expiresAt: { gt: now } },
      }),
      this.prisma.device.count({
        where: {
          status: 'ONLINE',
          lastSeen: { gte: new Date(now.getTime() - 5 * 60 * 1000) }, // Last 5 min
        },
      }),
    ]);

    const metrics = {
      todayOrders,
      todayRevenue: Number(todayRevenue._sum.totalAmount) || 0,
      activeUsers,
      onlineDevices,
      timestamp: now.toISOString(),
    };

    await this.cacheService.set(cacheKey, metrics, this.REALTIME_CACHE_TTL);
    return metrics;
  }

  async getLiveSalesData() {
    const cacheKey = 'realtime:sales';
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentOrders = await this.prisma.order.findMany({
      where: { createdAt: { gte: last24Hours } },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const data = {
      recentOrders,
      count: recentOrders.length,
      totalValue: recentOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0),
      timestamp: now.toISOString(),
    };

    await this.cacheService.set(cacheKey, data, this.REALTIME_CACHE_TTL);
    return data;
  }
}
