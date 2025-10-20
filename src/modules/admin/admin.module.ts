import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { CacheMonitoringController } from './cache-monitoring.controller';
import { AdminService } from './admin.service';


@Module({
  controllers: [AdminController, CacheMonitoringController],
  providers: [AdminService], // PrismaService provided globally by DatabaseModule
  exports: [AdminService],
})
export class AdminModule {}
