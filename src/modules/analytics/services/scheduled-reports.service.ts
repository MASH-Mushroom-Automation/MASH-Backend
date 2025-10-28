import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { ReportBuilderService } from './report-builder.service';
import { ExportService } from './export.service';
import { SubscriptionFrequency, NotificationChannel } from '@prisma/client';

@Injectable()
export class ScheduledReportsService {
  private readonly logger = new Logger(ScheduledReportsService.name);
  private readonly cronEnabled: boolean;
  private readonly emailEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportBuilder: ReportBuilderService,
    private readonly exportService: ExportService,
  ) {
    this.cronEnabled = process.env.REPORTS_CRON_ENABLED !== 'false';
    this.emailEnabled = process.env.REPORTS_EMAIL_ENABLED !== 'false';
  }

  /**
   * Create a new report subscription
   */
  async createSubscription(
    reportId: string,
    userId: string,
    data: {
      frequency: SubscriptionFrequency;
      format?: string;
      recipients?: string[];
      channel?: string;
    },
  ) {
    // Verify report exists
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    const subscription = await this.prisma.reportSubscription.create({
      data: {
        reportId,
        userId,
        frequency: data.frequency,
        channel: 'EMAIL' as any, // Default to EMAIL channel
        isActive: true,
      },
      include: {
        report: true,
      },
    });

    this.logger.log(`Created subscription ${subscription.id} for user ${userId}`);

    return subscription;
  }

  /**
   * Get all subscriptions for a user
   */
  async getUserSubscriptions(userId: string) {
    return this.prisma.reportSubscription.findMany({
      where: { userId },
      include: {
        report: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update a subscription
   */
  async updateSubscription(
    subscriptionId: string,
    userId: string,
    data: Partial<{
      frequency: SubscriptionFrequency;
      isActive: boolean;
    }>,
  ) {
    // Verify subscription exists and belongs to user
    const subscription = await this.prisma.reportSubscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    return this.prisma.reportSubscription.update({
      where: { id: subscriptionId },
      data,
      include: {
        report: true,
      },
    });
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(subscriptionId: string, userId: string) {
    // Verify subscription exists and belongs to user
    const subscription = await this.prisma.reportSubscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    await this.prisma.reportSubscription.delete({
      where: { id: subscriptionId },
    });

    this.logger.log(`Deleted subscription ${subscriptionId}`);

    return { message: 'Subscription deleted successfully' };
  }

  /**
   * Manually trigger a subscription
   */
  async triggerSubscription(subscriptionId: string, userId: string) {
    const subscription = await this.prisma.reportSubscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
      },
      include: {
        report: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    this.logger.log(`Manually triggering subscription ${subscriptionId}`);

    // Execute report and return result
    const result = await this.reportBuilder.executeReport(subscription.reportId, userId);

    return {
      message: 'Report generation triggered successfully',
      data: result,
    };
  }

  /**
   * Process daily subscriptions (runs at 6 AM daily)
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async generateDailyReports() {
    if (!this.cronEnabled) {
      return;
    }

    this.logger.log('Processing daily report subscriptions');

    const subscriptions = await this.prisma.reportSubscription.findMany({
      where: {
        frequency: SubscriptionFrequency.DAILY,
        isActive: true,
      },
      include: {
        report: true,
      },
    });

    for (const subscription of subscriptions) {
      try {
        await this.generateAndSendReport(subscription);
      } catch (error) {
        this.logger.error(
          `Failed to generate daily report for subscription ${subscription.id}`,
          error,
        );
      }
    }
  }

  /**
   * Process weekly subscriptions (runs every Monday at 6 AM)
   */
  @Cron(CronExpression.MONDAY_TO_FRIDAY_AT_6AM)
  async generateWeeklyReports() {
    if (!this.cronEnabled) {
      return;
    }

    const now = new Date();
    if (now.getDay() !== 1) {
      // Only run on Mondays
      return;
    }

    this.logger.log('Processing weekly report subscriptions');

    const subscriptions = await this.prisma.reportSubscription.findMany({
      where: {
        frequency: SubscriptionFrequency.WEEKLY,
        isActive: true,
      },
      include: {
        report: true,
      },
    });

    for (const subscription of subscriptions) {
      try {
        await this.generateAndSendReport(subscription);
      } catch (error) {
        this.logger.error(
          `Failed to generate weekly report for subscription ${subscription.id}`,
          error,
        );
      }
    }
  }

  /**
   * Process monthly subscriptions (runs on 1st of month at 6 AM)
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async generateMonthlyReports() {
    if (!this.cronEnabled) {
      return;
    }

    this.logger.log('Processing monthly report subscriptions');

    const subscriptions = await this.prisma.reportSubscription.findMany({
      where: {
        frequency: SubscriptionFrequency.MONTHLY,
        isActive: true,
      },
      include: {
        report: true,
      },
    });

    for (const subscription of subscriptions) {
      try {
        await this.generateAndSendReport(subscription);
      } catch (error) {
        this.logger.error(
          `Failed to generate monthly report for subscription ${subscription.id}`,
          error,
        );
      }
    }
  }

  /**
   * Generate and send report (internal helper)
   */
  private async generateAndSendReport(subscription: any) {
    this.logger.log(`Generating report for subscription ${subscription.id}`);

    // Execute report
    const reportData = await this.reportBuilder.executeReport(
      subscription.reportId,
      subscription.userId,
    );

    if (this.emailEnabled) {
      // In a real implementation, send email with report data
      this.logger.log(`Email sending would happen here for subscription ${subscription.id}`);
    }

    this.logger.log(`Successfully generated report for subscription ${subscription.id}`);
  }
}
