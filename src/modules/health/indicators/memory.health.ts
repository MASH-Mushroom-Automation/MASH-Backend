import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
  MemoryHealthIndicator as TerminusMemoryHealthIndicator,
} from '@nestjs/terminus';

@Injectable()
export class MemoryHealthIndicator extends HealthIndicator {
  private readonly heapUsedThreshold = 0.98; // 98% heap usage threshold (increased for Railway)
  private readonly rssThreshold = 0.98; // 98% RSS threshold (increased for Railway)

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const memoryUsage = process.memoryUsage();
    const heapUsedPercentage = memoryUsage.heapUsed / memoryUsage.heapTotal;
    const rssPercentage = memoryUsage.rss / memoryUsage.heapTotal;

    const isHealthy = heapUsedPercentage < this.heapUsedThreshold && rssPercentage < this.rssThreshold;

    const result = this.getStatus(key, isHealthy, {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsedPercentage: `${Math.round(heapUsedPercentage * 100)}%`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
    });

    if (!isHealthy) {
      throw new HealthCheckError(
        'Memory usage exceeded threshold',
        result,
      );
    }

    return result;
  }
}
