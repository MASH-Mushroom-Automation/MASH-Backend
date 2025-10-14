import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { CacheService } from '../../common/services/cache.service';
import { AnalyticsGateway } from './gateways/analytics.gateway';
import { RealtimeAnalyticsService } from './services/realtime-analytics.service';
import { BatchProcessorService } from './services/batch-processor.service';
import { CacheWarmerService } from './services/cache-warmer.service';
import { ReportBuilderService } from './services/report-builder.service';
import { ChartDataService } from './services/chart-data.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    CacheService,
    AnalyticsGateway,
    RealtimeAnalyticsService,
    BatchProcessorService,
    CacheWarmerService,
    ReportBuilderService,
    ChartDataService,
  ],
  exports: [AnalyticsService, RealtimeAnalyticsService],
})
export class AnalyticsModule {}
