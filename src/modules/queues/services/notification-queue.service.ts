import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

export interface EmailNotificationJob {
  to: string[];
  subject: string;
  body: string;
  html?: string;
  alertId?: string;
  userId?: string;
  priority?: 'high' | 'normal' | 'low';
  templateId?: string;
  templateData?: Record<string, any>;
}

export interface SmsNotificationJob {
  to: string;
  body: string;
  alertId?: string;
  userId?: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface PushNotificationJob {
  token: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  alertId?: string;
  userId?: string;
  priority?: 'high' | 'normal' | 'low';
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @InjectQueue('email-notifications')
    private emailQueue: Queue,
    @InjectQueue('sms-notifications')
    private smsQueue: Queue,
    @InjectQueue('push-notifications')
    private pushQueue: Queue,
  ) {}

  /**
   * Add email notification to queue
   */
  async sendEmail(data: EmailNotificationJob): Promise<void> {
    try {
      const priority = this.getPriority(data.priority);

      await this.emailQueue.add('send-email', data, {
        priority,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(`Email queued for: ${data.to.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to queue email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add SMS notification to queue
   */
  async sendSms(data: SmsNotificationJob): Promise<void> {
    try {
      const priority = this.getPriority(data.priority);

      await this.smsQueue.add('send-sms', data, {
        priority,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(`SMS queued for: ${data.to}`);
    } catch (error) {
      this.logger.error(`Failed to queue SMS: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add push notification to queue
   */
  async sendPush(data: PushNotificationJob): Promise<void> {
    try {
      const priority = this.getPriority(data.priority);

      await this.pushQueue.add('send-push', data, {
        priority,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(`Push notification queued for token: ${data.token.substring(0, 20)}...`);
    } catch (error) {
      this.logger.error(`Failed to queue push notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [
      emailWaiting,
      emailActive,
      emailCompleted,
      emailFailed,
      smsWaiting,
      smsActive,
      smsCompleted,
      smsFailed,
      pushWaiting,
      pushActive,
      pushCompleted,
      pushFailed,
    ] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount(),
      this.smsQueue.getWaitingCount(),
      this.smsQueue.getActiveCount(),
      this.smsQueue.getCompletedCount(),
      this.smsQueue.getFailedCount(),
      this.pushQueue.getWaitingCount(),
      this.pushQueue.getActiveCount(),
      this.pushQueue.getCompletedCount(),
      this.pushQueue.getFailedCount(),
    ]);

    return {
      email: {
        waiting: emailWaiting,
        active: emailActive,
        completed: emailCompleted,
        failed: emailFailed,
      },
      sms: {
        waiting: smsWaiting,
        active: smsActive,
        completed: smsCompleted,
        failed: smsFailed,
      },
      push: {
        waiting: pushWaiting,
        active: pushActive,
        completed: pushCompleted,
        failed: pushFailed,
      },
    };
  }

  /**
   * Get priority number for Bull queue
   */
  private getPriority(priority?: string): number {
    switch (priority) {
      case 'high':
        return 1;
      case 'normal':
        return 5;
      case 'low':
        return 10;
      default:
        return 5;
    }
  }

  /**
   * Clear all queues (for testing only - requires admin authorization)
   * @param userRole - User role to verify authorization
   */
  async clearAllQueues(userRole?: string): Promise<void> {
    // Authorization check - only allow for admin users or testing environment
    if (process.env.NODE_ENV === 'production' && userRole !== 'admin') {
      throw new Error('Unauthorized: clearAllQueues requires admin privileges in production');
    }

    await Promise.all([this.emailQueue.empty(), this.smsQueue.empty(), this.pushQueue.empty()]);
    this.logger.log('All queues cleared');
  }
}
