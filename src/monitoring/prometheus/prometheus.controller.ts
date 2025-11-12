/**
 * PrometheusController - Expose metrics endpoints
 *
 * Endpoints:
 * - GET /metrics - Prometheus scraping endpoint (text/plain format)
 * - GET /metrics/json - Metrics in JSON format (debugging)
 * - GET /metrics/health - Metrics system health check
 * - POST /metrics/reset - Reset all metrics (admin only)
 *
 * Security:
 * - /metrics endpoint should be restricted to Prometheus server IP
 * - /metrics/reset requires admin authentication
 */

import { Controller, Get, Post, HttpCode, HttpStatus, Headers } from '@nestjs/common';
import { PrometheusService } from './prometheus.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('metrics')
@Controller('metrics')
@SkipThrottle() // Skip rate limiting entirely - Prometheus scrapes every 5-15 seconds, no DB queries needed
export class PrometheusController {
  constructor(private readonly prometheusService: PrometheusService) {}

  /**
   * Prometheus metrics scraping endpoint
   * Returns metrics in Prometheus text format
   *
   * This endpoint should be:
   * - Scraped by Prometheus every 15-30 seconds
   * - Restricted to Prometheus server IP (via nginx/firewall)
   * - Not exposed to public internet
   *
   * @returns Metrics in Prometheus text format
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description: 'Returns all metrics in Prometheus text format for scraping',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics returned successfully',
    content: {
      'text/plain': {
        example: `# HELP mash_http_requests_total Total number of HTTP requests
# TYPE mash_http_requests_total counter
mash_http_requests_total{method="GET",route="/api/v1/products",status_code="200"} 1250
mash_http_requests_total{method="POST",route="/api/v1/orders",status_code="201"} 45`,
      },
    },
  })
  async getMetrics() {
    return this.prometheusService.getMetrics();
  }

  /**
   * Get metrics in JSON format (for debugging)
   * Useful for viewing metrics in browser or Postman
   *
   * @returns Metrics as JSON array
   */
  @Get('json')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get metrics in JSON format',
    description: 'Returns all metrics as JSON for debugging purposes',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics returned successfully',
  })
  async getMetricsAsJson() {
    return this.prometheusService.getMetricsAsJson();
  }

  /**
   * Metrics system health check
   * Verifies that metrics collection is working
   *
   * @returns Health status of metrics system
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Metrics system health check',
    description: 'Verifies that Prometheus metrics collection is operational',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics system is healthy',
  })
  async checkHealth() {
    const metrics = await this.prometheusService.getMetricsAsJson();

    return {
      status: 'healthy',
      metricsCount: metrics.length,
      timestamp: new Date().toISOString(),
      message: 'Prometheus metrics collection is operational',
    };
  }

  /**
   * Reset all metrics (admin only)
   * WARNING: This will clear all collected metrics
   *
   * Use cases:
   * - Testing
   * - After major system changes
   * - Clearing corrupted metrics
   *
   * NOTE: In production, this should require admin authentication
   */
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard) // Uncomment for production
  // @Roles('SUPER_ADMIN') // Uncomment for production
  @ApiOperation({
    summary: 'Reset all metrics',
    description: 'Clears all collected metrics (admin only, use with caution)',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics reset successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  resetMetrics() {
    this.prometheusService.resetMetrics();

    return {
      success: true,
      message: 'All Prometheus metrics have been reset',
      timestamp: new Date().toISOString(),
    };
  }
}
