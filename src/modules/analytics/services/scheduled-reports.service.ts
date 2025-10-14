import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { ReportBuilderService } from './report-builder.service';
import { ExportService } from './export.service';
import { SubscriptionFrequency } from '@prisma/client';

@Injectable()
export class ScheduledReportsService {
  private readonly logger = new Logger(ScheduledReportsService.name);
  private readonly isEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportBuilder: ReportBuilderService,
    private readonly exportService: ExportService,
  ) {
    this.isEnabled =
      process.env.REPORTS_CRON_ENABLED?.toLowerCase() === 'true';
    if (this.isEnabled) {
      this.logger.log('Scheduled reports service initialized');
    } else {
      this.logger.warn('Scheduled reports service disabled via environment');
    }
  }

  /**
   * Daily report generation - runs at 6:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async generateDailyReports() {
    if (!this.isEnabled) return;

    this.logger.log('Starting daily report generation...');

    try {
      const subscriptions = await this.getActiveSubscriptions(
        SubscriptionFrequency.DAILY,
      );

      for (const subscription of subscriptions) {
        await this.generateAndSendReport(subscription);
      }

      this.logger.log(
        `Daily reports completed. Generated ${subscriptions.length} reports`,
      );
    } catch (error) {
      this.logger.error('Daily report generation failed', error.stack);
    }
  }

  /**
   * Weekly report generation - runs every Monday at 7:00 AM
   */
  @Cron(CronExpression.MONDAY_TO_FRIDAY_AT_7AM)
  async generateWeeklyReports() {
    if (!this.isEnabled) return;

    const today = new Date().getDay();
    if (today !== 1) return; // Only run on Mondays

    this.logger.log('Starting weekly report generation...');

    try {
      const subscriptions = await this.getActiveSubscriptions(
        SubscriptionFrequency.WEEKLY,
      );

      for (const subscription of subscriptions) {
        await this.generateAndSendReport(subscription);
      }

      this.logger.log(
        `Weekly reports completed. Generated ${subscriptions.length} reports`,
      );
    } catch (error) {
      this.logger.error('Weekly report generation failed', error.stack);
    }
  }

  /**
   * Monthly report generation - runs on the 1st of each month at 8:00 AM
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async generateMonthlyReports() {
    if (!this.isEnabled) return;

    this.logger.log('Starting monthly report generation...');

    try {
      const subscriptions = await this.getActiveSubscriptions(
        SubscriptionFrequency.MONTHLY,
      );

      for (const subscription of subscriptions) {
        await this.generateAndSendReport(subscription);
      }

      this.logger.log(
        `Monthly reports completed. Generated ${subscriptions.length} reports`,
      );
    } catch (error) {
      this.logger.error('Monthly report generation failed', error.stack);
    }
  }

  /**
   * Get active subscriptions for a specific frequency
   */
  private async getActiveSubscriptions(frequency: SubscriptionFrequency) {
    return this.prisma.reportSubscription.findMany({
      where: {
        frequency,
        isActive: true,
      },
      include: {
        report: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Generate and send a report for a subscription
   */
  private async generateAndSendReport(subscription: any) {
    try {
      this.logger.log(
        `Generating report ${subscription.report.name} for ${subscription.user.email}`,
      );

      // Calculate date range based on frequency
      const dateRange = this.calculateDateRange(subscription.frequency);

      // Execute report
      const reportResult = await this.reportBuilder.executeReport(
        subscription.reportId,
        subscription.userId,
        dateRange.startDate,
        dateRange.endDate,
      );

      // Generate export in preferred format
      const exportFormat = subscription.format || 'pdf';
      const exportResult = await this.exportService.createExport(
        {
          reportId: subscription.reportId,
          format: exportFormat,
          filename: `${subscription.report.name}-${dateRange.startDate.toISOString().split('T')[0]}`,
        },
        subscription.userId,
      );

      // Send email with report attachment
      await this.sendReportEmail(
        subscription,
        reportResult,
        exportResult,
        dateRange,
      );

      // Update last executed timestamp
      await this.prisma.reportSubscription.update({
        where: { id: subscription.id },
        data: {
          lastExecutedAt: new Date(),
        },
      });

      this.logger.log(
        `Successfully sent report ${subscription.report.name} to ${subscription.user.email}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate report for subscription ${subscription.id}`,
        error.stack,
      );

      // Update error count
      await this.prisma.reportSubscription.update({
        where: { id: subscription.id },
        data: {
          errorCount: { increment: 1 },
        },
      });
    }
  }

  /**
   * Calculate date range based on frequency
   */
  private calculateDateRange(frequency: SubscriptionFrequency): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const endDate = new Date(now);
    let startDate: Date;

    switch (frequency) {
      case SubscriptionFrequency.DAILY:
        // Yesterday
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      case SubscriptionFrequency.WEEKLY:
        // Last 7 days
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;

      case SubscriptionFrequency.MONTHLY:
        // Last 30 days
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        break;

      default:
        // Default to last 7 days
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  }

  /**
   * Send report via email
   * NOTE: This is a placeholder - integrate with your email service (SendGrid, SES, etc.)
   */
  private async sendReportEmail(
    subscription: any,
    reportResult: any,
    exportResult: any,
    dateRange: { startDate: Date; endDate: Date },
  ) {
    const emailEnabled =
      process.env.REPORTS_EMAIL_ENABLED?.toLowerCase() === 'true';

    if (!emailEnabled) {
      this.logger.warn('Email delivery is disabled via environment');
      return;
    }

    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // Example integration:
    /*
    await this.emailService.send({
      to: subscription.user.email,
      subject: `Scheduled Report: ${subscription.report.name}`,
      template: 'scheduled-report',
      data: {
        userName: `${subscription.user.firstName} ${subscription.user.lastName}`,
        reportName: subscription.report.name,
        dateRange: {
          start: dateRange.startDate.toLocaleDateString(),
          end: dateRange.endDate.toLocaleDateString(),
        },
        summary: reportResult.summary,
        downloadLink: exportResult.downloadUrl,
      },
      attachments: [
        {
          filename: exportResult.filename,
          path: exportResult.filePath,
        },
      ],
    });
    */

    this.logger.log(
      `Email would be sent to ${subscription.user.email} (email service not configured)`,
    );
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
    },
  ) {
    // Verify report exists
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    // Create subscription
    const subscription = await this.prisma.reportSubscription.create({
      data: {
        reportId,
        userId,
        frequency: data.frequency,
        format: data.format || 'pdf',
        recipients: data.recipients || [],
        isActive: true,
      },
      include: {
        report: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(
      `Created subscription ${subscription.id} for report ${report.name}`,
    );

    return subscription;
  }

  /**
   * Get user's subscriptions
   */
  async getUserSubscriptions(userId: string) {
    return this.prisma.reportSubscription.findMany({
      where: { userId },
      include: {
        report: {
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    subscriptionId: string,
    userId: string,
    data: {
      frequency?: SubscriptionFrequency;
      format?: string;
      isActive?: boolean;
      recipients?: string[];
    },
  ) {
    // Verify ownership
    const subscription = await this.prisma.reportSubscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    // Update subscription
    const updated = await this.prisma.reportSubscription.update({
      where: { id: subscriptionId },
      data,
      include: {
        report: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(`Updated subscription ${subscriptionId}`);

    return updated;
  }

  /**
   * Delete subscription
   */
  async deleteSubscription(subscriptionId: string, userId: string) {
    // Verify ownership
    const subscription = await this.prisma.reportSubscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    // Delete subscription
    await this.prisma.reportSubscription.delete({
      where: { id: subscriptionId },
    });

    this.logger.log(`Deleted subscription ${subscriptionId}`);

    return { success: true, message: 'Subscription deleted' };
  }

  /**
   * Manually trigger report generation for a subscription
   */
  async triggerSubscription(subscriptionId: string, userId: string) {
    // Verify ownership
    const subscription = await this.prisma.reportSubscription.findFirst({
      where: { id: subscriptionId, userId },
      include: {
        report: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    this.logger.log(
      `Manually triggering subscription ${subscriptionId}`,
    );

    await this.generateAndSendReport(subscription);

    return {
      success: true,
      message: 'Report generation triggered',
    };
  }
}
