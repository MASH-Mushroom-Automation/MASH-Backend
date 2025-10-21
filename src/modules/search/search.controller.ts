import { Controller, Get, Post, Query, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { ProductIndexerService } from './indexers/product-indexer.service';
import { SearchProductsDto, AutocompleteDto } from './dto';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly productIndexer: ProductIndexerService,
  ) {}

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
   * Advanced product search with filtering, sorting, and facets
   */
  @Get('products')
  @ApiOperation({ 
    summary: 'Search products with advanced filtering',
    description: 'Full-text search with filters, sorting, and optional facets'
  })
  @ApiResponse({ status: 200, description: 'Search results returned' })
  @ApiQuery({ name: 'query', required: false, type: String, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page (max 100)' })
  @ApiQuery({ name: 'minPrice', required: false, type: Number, description: 'Minimum price filter' })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number, description: 'Maximum price filter' })
  @ApiQuery({ name: 'categories', required: false, type: [String], description: 'Category filters' })
  @ApiQuery({ name: 'minRating', required: false, type: Number, description: 'Minimum rating filter' })
  @ApiQuery({ name: 'inStock', required: false, type: Boolean, description: 'Only show in-stock products' })
  @ApiQuery({ name: 'tags', required: false, type: [String], description: 'Tag filters' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['relevance', 'price', 'rating', 'createdAt', 'name'], description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
  @ApiQuery({ name: 'includeFacets', required: false, type: Boolean, description: 'Include facets in response' })
  async searchProducts(@Query() dto: SearchProductsDto) {
    const startTime = Date.now();
    this.logger.log(`🔍 Advanced search: "${dto.query || 'all'}" with filters`);
    
    const results = await this.searchService.searchProducts(dto);
    const totalTime = Date.now() - startTime;
    
    this.logger.log(`✅ Search completed in ${totalTime}ms`);
    return results;
  }

  /**
   * Autocomplete suggestions for product names
   */
  @Get('autocomplete')
  @ApiOperation({ 
    summary: 'Get autocomplete suggestions',
    description: 'Fast prefix-based product name suggestions (target <100ms)'
  })
  @ApiResponse({ status: 200, description: 'Autocomplete suggestions returned' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Query string (min 2 chars)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max suggestions (default 10)' })
  async autocomplete(@Query() dto: AutocompleteDto) {
    const startTime = Date.now();
    const { q, limit = 10 } = dto;
    
    if (!q || q.length < 2) {
      return {
        suggestions: [],
        message: 'Query must be at least 2 characters',
      };
    }

    const suggestions = await this.searchService.autocomplete(q, limit);
    const took = Date.now() - startTime;
    
    this.logger.log(`🔤 Autocomplete for "${q}" completed in ${took}ms`);
    
    return {
      query: q,
      suggestions,
      took,
    };
  }

  /**
   * Find similar products using More Like This
   */
  @Get('products/:id/similar')
  @ApiOperation({ 
    summary: 'Find similar products',
    description: 'Get products similar to the specified product based on content'
  })
  @ApiResponse({ status: 200, description: 'Similar products returned' })
  @ApiParam({ name: 'id', type: String, description: 'Product ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default 5)' })
  async findSimilarProducts(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    const startTime = Date.now();
    const results = await this.searchService.findSimilarProducts(id, limit || 5);
    const took = Date.now() - startTime;
    
    this.logger.log(`🔗 Similar products for ${id} found in ${took}ms`);
    
    return {
      productId: id,
      similar: results,
      count: results.length,
      took,
    };
  }

  /**
   * Manually trigger full product reindexing
   */
  @Post('reindex/products')
  @ApiOperation({ 
    summary: 'Reindex all products', 
    description: 'Triggers a full reindex of all products from database to Elasticsearch'
  })
  @ApiResponse({ status: 200, description: 'Reindexing completed successfully' })
  async reindexProducts() {
    this.logger.log('🔄 Starting product reindex...');
    await this.productIndexer.reindexAll();
    return {
      message: 'Product reindexing completed successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
