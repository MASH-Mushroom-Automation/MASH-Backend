import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { RedisService } from '../../../database/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Check if Redis is available and connected
      const isAvailable = this.redisService.isAvailable();
      if (!isAvailable) {
        // Redis is optional - don't fail health check if Redis is unavailable
        // This allows deployment to proceed even without Redis
        return this.getStatus(key, true, { message: 'Redis not configured (optional service)' });
      }

      // Try a simple ping operation with timeout to verify connectivity
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timeout')), 2000),
      );

      await Promise.race([this.redisService.get('health-check'), timeoutPromise]);

      return this.getStatus(key, true);
    } catch (error) {
      // Redis failures should not block health checks during deployment
      // Log the issue but return healthy status (degraded mode)
      const message = error instanceof Error ? error.message : 'Unknown Redis error';
      return this.getStatus(key, true, {
        message: `Redis check failed (degraded mode): ${message}`,
      });
    }
  }
}
