import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { DebugController } from './debug.controller';
import { TestNotificationsController } from './test-notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailTemplateService } from './services/email-template.service';
import { EmailService } from './services/email.service';
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
    // PrismaService provided globally by DatabaseModule
  ],
  exports: [NotificationsService, EmailTemplateService, EmailService],
})
export class NotificationsModule {}
