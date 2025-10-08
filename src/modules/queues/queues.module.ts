import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { NotificationQueueService } from './services/notification-queue.service';
import { EmailProcessor } from './processors/email.processor';
import { SmsProcessor } from './processors/sms.processor';
import { PushProcessor } from './processors/push.processor';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        // Add connection error handling
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times: number) => {
          if (times > 3) {
            // Stop retrying after 3 attempts
            return null;
          }
          return Math.min(times * 50, 2000);
        },
      },
    }),
    BullModule.registerQueue(
      { name: 'email-notifications' },
      { name: 'sms-notifications' },
      { name: 'push-notifications' },
    ),
  ],
  providers: [
    NotificationQueueService,
    EmailProcessor,
    SmsProcessor,
    PushProcessor,
  ],
  exports: [NotificationQueueService, BullModule],
})
export class QueuesModule {}
