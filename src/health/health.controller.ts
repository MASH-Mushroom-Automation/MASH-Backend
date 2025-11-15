import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { ThrottleEndpoint } from '../common/decorators/throttle-endpoint.decorator';

/**
 * Health Check Controller
 * Provides endpoints to monitor application and database health
 */
@ApiTags('health')
@Controller('health')
@ThrottleEndpoint('CHEAP') // Health checks are lightweight - 1000 req/min
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Database Health Check
   * Tests database connectivity and response time
   *
   * @returns Database health status with connection details
   *
   * @example
   * GET /api/v1/health/database
   * Response:
   * {
   *   "status": "ok",
   *   "database": "neondb",
   *   "responseTime": 45,
   *   "connected": true,
   *   "timestamp": "2025-10-07T10:30:00.000Z"
   * }
   */
  @Get('database')
  async checkDatabase() {
    return await this.prisma.healthCheck();
  }

  /**
   * Application Health Check
   * Basic endpoint to verify API is running
   *
   * @returns Simple health status
   *
   * @example
   * GET /api/v1/health
   * Response:
   * {
   *   "status": "ok",
   *   "message": "MASH Backend API is running",
   *   "timestamp": "2025-10-07T10:30:00.000Z",
   *   "version": "1.0.0"
   * }
   */
  @Get()
  async checkHealth() {
    return {
      status: 'ok',
      message: 'MASH Backend API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  /**
   * Detailed System Health Check
   * Combines database and application health
   *
   * @returns Comprehensive system health status
   *
   * @example
   * GET /api/v1/health/system
   * Response:
   * {
   *   "status": "healthy",
   *   "checks": {
   *     "api": { "status": "ok", "uptime": 3600 },
   *     "database": { "status": "ok", "responseTime": 45, "connected": true }
   *   },
   *   "timestamp": "2025-10-07T10:30:00.000Z"
   * }
   */
  @Get('system')
  async checkSystem() {
    const dbHealth = await this.prisma.healthCheck();
    const uptime = process.uptime();

    return {
      status: dbHealth.connected ? 'healthy' : 'degraded',
      checks: {
        api: {
          status: 'ok',
          uptime: Math.floor(uptime),
          memory: {
            used: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.floor(process.memoryUsage().heapTotal / 1024 / 1024),
          },
        },
        database: {
          status: dbHealth.connected ? 'ok' : 'error',
          responseTime: dbHealth.responseTime,
          connected: dbHealth.connected,
          database: dbHealth.database,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}
