import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

interface AlertStatistics {
  totalAlerts: number;
  activeAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;
  alertsByPriority: Record<string, number>;
  alertsByCategory: Record<string, number>;
  avgResolutionTime: number;
}

@Injectable()
export class AlertHistoryService {
  private readonly logger = new Logger(AlertHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get alert history with filtering
   */
  async getAlertHistory(query: {
    startDate?: Date;
    endDate?: Date;
    priority?: string;
    category?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const {
      startDate,
      endDate,
      priority,
      category,
      status,
      limit = 50,
      offset = 0,
    } = query;

    const where: any = {
      isDeleted: false,
    };

    if (startDate || endDate) {
      where.triggeredAt = {};
      if (startDate) where.triggeredAt.gte = startDate;
      if (endDate) where.triggeredAt.lte = endDate;
    }

    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (status) where.status = status;

    const [alerts, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        include: {
          rule: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
        orderBy: { triggeredAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.alert.count({ where }),
    ]);

    return {
      data: alerts,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get currently active (unresolved) alerts
   */
  async getActiveAlerts() {
    return this.prisma.alert.findMany({
      where: {
        status: {
          in: ['PENDING', 'SENT', 'ACKNOWLEDGED', 'ESCALATED'],
        },
      },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            description: true,
            priority: true,
            category: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { triggeredAt: 'desc' }],
    });
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string) {
    return this.prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
      },
    });
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string) {
    return this.prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * Get alert statistics for the past N days
   */
  async getAlertStatistics(days: number = 7): Promise<AlertStatistics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const alerts = await this.prisma.alert.findMany({
      where: {
        triggeredAt: {
          gte: startDate,
        },
      },
      select: {
        status: true,
        priority: true,
        category: true,
        triggeredAt: true,
        resolvedAt: true,
      },
    });

    const statistics: AlertStatistics = {
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(a => ['PENDING', 'SENT', 'ESCALATED'].includes(a.status)).length,
      acknowledgedAlerts: alerts.filter(a => a.status === 'ACKNOWLEDGED').length,
      resolvedAlerts: alerts.filter(a => a.status === 'RESOLVED').length,
      alertsByPriority: {},
      alertsByCategory: {},
      avgResolutionTime: 0,
    };

    // Calculate alerts by priority
    alerts.forEach(alert => {
      const priority = alert.priority || 'UNKNOWN';
      statistics.alertsByPriority[priority] = (statistics.alertsByPriority[priority] || 0) + 1;
    });

    // Calculate alerts by category
    alerts.forEach(alert => {
      const category = alert.category || 'UNKNOWN';
      statistics.alertsByCategory[category] = (statistics.alertsByCategory[category] || 0) + 1;
    });

    // Calculate average resolution time
    const resolvedAlerts = alerts.filter(a => a.resolvedAt);
    if (resolvedAlerts.length > 0) {
      const totalResolutionTime = resolvedAlerts.reduce((sum, alert) => {
        const resolutionTime = alert.resolvedAt!.getTime() - alert.triggeredAt.getTime();
        return sum + resolutionTime;
      }, 0);
      statistics.avgResolutionTime = Math.round(totalResolutionTime / resolvedAlerts.length / 1000 / 60); // in minutes
    }

    return statistics;
  }

  /**
   * Auto-resolve stale alerts (older than 7 days and not acknowledged)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoResolveStaleAlerts() {
    this.logger.log('Running auto-resolve for stale alerts');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await this.prisma.alert.updateMany({
      where: {
        status: {
          in: ['PENDING', 'SENT', 'ESCALATED'],
        },
        triggeredAt: {
          lt: sevenDaysAgo,
        },
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    this.logger.log(`Auto-resolved ${result.count} stale alerts`);
  }
}
