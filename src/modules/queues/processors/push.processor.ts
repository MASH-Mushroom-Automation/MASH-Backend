import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationStatus } from '@prisma/client';
import type { PushNotificationJob } from '../services/notification-queue.service';

@Processor('push-notifications')
export class PushProcessor {
  private readonly logger = new Logger(PushProcessor.name);

  constructor(private prisma: PrismaService) {
    // Firebase Admin is already initialized in your app
    this.logger.log('Push notification processor initialized');
  }

  @Process('send-push')
  async handlePushJob(job: Job<PushNotificationJob>) {
    const { token, title, body, data, alertId, userId, priority } = job.data;
    
    this.logger.log(`Processing push notification job ${job.id} for token: ${token.substring(0, 20)}...`);

    try {
      // Create notification record in database
      const notification = await this.createNotificationRecord(job.data);

      // Send push notification via Firebase
      const message = await admin.messaging().send({
        token,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
        },
        apns: {
          headers: {
            'apns-priority': priority === 'high' ? '10' : '5',
          },
        },
      });

      // Update notification status to SENT
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          deliveredAt: new Date(),
          metadata: {
            messageId: message,
            fcmToken: token.substring(0, 20) + '...',
          },
        },
      });

      this.logger.log(`Push notification sent successfully: ${message}`);
      
      return { 
        success: true, 
        messageId: message,
        notificationId: notification.id,
      };

    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      
      // Check if it's an invalid token error
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        this.logger.warn(`Invalid or unregistered FCM token: ${token.substring(0, 20)}...`);
      }

      // Update notification status to FAILED
      try {
        await this.prisma.notification.updateMany({
          where: {
            alertId: job.data.alertId,
            channel: 'PUSH',
            status: NotificationStatus.PENDING,
          },
          data: {
            status: NotificationStatus.FAILED,
            failedAt: new Date(),
            metadata: {
              error: error.message,
              code: error.code,
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
  private async createNotificationRecord(data: PushNotificationJob) {
    return this.prisma.notification.create({
      data: {
        alertId: data.alertId || null,
        userId: data.userId || null,
        channel: 'PUSH',
        status: NotificationStatus.PENDING,
        body: data.body, // Required field
        metadata: {
          title: data.title,
          body: data.body,
          data: data.data,
          priority: data.priority || 'normal',
          fcmToken: data.token.substring(0, 20) + '...',
        },
        queuedAt: new Date(),
      },
    });
  }

  /**
   * Send push to multiple tokens
   */
  async sendToMultipleDevices(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<any> {
    try {
      // Send to each token individually
      const results = await Promise.allSettled(
        tokens.map(token =>
          admin.messaging().send({
            token,
            notification: { title, body },
            data: data || {},
          })
        )
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      this.logger.log(`Sent to ${successCount} devices, failed: ${failureCount}`);
      
      return {
        successCount,
        failureCount,
        responses: results,
      };
    } catch (error) {
      this.logger.error(`Failed to send to multiple devices: ${error.message}`);
      throw error;
    }
  }
}
