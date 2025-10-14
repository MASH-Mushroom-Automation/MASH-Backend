import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../common/services/cache.service';
import { subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class BatchProcessorService {
  private readonly logger = new Logger(BatchProcessorService.name);
  private readonly BATCH_CACHE_PREFIX = 'batch:report';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  // Run daily report at 1 AM
  @Cron('0 1 * * *')
  async generateDailyReport() {
    const enabled = process.env.ANALYTICS_BATCH_ENABLED === 'true';
    if (!enabled) return;

    this.logger.log('Starting daily report generation...');
    const startTime = Date.now();

    try {
      const yesterday = subDays(new Date(), 1);
      const report = await this.generateReport(
        startOfDay(yesterday),
        endOfDay(yesterday),
        'daily',
      );

      await this.saveReport(report, 'daily', yesterday);

      this.logger.log(`Daily report completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      this.logger.error('Daily report failed:', error);
    }
  }

  // Run weekly report every Monday at 2 AM
  @Cron('0 2 * * 1')
  async generateWeeklyReport() {
    const enabled = process.env.ANALYTICS_BATCH_ENABLED === 'true';
    if (!enabled) return;

    this.logger.log('Starting weekly report generation...');
    const startTime = Date.now();

    try {
      const lastWeek = subWeeks(new Date(), 1);
      const report = await this.generateReport(
        startOfDay(lastWeek),
        endOfDay(new Date()),
        'weekly',
      );

      await this.saveReport(report, 'weekly', lastWeek);

      this.logger.log(`Weekly report completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      this.logger.error('Weekly report failed:', error);
    }
  }

  // Run monthly report on 1st of month at 3 AM
  @Cron('0 3 1 * *')
  async generateMonthlyReport() {
    const enabled = process.env.ANALYTICS_BATCH_ENABLED === 'true';
    if (!enabled) return;

    this.logger.log('Starting monthly report generation...');
    const startTime = Date.now();

    try {
      const lastMonth = subMonths(new Date(), 1);
      const report = await this.generateReport(
        startOfDay(lastMonth),
        endOfDay(lastMonth),
        'monthly',
      );

      await this.saveReport(report, 'monthly', lastMonth);

      this.logger.log(
        `Monthly report completed in ${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error('Monthly report failed:', error);
    }
  }

  private async generateReport(startDate: Date, endDate: Date, type: string) {
    const where = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    const [orders, revenue, newUsers, topProducts, deviceActivity] =
      await Promise.all([
        this.prisma.order.count({ where }),
        this.prisma.order.aggregate({
          where,
          _sum: { total: true },
        }),
        this.prisma.user.count({ where }),
        this.prisma.orderItem.groupBy({
          by: ['productId'],
          where: {
            order: where,
          },
          _sum: { quantity: true },
          _count: true,
          orderBy: {
            _sum: { quantity: 'desc' },
          },
          take: 10,
        }),
        this.prisma.sensorData.count({ where }),
      ]);

    return {
      type,
      period: { startDate, endDate },
      metrics: {
        totalOrders: orders,
        totalRevenue: Number(revenue._sum.total) || 0,
        newUsers,
        deviceActivity,
        topProducts,
      },
      generatedAt: new Date(),
    };
  }

  private async saveReport(report: any, type: string, date: Date) {
    const cacheKey = `${this.BATCH_CACHE_PREFIX}:${type}:${date.toISOString().split('T')[0]}`;
    await this.cacheService.set(cacheKey, report, 86400 * 7); // 7 days

    // Also save to database (if Report model exists)
    // await this.prisma.report.create({ data: ... });
  }
}
