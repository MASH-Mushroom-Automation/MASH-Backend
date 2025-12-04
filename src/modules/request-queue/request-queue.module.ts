import { Module } from '@nestjs/common';
import { RequestQueueService } from './request-queue.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  providers: [RequestQueueService, PrismaService],
  exports: [RequestQueueService],
})
export class RequestQueueModule {}
