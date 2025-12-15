import { BullModule } from '@nestjs/bullmq';
import { Module, Logger } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { NotificationQueueService } from './services/notification-queue.service';
import { EmailProcessor } from './processors/email.processor';
import { SmsProcessor } from './processors/sms.processor';
import { PushProcessor } from './processors/push.processor';
import { DatabaseModule } from '../../database/database.module';

const logger = new Logger('QueuesModule');

// Check if Redis is configured
const REDIS_ENABLED = !!(process.env.REDIS_URL || process.env.REDIS_HOST);

if (!REDIS_ENABLED) {
  logger.warn('⚠️ Redis not configured - Job queues (BullMQ) will be disabled');
  logger.warn('Features affected: background email/SMS/push notifications, import/export jobs');
}

// BullMQ connection config - only used when Redis is available
const bullConnection = REDIS_ENABLED
  ? {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    }
  : undefined;

@Module({
  imports: [
    DatabaseModule,
    // Only configure BullModule if Redis is available
    ...(REDIS_ENABLED
      ? [
          BullModule.forRoot({
            connection: bullConnection,
          }),
          BullModule.registerQueue(
            { name: 'email-notifications' },
            { name: 'sms-notifications' },
            { name: 'push-notifications' },
          ),
          BullBoardModule.forRoot({
            route: '/admin/queues',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            adapter: ExpressAdapter as any,
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
        ]
      : []),
  ],
  providers: REDIS_ENABLED
    ? [NotificationQueueService, EmailProcessor, SmsProcessor, PushProcessor]
    : [],
  exports: REDIS_ENABLED ? [NotificationQueueService, BullModule] : [],
})
export class QueuesModule {}
