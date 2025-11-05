import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
  MemoryHealthIndicator as TerminusMemoryHealthIndicator,
} from '@nestjs/terminus';

@Injectable()
export class MemoryHealthIndicator extends HealthIndicator {
  private readonly heapUsedThreshold = 0.95; // 95% heap usage threshold (Railway optimized)
  private readonly rssThreshold = 0.95; // 95% RSS threshold

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
      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      throw new HealthCheckError(
        'Memory usage exceeded threshold',
        result,
      );
    }

    return result;
  }
}
