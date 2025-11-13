import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { CartCacheService } from './cart-cache.service';
import { CartStatus } from '@prisma/client';
import { PrometheusService } from '../../monitoring/prometheus/prometheus.service';

/**
 * CartSchedulerService
 * Handles scheduled tasks for cart management:
 * - Cart expiration (daily at midnight)
 * - Abandoned cart detection (every 6 hours)
 */
@Injectable()
export class CartSchedulerService {
  private readonly logger = new Logger(CartSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CartCacheService,
    private readonly prometheusService: PrometheusService,
  ) {}

  /**
   * Daily cron job to expire inactive carts
   * Runs at midnight (00:00) every day
   * - Guest carts: 7 days of inactivity
   * - User carts: 30 days of inactivity
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireInactiveCarts() {
    this.logger.log('🕐 Starting cart expiration job...');

    const now = new Date();
    const guestExpirationDate = new Date(now);
    guestExpirationDate.setDate(guestExpirationDate.getDate() - 7); // 7 days ago

    const userExpirationDate = new Date(now);
    userExpirationDate.setDate(userExpirationDate.getDate() - 30); // 30 days ago

    try {
      // Expire guest carts (7 days inactive)
      const expiredGuestCarts = await this.prisma.cart.updateMany({
        where: {
          status: CartStatus.ACTIVE,
          lastActivityAt: { lt: guestExpirationDate },
          userId: null, // Guest carts only
          sessionId: { not: null },
        },
        data: {
          status: CartStatus.EXPIRED,
          expiresAt: now,
        },
      });

      this.logger.log(`✅ Expired ${expiredGuestCarts.count} guest cart(s)`);

      // Expire user carts (30 days inactive)
      const expiredUserCarts = await this.prisma.cart.updateMany({
        where: {
          status: CartStatus.ACTIVE,
          lastActivityAt: { lt: userExpirationDate },
          userId: { not: null },
        },
        data: {
          status: CartStatus.EXPIRED,
          expiresAt: now,
        },
      });

      this.logger.log(`✅ Expired ${expiredUserCarts.count} user cart(s)`);

      // Clear cache for expired carts
      // Note: We don't have individual cart IDs here, but cache will naturally expire
      this.logger.log('🗑️ Cache will naturally expire for these carts');

      const totalExpired = expiredGuestCarts.count + expiredUserCarts.count;
      this.logger.log(
        `✅ Cart expiration job completed. Total expired: ${totalExpired}`,
      );

      return {
        expiredGuestCarts: expiredGuestCarts.count,
        expiredUserCarts: expiredUserCarts.count,
        totalExpired,
      };
    } catch (error) {
      this.logger.error('❌ Cart expiration job failed:', error);
      throw error;
    }
  }

  /**
   * Cron job to detect abandoned carts
   * Runs every 6 hours (00:00, 06:00, 12:00, 18:00)
   * Marks carts as ABANDONED if last activity was 3+ hours ago
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async detectAbandonedCarts() {
    this.logger.log('🕐 Starting abandoned cart detection job...');

    const now = new Date();
    const abandonmentThreshold = new Date(now);
    abandonmentThreshold.setHours(abandonmentThreshold.getHours() - 3); // 3 hours ago

    try {
      // Get carts that will be marked as abandoned (for metrics)
      const cartsToAbandon = await this.prisma.cart.findMany({
        where: {
          status: CartStatus.ACTIVE,
          lastActivityAt: { lt: abandonmentThreshold },
          abandonedAt: null,
          items: {
            some: {},
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      // Mark carts as abandoned
      const abandonedCarts = await this.prisma.cart.updateMany({
        where: {
          status: CartStatus.ACTIVE,
          lastActivityAt: { lt: abandonmentThreshold },
          abandonedAt: null, // Not already marked as abandoned
          items: {
            some: {}, // Has at least one item
          },
        },
        data: {
          abandonedAt: now,
        },
      });

      // Record metrics for each abandoned cart
      cartsToAbandon.forEach((cart) => {
        const userType = cart.userId ? 'authenticated' : 'guest';
        this.prometheusService.recordCartAbandonment(userType);
      });

      this.logger.log(
        `✅ Marked ${abandonedCarts.count} cart(s) as abandoned`,
      );

      // TODO: Trigger abandoned cart email notifications
      // This can be implemented in Phase 5 or later
      // For now, just log the abandoned carts for monitoring
      if (abandonedCarts.count > 0) {
        this.logger.log(
          `📧 TODO: Send ${abandonedCarts.count} abandoned cart email(s)`,
        );
      }

      return {
        abandonedCarts: abandonedCarts.count,
        timestamp: now,
      };
    } catch (error) {
      this.logger.error('❌ Abandoned cart detection job failed:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for cart expiration (for testing/admin)
   */
  async manualExpireInactiveCarts() {
    this.logger.log('🔧 Manual cart expiration triggered');
    return this.expireInactiveCarts();
  }

  /**
   * Manual trigger for abandoned cart detection (for testing/admin)
   */
  async manualDetectAbandonedCarts() {
    this.logger.log('🔧 Manual abandoned cart detection triggered');
    return this.detectAbandonedCarts();
  }

  /**
   * Get statistics about scheduled jobs
   */
  async getSchedulerStats() {
    const now = new Date();

    const stats = await this.prisma.cart.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    const guestExpirationDate = new Date(now);
    guestExpirationDate.setDate(guestExpirationDate.getDate() - 7);

    const userExpirationDate = new Date(now);
    userExpirationDate.setDate(userExpirationDate.getDate() - 30);

    const abandonmentThreshold = new Date(now);
    abandonmentThreshold.setHours(abandonmentThreshold.getHours() - 3);

    const dueForExpiration = await this.prisma.cart.count({
      where: {
        status: CartStatus.ACTIVE,
        OR: [
          {
            lastActivityAt: { lt: guestExpirationDate },
            userId: null,
          },
          {
            lastActivityAt: { lt: userExpirationDate },
            userId: { not: null },
          },
        ],
      },
    });

    const dueForAbandonment = await this.prisma.cart.count({
      where: {
        status: CartStatus.ACTIVE,
        lastActivityAt: { lt: abandonmentThreshold },
        abandonedAt: null,
        items: {
          some: {},
        },
      },
    });

    return {
      cartsByStatus: stats.reduce(
        (acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        },
        {} as Record<string, number>,
      ),
      dueForExpiration,
      dueForAbandonment,
      thresholds: {
        guestExpirationDays: 7,
        userExpirationDays: 30,
        abandonmentHours: 3,
      },
      nextRun: {
        expiration: 'Daily at 00:00',
        abandonment: 'Every 6 hours (00:00, 06:00, 12:00, 18:00)',
      },
    };
  }
}
