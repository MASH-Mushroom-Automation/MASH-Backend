import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { OrderStatus, UserRole } from '@prisma/client';

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getOverview() {
    const [cards] = await Promise.all([this.getCardsSummary()]);
    return { cards };
  }

  async getDailySales(days = 7) {
    return this.prisma.order
      .findMany({
        where: {
          status: OrderStatus.CONFIRMED, // ← Fixed
          createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
        },
        select: { createdAt: true, total: true },
      })
      .then(orders => {
        const buckets: Record<string, number> = {};
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          buckets[key] = 0;
        }
        for (const o of orders) {
          const key = new Date(o.createdAt).toISOString().slice(0, 10);
          buckets[key] = (buckets[key] || 0) + Number(o.total || 0);
        }
        const labels = Object.keys(buckets).sort();
        const values = labels.map(k => buckets[k]);
        return { labels, values };
      });
  }

  async getChamberRegistry(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [devices, total] = await Promise.all([
      this.prisma.device.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.device.count(),
    ]);

    const data = devices.map((d: any) => ({
      chamberId: d.serialNumber || d.id,
      growerName: d.user ? `${d.user.firstName || ''} ${d.user.lastName || ''}`.trim() : null,
      location: d.location,
      status: d.isActive ? 'Active' : 'Inactive',
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUsersStats() {
    try {
      const groups = await this.prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      });
      const result: Record<string, number> = {};
      for (const g of groups) result[g.role || 'UNKNOWN'] = g._count?.id || 0;
      return result;
    } catch (error) {
      this.logger.warn('groupBy not supported or failed, falling back to total count');
      const total = await this.prisma.user.count();
      return { total };
    }
  }

  async getCardsSummary() {
    const [
      chambersActive,
      chambersInactive,
      ordersCompleted,
      ordersPending,
      productsApproved,
      productsPending,
      sellersApproved,
      sellersPending,
    ] = await Promise.all([
      this.prisma.device.count({ where: { isActive: true } }),
      this.prisma.device.count({ where: { isActive: false } }),
      this.prisma.order.count({ where: { status: OrderStatus.CONFIRMED } }), // ← Fixed
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }), // ← Fixed
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.product.count({ where: { isActive: false } }),
      this.prisma.user.count({ where: { role: UserRole.GROWER, isActive: true } }),
      this.prisma.user.count({ where: { role: UserRole.GROWER, isActive: false } }),
    ]);

    return {
      chambers: { active: chambersActive, inactive: chambersInactive },
      orders: { completed: ordersCompleted, pending: ordersPending },
      products: { approved: productsApproved, pending: productsPending },
      sellerApplications: {
        approved: sellersApproved,
        pending: sellersPending,
      },
    };
  }
}
