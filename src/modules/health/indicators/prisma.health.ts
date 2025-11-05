import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(PrismaHealthIndicator.name);
  private readonly healthCheckTimeout = 500; // 500ms timeout for health checks

  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    
    try {
      // Race between query and timeout
      const result = await Promise.race([
        this.prismaService.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database health check timeout')), this.healthCheckTimeout),
        ),
      ]);

      const responseTime = Date.now() - startTime;
      
      // Log slow health checks (> 200ms is concerning)
      if (responseTime > 200) {
        this.logger.warn(`Slow database health check: ${responseTime}ms`);
      }

      return this.getStatus(key, true, {
        responseTime: `${responseTime}ms`,
        status: 'connected',
      });
    } catch (e) {
      const responseTime = Date.now() - startTime;
      this.logger.error(`Database health check failed after ${responseTime}ms: ${e.message}`);
      
      throw new HealthCheckError(
        'Database health check failed',
        this.getStatus(key, false, {
          message: e.message,
          responseTime: `${responseTime}ms`,
          status: 'disconnected',
        }),
      );
    }
  }
}
