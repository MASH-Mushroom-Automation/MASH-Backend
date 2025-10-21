import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from './elasticsearch/elasticsearch.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly elasticsearch: ElasticsearchService) {}

  /**
   * Test Elasticsearch connection
   */
  async testConnection(): Promise<any> {
    try {
      const health = await this.elasticsearch.getHealth();
      this.logger.log('✅ Elasticsearch connection test successful');
      return {
        status: 'connected',
        cluster: health.cluster_name,
        status_code: health.status,
        nodes: health.number_of_nodes,
      };
    } catch (error) {
      this.logger.error('❌ Elasticsearch connection test failed:', error.message);
      throw error;
    }
  }

  /**
   * Basic product search (placeholder for now)
   */
  async searchProducts(query: string, page = 1, limit = 20): Promise<any> {
    this.logger.log(`🔍 Searching products: "${query}"`);
    
    // TODO: Implement actual search once we have product mappings and indexing
    return {
      message: 'Search engine initialized! Product indexing coming in Day 2',
      query,
      page,
      limit,
      elasticsearch_status: 'connected',
      next_steps: [
        'Create product mappings (Day 2)',
        'Implement product indexing (Day 2)',
        'Add full-text search (Day 2)',
      ],
    };
  }
}
