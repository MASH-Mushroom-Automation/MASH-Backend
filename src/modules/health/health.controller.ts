import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  DiskHealthIndicator as TerminusDiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { MemoryHealthIndicator } from './indicators/memory.health';
import { DiskHealthIndicator } from './indicators/disk.health';
import { DependenciesHealthIndicator } from './indicators/dependencies.health';

@ApiTags('Health')
@Controller('health')
@SkipThrottle() // Skip rate limiting for ALL health endpoints
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
  @Public() // Allow public access (no auth required)
  @ApiOperation({ summary: 'Fast health check for Railway deployment' })
  @ApiResponse({ status: 200, description: 'Application is healthy' })
  check() {
    // Ultra-fast response for Railway health check
    // Railway expects instant response, detailed checks in /ready and /detailed endpoints
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  @Get('ready')
  @Public() // Allow public access (no auth required)
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
  @Public() // Allow public access (no auth required)
  @ApiOperation({ summary: 'Ultra-fast liveness probe for Railway health check' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  liveness() {
    // Ultra-fast response - no health checks, just return OK
    // This is specifically for Railway's health check which needs instant response
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
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
