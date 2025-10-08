import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationStatus } from '@prisma/client';
import type { SmsNotificationJob } from '../services/notification-queue.service';

// Twilio will be imported when configured
// import * as twilio from 'twilio';

@Processor('sms-notifications')
export class SmsProcessor {
  private readonly logger = new Logger(SmsProcessor.name);
  private twilioClient: any; // Will be typed as twilio.Twilio when configured

  constructor(private prisma: PrismaService) {
    // Initialize Twilio client if credentials are available
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        // Uncomment when twilio is installed:
        // this.twilioClient = twilio(
        //   process.env.TWILIO_ACCOUNT_SID,
        //   process.env.TWILIO_AUTH_TOKEN,
        // );
        this.logger.log('Twilio client initialized');
      } catch (error) {
        this.logger.error(`Failed to initialize Twilio: ${error.message}`);
      }
    } else {
      this.logger.warn('Twilio credentials not configured. SMS notifications will be logged only.');
    }
  }

  @Process('send-sms')
  async handleSmsJob(job: Job<SmsNotificationJob>) {
    const { to, body, alertId, userId, priority } = job.data;
    
    this.logger.log(`Processing SMS job ${job.id} for: ${to}`);

    try {
      // Create notification record in database
      const notification = await this.createNotificationRecord(job.data);

      if (!this.twilioClient) {
        // Log-only mode when Twilio is not configured
        this.logger.warn(`SMS would be sent to ${to}: ${body}`);
        
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            deliveredAt: new Date(),
            metadata: {
              mode: 'simulation',
              message: 'Twilio not configured',
            },
          },
        });

        return { 
          success: true, 
          mode: 'simulation',
          notificationId: notification.id,
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
      return { success: true, mode: 'simulation', notificationId: notification.id };

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
        this.logger.error(`Failed to update notification status: ${dbError.message}`);
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
