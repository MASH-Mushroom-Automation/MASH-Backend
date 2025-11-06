import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(PrismaHealthIndicator.name);
  private readonly healthCheckTimeout = 5000; // 5000ms timeout for health checks (increased for Railway/Render cold starts)

  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      // Race between query and timeout
      await Promise.race([
        this.prismaService.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Database health check timeout')),
            this.healthCheckTimeout,
          ),
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
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown database error';
      this.logger.error(`Database health check failed after ${responseTime}ms: ${message}`);

      throw new HealthCheckError(
        'Database health check failed',
        this.getStatus(key, false, {
          message: message,
          responseTime: `${responseTime}ms`,
          status: 'disconnected',
        }),
      );
    }
  }
}
