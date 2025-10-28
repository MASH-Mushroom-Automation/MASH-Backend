import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullAdapter } from '@bull-board/api/bullAdapter';
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
        tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined, // Enable TLS for Upstash
      },
    }),
    BullModule.registerQueue(
      { name: 'email-notifications' },
      { name: 'sms-notifications' },
      { name: 'push-notifications' },
    ),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'email-notifications',
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'sms-notifications',
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'push-notifications',
      adapter: BullAdapter,
    }),
    // Import/Export queues (Issue #30)
    BullBoardModule.forFeature({
      name: 'import',
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'export',
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'cleanup',
      adapter: BullAdapter,
    }),
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
