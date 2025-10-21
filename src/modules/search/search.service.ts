import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from './elasticsearch/elasticsearch.service';
import { SearchProductsDto } from './dto';

export interface SearchResult {
  hits: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  took: number; // Elasticsearch query time in ms
  facets?: {
    categories: Array<{ name: string; count: number }>;
    priceRanges: Array<{ range: string; count: number }>;
    tags: Array<{ name: string; count: number }>;
    avgRating: number;
  };
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly PRODUCTS_INDEX = 'products';

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
   * Advanced product search with filtering, sorting, and facets
   */
  async searchProducts(dto: SearchProductsDto): Promise<SearchResult> {
    const startTime = Date.now();
    const { query, page = 1, limit = 20, includeFacets } = dto;
    const from = (page - 1) * limit;

    this.logger.log(`🔍 Searching products: "${query || 'all'}" (page ${page}, limit ${limit})`);

    // Build the Elasticsearch query
    const queryBody = this.buildQuery(dto);
    const sortConfig = this.buildSort(dto);
    const searchParams: any = {
      index: this.PRODUCTS_INDEX,
      from,
      size: limit,
      query: queryBody,
      sort: sortConfig,
    };

    // Add aggregations for facets if requested
    if (includeFacets) {
      searchParams.aggs = this.buildAggregations();
    }

    try {
      const result = await this.elasticsearch.getClient().search(searchParams);

      const took = Date.now() - startTime;
      const total = typeof result.hits.total === 'number' 
        ? result.hits.total 
        : result.hits.total.value;

      this.logger.log(`✅ Search completed in ${took}ms (ES: ${result.took}ms) - ${total} results`);

      const response: SearchResult = {
        hits: result.hits.hits.map((hit: any) => ({
          id: hit._id,
          score: hit._score,
          ...hit._source,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        took: result.took,
      };

      // Add facets if requested
      if (includeFacets && result.aggregations) {
        response.facets = this.parseFacets(result.aggregations);
      }

      return response;
    } catch (error) {
      this.logger.error(`❌ Search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Autocomplete suggestions - fast prefix matching
   */
  async autocomplete(query: string, limit = 10): Promise<any[]> {
    const startTime = Date.now();
    this.logger.log(`🔤 Autocomplete: "${query}" (limit ${limit})`);

    try {
      const result = await this.elasticsearch.getClient().search({
        index: this.PRODUCTS_INDEX,
        size: limit,
        query: {
          bool: {
            must: [
              {
                match: {
                  'name.autocomplete': {
                    query,
                    operator: 'and',
                  },
                },
              },
            ],
            filter: [
              { term: { status: 'active' } },
            ],
          },
        },
        _source: ['name', 'id', 'price', 'category'],
      });

      const took = Date.now() - startTime;
      this.logger.log(`✅ Autocomplete completed in ${took}ms - ${result.hits.hits.length} suggestions`);

      return result.hits.hits.map((hit: any) => ({
        id: hit._source.id,
        name: hit._source.name,
        price: hit._source.price,
        category: hit._source.category,
      }));
    } catch (error) {
      this.logger.error(`❌ Autocomplete failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find similar products using More Like This
   */
  async findSimilarProducts(productId: string, limit = 5): Promise<any[]> {
    this.logger.log(`🔗 Finding similar products to: ${productId}`);

    try {
      const result = await this.elasticsearch.getClient().search({
        index: this.PRODUCTS_INDEX,
        size: limit,
        query: {
          bool: {
            must: [
              {
                more_like_this: {
                  fields: ['name', 'description', 'category', 'tags'],
                  like: [
                    {
                      _index: this.PRODUCTS_INDEX,
                      _id: productId,
                    },
                  ],
                  min_term_freq: 1,
                  max_query_terms: 12,
                  min_doc_freq: 1,
                },
              },
            ],
            filter: [
              { term: { status: 'active' } },
            ],
          },
        },
      });

      this.logger.log(`✅ Found ${result.hits.hits.length} similar products`);

      return result.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      }));
    } catch (error) {
      this.logger.error(`❌ Similar products search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build Elasticsearch query from DTO
   */
  private buildQuery(dto: SearchProductsDto): any {
    const { query, minPrice, maxPrice, categories, minRating, inStock, tags } = dto;

    const mustClauses: any[] = [];
    const filterClauses: any[] = [
      { term: { status: 'active' } }, // Only show active products
    ];

    // Text search with multi-match
    if (query && query.trim()) {
      mustClauses.push({
        multi_match: {
          query,
          fields: [
            'name^3',        // Name is most important (boost 3x)
            'description^2', // Description is second (boost 2x)
            'category',
            'tags',
          ],
          fuzziness: 'AUTO', // Handle typos
          operator: 'and',
        },
      });
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceRange: any = {};
      if (minPrice !== undefined) priceRange.gte = minPrice;
      if (maxPrice !== undefined) priceRange.lte = maxPrice;
      filterClauses.push({ range: { price: priceRange } });
    }

    // Category filter
    if (categories && categories.length > 0) {
      filterClauses.push({ terms: { category: categories } });
    }

    // Rating filter
    if (minRating !== undefined) {
      filterClauses.push({ range: { rating: { gte: minRating } } });
    }

    // Stock filter
    if (inStock === true) {
      filterClauses.push({ range: { stock: { gt: 0 } } });
    }

    // Tags filter
    if (tags && tags.length > 0) {
      filterClauses.push({ terms: { tags: tags } });
    }

    // If no query provided, match all
    if (mustClauses.length === 0) {
      return {
        bool: {
          must: [{ match_all: {} }],
          filter: filterClauses,
        },
      };
    }

    return {
      bool: {
        must: mustClauses,
        filter: filterClauses,
      },
    };
  }

  /**
   * Build sort configuration
   */
  private buildSort(dto: SearchProductsDto): any[] {
    const { sortBy, sortOrder } = dto;

    if (sortBy === 'relevance') {
      return [{ _score: { order: 'desc' } }];
    }

    const sortConfig: any = {};
    sortConfig[sortBy] = { order: sortOrder };

    return [sortConfig, { _score: { order: 'desc' } }]; // Relevance as tiebreaker
  }

  /**
   * Build aggregations for faceted search
   */
  private buildAggregations(): any {
    return {
      categories: {
        terms: {
          field: 'category',
          size: 20,
        },
      },
      price_ranges: {
        range: {
          field: 'price',
          ranges: [
            { key: 'Under $10', to: 10 },
            { key: '$10 - $50', from: 10, to: 50 },
            { key: '$50 - $100', from: 50, to: 100 },
            { key: 'Over $100', from: 100 },
          ],
        },
      },
      tags: {
        terms: {
          field: 'tags',
          size: 20,
        },
      },
      avg_rating: {
        avg: {
          field: 'rating',
        },
      },
    };
  }

  /**
   * Parse aggregations into facets
   */
  private parseFacets(aggregations: any): any {
    return {
      categories: aggregations.categories.buckets.map((bucket: any) => ({
        name: bucket.key,
        count: bucket.doc_count,
      })),
      priceRanges: aggregations.price_ranges.buckets.map((bucket: any) => ({
        range: bucket.key,
        count: bucket.doc_count,
      })),
      tags: aggregations.tags.buckets.map((bucket: any) => ({
        name: bucket.key,
        count: bucket.doc_count,
      })),
      avgRating: aggregations.avg_rating.value || 0,
    };
  }
}
