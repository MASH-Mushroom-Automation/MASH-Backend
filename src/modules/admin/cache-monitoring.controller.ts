/**
 * CacheMonitoringController - Expose cache statistics and health endpoints
 *
 * Endpoints:
 * - GET /api/v1/cache/stats - Get cache statistics
 * - GET /api/v1/cache/health - Get cache health status
 * - POST /api/v1/cache/warm - Trigger cache warming
 * - POST /api/v1/cache/reset - Reset cache statistics
 * - GET /api/v1/cache/keys - Get cache key summary
 *
 * Access: Admin only
 */

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheManagerService } from '../../common/services/cache-manager.service';
import type { WarmCacheConfig } from '../../common/services/cache-manager.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Cache Monitoring')
@ApiBearerAuth()
@Controller('cache')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class CacheMonitoringController {
  constructor(private readonly cacheManagerService: CacheManagerService) {}

  @Get('stats')
  @Permissions('system:read')
  @ApiOperation({
    summary: 'Get cache statistics',
    description:
      'Returns comprehensive cache statistics including hit rate, miss rate, and top keys',
  })
  async getCacheStatistics() {
    const stats = await this.cacheManagerService.getCacheStatistics();
    return {
      success: true,
      data: stats,
      message: 'Cache statistics retrieved successfully',
    };
  }

  @Get('health')
  @Permissions('system:read')
  @ApiOperation({
    summary: 'Get cache health status',
    description:
      'Returns cache health status with alerts and performance metrics',
  })
  async getCacheHealth() {
    const health = await this.cacheManagerService.getCacheHealth();
    return {
      success: true,
      data: health,
      message: 'Cache health status retrieved successfully',
    };
  }

  @Post('warm')
  @Permissions('system:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger cache warming',
    description:
      'Manually trigger cache warming to preload frequently accessed data',
  })
  async warmCache(@Body() warmCacheDto: WarmCacheConfig) {
    await this.cacheManagerService.warmCache(warmCacheDto);
    return {
      success: true,
      message: 'Cache warming completed successfully',
    };
  }

  @Post('reset')
  @Permissions('system:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset cache statistics',
    description: 'Reset all cache statistics counters to zero',
  })
  async resetStatistics() {
    this.cacheManagerService.resetStatistics();
    return {
      success: true,
      message: 'Cache statistics reset successfully',
    };
  }

  @Get('keys')
  @Permissions('system:read')
  @ApiOperation({
    summary: 'Get cache key summary',
    description: 'Returns summary of cache keys grouped by prefix',
  })
  async getCacheKeySummary() {
    const summary = await this.cacheManagerService.getCacheKeySummary();
    return {
      success: true,
      data: summary,
      message: 'Cache key summary retrieved successfully',
    };
  }
}
