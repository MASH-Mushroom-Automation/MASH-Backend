import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { CacheService } from '../../common/services/cache.service';
import { AnalyticsGateway } from './gateways/analytics.gateway';
import { RealtimeAnalyticsService } from './services/realtime-analytics.service';
import { BatchProcessorService } from './services/batch-processor.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    CacheService,
    AnalyticsGateway,
    RealtimeAnalyticsService,
    BatchProcessorService,
  ],
  exports: [AnalyticsService, RealtimeAnalyticsService],
})
export class AnalyticsModule {}
