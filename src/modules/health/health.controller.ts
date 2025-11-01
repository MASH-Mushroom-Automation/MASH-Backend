import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  DiskHealthIndicator as TerminusDiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { MemoryHealthIndicator } from './indicators/memory.health';
import { DiskHealthIndicator } from './indicators/disk.health';
import { DependenciesHealthIndicator } from './indicators/dependencies.health';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private prisma: PrismaHealthIndicator,
    private redis: RedisHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private dependencies: DependenciesHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Comprehensive health check of all services' })
  @ApiResponse({ status: 200, description: 'All services are healthy' })
  @ApiResponse({ status: 503, description: 'One or more services are unhealthy' })
  check() {
    return this.health.check([
      () => this.prisma.isHealthy('database'),
      () => this.redis.isHealthy('cache'),
      () => this.memory.isHealthy('memory'),
      () => this.disk.isHealthy('disk'),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe - Check if app is ready to receive traffic' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  readiness() {
    // Only check critical dependencies for readiness
    return this.health.check([
      () => this.prisma.isHealthy('database'),
      () => this.redis.isHealthy('cache'),
    ]);
  }

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe - Check if app is alive' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  @ApiResponse({ status: 503, description: 'Application is not responding' })
  liveness() {
    // Simple check to see if the app is alive
    return this.health.check([
      () => this.memory.isHealthy('memory'),
    ]);
  }

  @Get('detailed')
  @HealthCheck()
  @ApiOperation({ summary: 'Detailed health check with all metrics' })
  @ApiResponse({ status: 200, description: 'Detailed health status' })
  detailed() {
    return this.health.check([
      () => this.prisma.isHealthy('database'),
      () => this.redis.isHealthy('cache'),
      () => this.memory.isHealthy('memory'),
      () => this.disk.isHealthy('disk'),
      () => this.dependencies.isHealthy('dependencies'),
      () => this.http.pingCheck('internet', 'https://www.google.com'),
    ]);
  }
}
