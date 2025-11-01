import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
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
        throw new Error('Redis is not available or connected');
      }

      // Try a simple get operation to verify connectivity
      await this.redisService.get('health-check');

      return this.getStatus(key, true);
    } catch (e) {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { message: e.message }),
      );
    }
  }
}
