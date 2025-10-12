/**
 * DatabaseMetricsMiddleware - Track database query metrics with Prometheus
 *
 * This middleware:
 * - Records all database queries
 * - Tracks query duration
 * - Tracks query errors
 * - Categorizes queries by operation and model
 *
 * Applied to Prisma Client via $use()
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class DatabaseMetricsMiddleware implements OnModuleInit {
  private readonly logger = new Logger(DatabaseMetricsMiddleware.name);
  private prometheusService: any; // Lazy loaded to avoid circular dependency

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Lazy load PrometheusService to avoid circular dependency
    try {
      const { PrometheusService } = await import(
        '../../monitoring/prometheus/prometheus.service'
      );
      const moduleRef = await import('@nestjs/core').then((m) => m.ModuleRef);

      // Get PrometheusService instance if available
      // This is optional - metrics will be skipped if Prometheus is not configured
    } catch (error) {
      this.logger.warn(
        'PrometheusService not available - database metrics disabled',
      );
    }

    // Register Prisma middleware
    this.prisma.$use(this.metricsMiddleware.bind(this));
    this.logger.log('✅ Database metrics middleware registered');
  }

  /**
   * Prisma middleware to track query metrics
   */
  private async metricsMiddleware(
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<any>,
  ) {
    const startTime = Date.now();
    let status: 'success' | 'error' = 'success';
    let errorType: string | undefined;

    try {
      // Execute the query
      const result = await next(params);
      return result;
    } catch (error) {
      status = 'error';
      errorType = error instanceof Error ? error.name : 'UnknownError';
      throw error;
    } finally {
      const duration = Date.now() - startTime;

      // Record metrics if PrometheusService is available
      if (this.prometheusService) {
        try {
          this.prometheusService.recordDbQuery(
            params.action,
            params.model || 'unknown',
            duration,
            status,
            errorType,
          );
        } catch (err) {
          // Silently fail - don't break database operations due to metrics
          this.logger.debug('Failed to record database metrics', err);
        }
      }
    }
  }

  /**
   * Set PrometheusService instance (called by PrometheusModule)
   */
  setPrometheusService(prometheusService: any) {
    this.prometheusService = prometheusService;
    this.logger.log('✅ PrometheusService linked to database middleware');
  }
}
