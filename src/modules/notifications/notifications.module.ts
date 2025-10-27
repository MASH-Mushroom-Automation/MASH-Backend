import { Module } from '@nestjs/common';
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

@Module({
  imports: [QueuesModule],
  controllers: [
    NotificationsController,
    DebugController,
    TestNotificationsController,
  ],
  providers: [
    NotificationsService,
    EmailTemplateService,
    EmailService,
    PushNotificationService,
    SmsService,
    SMSTemplateService,
    CommunicationHubService,
    // PrismaService provided globally by DatabaseModule
  ],
  exports: [
    NotificationsService,
    EmailTemplateService,
    EmailService,
    PushNotificationService,
    SmsService,
    SMSTemplateService,
    CommunicationHubService,
  ],
})
export class NotificationsModule {}
