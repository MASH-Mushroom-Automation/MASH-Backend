import { Module } from '@nestjs/common';
import { RequestQueueService } from './request-queue.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [RequestQueueService, PrismaService],
  exports: [RequestQueueService],
})
export class RequestQueueModule {}
