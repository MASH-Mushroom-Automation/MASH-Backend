import { Module } from '@nestjs/common';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { RequestQueueModule } from '../request-queue/request-queue.module';

@Module({
  imports: [RequestQueueModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, PrismaService, RedisService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
