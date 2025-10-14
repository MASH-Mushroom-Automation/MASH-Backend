import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { CacheService } from '../../common/services/cache.service';
import { AnalyticsGateway } from './gateways/analytics.gateway';
import { RealtimeAnalyticsService } from './services/realtime-analytics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    CacheService,
    AnalyticsGateway,
    RealtimeAnalyticsService,
  ],
  exports: [AnalyticsService, RealtimeAnalyticsService],
})
export class AnalyticsModule {}
