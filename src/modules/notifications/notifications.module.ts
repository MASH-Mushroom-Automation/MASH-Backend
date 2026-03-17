import { Module, Logger } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { DebugController } from './debug.controller';
import { TestNotificationsController } from './test-notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailTemplateService } from './services/email-template.service';
import { EmailService } from './services/email.service';
import { PushNotificationService } from './services/push-notification.service';
import { SmsService } from './services/sms.service';
import { SMSTemplateService } from './services/sms-template.service';
import { CommunicationHubService } from './services/communication-hub.service';
import { QueuesModule } from '../queues/queues.module';
import { NotificationQueueService } from '../queues/services/notification-queue.service';

const logger = new Logger('NotificationsModule');

// Check if Redis is configured
const REDIS_ENABLED = !!(process.env.REDIS_URL || process.env.REDIS_HOST);

if (!REDIS_ENABLED) {
  logger.warn('⚠️ Redis not configured - Using stub NotificationQueueService');
}

// Stub service when Redis is not available
const StubNotificationQueueService = {
  provide: NotificationQueueService,
  useValue: {
    sendEmail: async () => {
      logger.warn('Email queue unavailable - Redis not configured');
      return null;
    },
    sendSms: async () => {
      logger.warn('SMS queue unavailable - Redis not configured');
      return null;
    },
    sendPush: async () => {
      logger.warn('Push queue unavailable - Redis not configured');
      return null;
    },
    getQueueStats: async () => ({ email: null, sms: null, push: null }),
  },
};

@Module({
  imports: REDIS_ENABLED ? [QueuesModule] : [],
  controllers: [NotificationsController, DebugController, TestNotificationsController],
  providers: [
    NotificationsService,
    EmailTemplateService,
    EmailService,
    PushNotificationService,
    SmsService,
    SMSTemplateService,
    CommunicationHubService,
    // Provide stub service if Redis not available
    ...(REDIS_ENABLED ? [] : [StubNotificationQueueService]),
  ],
  exports: [
    NotificationsService,
    EmailTemplateService,
    EmailService,
    PushNotificationService,
    SmsService,
    SMSTemplateService,
    CommunicationHubService,
    // Re-export QueuesModule when Redis is enabled (NotificationQueueService belongs to QueuesModule).
    // When Redis is disabled, export the stub directly (it is in this module's own providers).
    ...(REDIS_ENABLED ? [QueuesModule] : [NotificationQueueService]),
  ],
})
export class NotificationsModule {}
