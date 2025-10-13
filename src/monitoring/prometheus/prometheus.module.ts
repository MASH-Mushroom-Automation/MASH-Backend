/**
 * PrometheusModule - Metrics collection and monitoring
 *
 * Features:
 * - Prometheus metrics integration
 * - Custom metrics collectors
 * - HTTP request metrics
 * - Database query metrics
 * - Cache performance metrics
 * - Rate limiting metrics
 * - Business metrics
 *
 * Endpoints:
 * - GET /metrics - Prometheus scraping endpoint
 */

import { Module } from '@nestjs/common';
import { PrometheusModule as NestPrometheusModule } from '@willsoto/nestjs-prometheus';
import { PrometheusService } from './prometheus.service';
import { PrometheusController } from './prometheus.controller';
import { MetricsInterceptor } from './interceptors/metrics.interceptor';
import { CacheService } from '../../common/services/cache.service';

@Module({
  imports: [
    NestPrometheusModule.register({
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'mash_',
        },
      },
      defaultLabels: {
        app: 'mash-backend',
        environment: process.env.NODE_ENV || 'development',
      },
    }),
  ],
  controllers: [PrometheusController],
  providers: [PrometheusService, MetricsInterceptor, CacheService],
  exports: [PrometheusService, MetricsInterceptor],
})
export class PrometheusModule {}
