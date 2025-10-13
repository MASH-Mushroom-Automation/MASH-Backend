import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { CacheMonitoringController } from './cache-monitoring.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [AdminController, CacheMonitoringController],
  providers: [AdminService, PrismaService],
  exports: [AdminService],
})
export class AdminModule {}
