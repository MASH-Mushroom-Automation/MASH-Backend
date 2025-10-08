import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationStatus } from '@prisma/client';
import type { SmsNotificationJob } from '../services/notification-queue.service';

@Processor('sms-notifications')
export class SmsProcessor {
  private readonly logger = new Logger(SmsProcessor.name);
  private twilioClient: any; // Will be typed as twilio.Twilio when configured
  private isConfigured: boolean = false;

  constructor(private prisma: PrismaService) {
    // Check if Twilio is configured
    this.isConfigured = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );

    if (this.isConfigured) {
      try {
        // TODO: For production, install and initialize Twilio client
        // npm install twilio
        // const twilio = require('twilio');
        // this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        this.logger.log('✅ Twilio configuration detected (simulation mode)');
      } catch (error) {
        this.logger.error(`Failed to initialize Twilio: ${error.message}`);
        this.isConfigured = false;
      }
    } else {
      this.logger.warn(
        '⚠️ Twilio not configured. SMS notifications will be simulated.',
      );
    }
  }

  @Process('send-sms')
  async handleSmsJob(job: Job<SmsNotificationJob>) {
    const { to, body, alertId, userId, priority } = job.data;

    this.logger.log(`📱 Processing SMS job ${job.id} for: ${to}`);

    try {
      // Create notification record in database
      const notification = await this.createNotificationRecord(job.data);

      if (!this.isConfigured) {
        // Simulation mode when Twilio is not configured
        this.logger.log(`📱 [SIMULATION] SMS to ${to}: ${body}`);

        // Simulate delivery delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            deliveredAt: new Date(),
            metadata: {
              mode: 'simulation',
              provider: 'twilio-simulation',
              to,
              body: body.substring(0, 100),
              simulatedMessageId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            },
          },
        });

        return {
          success: true,
          mode: 'simulation',
          notificationId: notification.id,
          message: 'SMS simulated successfully (Twilio not configured)',
        };
      }

      // Send SMS via Twilio (uncomment when configured)
      // const message = await this.twilioClient.messages.create({
      //   body,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   to,
      // });

      // Update notification status to SENT
      // await this.prisma.notification.update({
      //   where: { id: notification.id },
      //   data: {
      //     status: NotificationStatus.SENT,
      //     sentAt: new Date(),
      //     deliveredAt: new Date(),
      //     metadata: {
      //       sid: message.sid,
      //       status: message.status,
      //     },
      //   },
      // });

      // this.logger.log(`SMS sent successfully: ${message.sid}`);

      // return {
      //   success: true,
      //   sid: message.sid,
      //   notificationId: notification.id,
      // };

      // Temporary return for now
      return {
        success: true,
        mode: 'simulation',
        notificationId: notification.id,
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`);

      // Update notification status to FAILED
      try {
        await this.prisma.notification.updateMany({
          where: {
            alertId: job.data.alertId,
            channel: 'SMS',
            status: NotificationStatus.PENDING,
          },
          data: {
            status: NotificationStatus.FAILED,
            failedAt: new Date(),
            metadata: {
              error: error.message,
            },
          },
        });
      } catch (dbError) {
        this.logger.error(
          `Failed to update notification status: ${dbError.message}`,
        );
      }

      throw error; // Bull will retry
    }
  }

  /**
   * Create notification record in database
   */
  private async createNotificationRecord(data: SmsNotificationJob) {
    return this.prisma.notification.create({
      data: {
        alertId: data.alertId || null,
        userId: data.userId || null,
        channel: 'SMS',
        status: NotificationStatus.PENDING,
        recipientPhone: data.to,
        body: data.body,
        metadata: {
          priority: data.priority || 'normal',
        },
        queuedAt: new Date(),
      },
    });
  }
}
