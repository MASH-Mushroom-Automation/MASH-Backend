import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { CacheService } from '../../common/services/cache.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, CacheService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
