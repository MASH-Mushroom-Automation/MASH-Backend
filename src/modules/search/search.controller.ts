import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('api/v1/search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly searchService: SearchService) {}

  /**
   * Test endpoint - verify Elasticsearch connection
   */
  @Get('health')
  @ApiOperation({ summary: 'Test Elasticsearch connection' })
  @ApiResponse({ status: 200, description: 'Elasticsearch is connected' })
  async healthCheck() {
    this.logger.log('🏥 Health check endpoint called');
    return this.searchService.testConnection();
  }

  /**
   * Basic product search (placeholder)
   */
  @Get('products')
  @ApiOperation({ summary: 'Search products (Quick Start endpoint)' })
  @ApiResponse({ status: 200, description: 'Search results returned' })
  @ApiQuery({ name: 'query', required: false, type: String, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page' })
  async searchProducts(
    @Query('query') query?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    this.logger.log(`🔍 Product search: "${query || 'all'}"`);
    return this.searchService.searchProducts(query || '', page || 1, limit || 20);
  }
}
