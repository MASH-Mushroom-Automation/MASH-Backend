import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchAnalyticsService } from './search-analytics.service';

@ApiTags('Search Analytics')
@Controller('search/analytics')
export class SearchAnalyticsController {
  private readonly logger = new Logger(SearchAnalyticsController.name);

  constructor(private readonly analyticsService: SearchAnalyticsService) {}

  /**
   * Get comprehensive search analytics
   */
  @Get()
  @ApiOperation({ 
    summary: 'Get search analytics',
    description: 'Comprehensive analytics including popular queries, performance metrics, and more'
  })
  @ApiResponse({ status: 200, description: 'Analytics data returned' })
  async getAnalytics() {
    this.logger.log('📊 Fetching search analytics');
    return this.analyticsService.getAnalytics();
  }

  /**
   * Get popular search queries
   */
  @Get('popular')
  @ApiOperation({ summary: 'Get popular search queries' })
  @ApiResponse({ status: 200, description: 'Popular queries returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default: 20)' })
  async getPopularQueries(@Query('limit') limit?: number) {
    this.logger.log('📈 Fetching popular queries');
    return this.analyticsService.getPopularQueries(limit || 20);
  }

  /**
   * Get queries with zero results
   */
  @Get('zero-results')
  @ApiOperation({ 
    summary: 'Get queries with zero results',
    description: 'Helps identify missing products or improve search algorithm'
  })
  @ApiResponse({ status: 200, description: 'Zero-result queries returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default: 20)' })
  async getZeroResultQueries(@Query('limit') limit?: number) {
    this.logger.log('🔍 Fetching zero-result queries');
    return this.analyticsService.getZeroResultQueries(limit || 20);
  }

  /**
   * Get slow query statistics
   */
  @Get('slow-queries')
  @ApiOperation({ 
    summary: 'Get slow queries',
    description: 'Queries that took longer than 500ms'
  })
  @ApiResponse({ status: 200, description: 'Slow queries returned' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default: 20)' })
  async getSlowQueries(@Query('limit') limit?: number) {
    this.logger.log('🐌 Fetching slow queries');
    return this.analyticsService.getSlowQueries(limit || 20);
  }

  /**
   * Get performance metrics
   */
  @Get('performance')
  @ApiOperation({ 
    summary: 'Get performance metrics',
    description: 'Response time percentiles (p50, p95, p99) and averages'
  })
  @ApiResponse({ status: 200, description: 'Performance metrics returned' })
  async getPerformanceMetrics() {
    this.logger.log('⚡ Fetching performance metrics');
    return this.analyticsService.getPerformanceMetrics();
  }
}
