import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { NotificationQueueService } from './services/notification-queue.service';
import { EmailProcessor } from './processors/email.processor';
import { SmsProcessor } from './processors/sms.processor';
import { PushProcessor } from './processors/push.processor';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.forRoot({
      connection: {
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
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'sms-notifications',
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'push-notifications',
      adapter: BullMQAdapter,
    }),
    // Import/Export queues (Issue #30)
    BullBoardModule.forFeature({
      name: 'import',
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'export',
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'cleanup',
      adapter: BullMQAdapter,
    }),
  ],
  providers: [NotificationQueueService, EmailProcessor, SmsProcessor, PushProcessor],
  exports: [NotificationQueueService, BullModule],
})
export class QueuesModule {}
