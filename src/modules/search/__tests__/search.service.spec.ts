import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from '../search.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { SearchAnalyticsService } from '../analytics/search-analytics.service';
import { CacheService } from '../../../common/services/cache.service';
import { SearchProductsDto } from '../dto';

describe('SearchService', () => {
  let service: SearchService;
  let elasticsearchService: jest.Mocked<ElasticsearchService>;
  let analyticsService: jest.Mocked<SearchAnalyticsService>;
  let cacheService: jest.Mocked<CacheService>;

  const mockElasticsearchClient = {
    search: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: ElasticsearchService,
          useValue: {
            getClient: jest.fn(() => mockElasticsearchClient),
            getHealth: jest.fn(),
          },
        },
        {
          provide: SearchAnalyticsService,
          useValue: {
            logSearch: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    elasticsearchService = module.get(ElasticsearchService);
    analyticsService = module.get(SearchAnalyticsService);
    cacheService = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('testConnection', () => {
    it('should successfully test Elasticsearch connection', async () => {
      const mockHealth = {
        cluster_name: 'test-cluster',
        status: 'green',
        number_of_nodes: 3,
      };

      elasticsearchService.getHealth.mockResolvedValue(mockHealth);

      const result = await service.testConnection();

      expect(result).toEqual({
        status: 'connected',
        cluster: 'test-cluster',
        status_code: 'green',
        nodes: 3,
      });
      expect(elasticsearchService.getHealth).toHaveBeenCalledTimes(1);
    });

    it('should throw error when connection fails', async () => {
      const error = new Error('Connection refused');
      elasticsearchService.getHealth.mockRejectedValue(error);

      await expect(service.testConnection()).rejects.toThrow(
        'Connection refused',
      );
    });
  });

  describe('searchProducts', () => {
    const mockSearchResponse = {
      took: 45,
      hits: {
        total: { value: 100 },
        hits: [
          {
            _id: '1',
            _source: {
              id: '1',
              name: 'Shiitake Mushroom',
              price: 12.99,
              category: 'Fresh',
            },
          },
          {
            _id: '2',
            _source: {
              id: '2',
              name: 'Oyster Mushroom',
              price: 9.99,
              category: 'Fresh',
            },
          },
        ],
      },
    };

    it('should return cached results when cache hit', async () => {
      const dto: SearchProductsDto = { query: 'mushroom', page: 1, limit: 20 };
      const cachedResult = {
        hits: [],
        total: 50,
        page: 1,
        limit: 20,
        totalPages: 3,
        took: 10,
      };

      cacheService.get.mockResolvedValue(cachedResult);

      const result = await service.searchProducts(dto);

      expect(result).toEqual(cachedResult);
      expect(cacheService.get).toHaveBeenCalledTimes(1);
      expect(mockElasticsearchClient.search).not.toHaveBeenCalled();
      expect(analyticsService.logSearch).not.toHaveBeenCalled();
    });

    it('should execute search and cache results when cache miss', async () => {
      const dto: SearchProductsDto = { query: 'mushroom', page: 1, limit: 20 };

      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue(mockSearchResponse);
      cacheService.set.mockResolvedValue(undefined);
      analyticsService.logSearch.mockResolvedValue(undefined);

      const result = await service.searchProducts(
        dto,
        'user-123',
        '192.168.1.1',
      );

      expect(result.total).toBe(100);
      expect(result.hits).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(5);
      expect(mockElasticsearchClient.search).toHaveBeenCalledTimes(1);
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('search:products:'),
        expect.objectContaining({ total: 100 }),
        300, // 5 minutes TTL
      );
      expect(analyticsService.logSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'mushroom',
          index: 'products',
          resultsCount: 100,
          userId: 'user-123',
          ipAddress: '192.168.1.1',
        }),
      );
    });

    it('should handle search with price filters', async () => {
      const dto: SearchProductsDto = {
        query: 'mushroom',
        minPrice: 10,
        maxPrice: 50,
        page: 1,
        limit: 20,
      };

      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue(mockSearchResponse);
      cacheService.set.mockResolvedValue(undefined);
      analyticsService.logSearch.mockResolvedValue(undefined);

      await service.searchProducts(dto);

      const searchCall = mockElasticsearchClient.search.mock.calls[0][0];
      expect(searchCall.query.bool.filter).toBeDefined();
      expect(searchCall.query.bool.filter).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            range: expect.objectContaining({
              price: { gte: 10, lte: 50 },
            }),
          }),
        ]),
      );
    });

    it('should handle search with category filters', async () => {
      const dto: SearchProductsDto = {
        query: 'mushroom',
        categories: ['Fresh', 'Dried'],
        page: 1,
        limit: 20,
      };

      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue(mockSearchResponse);
      cacheService.set.mockResolvedValue(undefined);
      analyticsService.logSearch.mockResolvedValue(undefined);

      await service.searchProducts(dto);

      const searchCall = mockElasticsearchClient.search.mock.calls[0][0];
      expect(searchCall.query.bool.filter).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            terms: expect.objectContaining({
              category: ['Fresh', 'Dried'],
            }),
          }),
        ]),
      );
    });

    it('should handle search with rating filter', async () => {
      const dto: SearchProductsDto = {
        query: 'mushroom',
        minRating: 4.0,
        page: 1,
        limit: 20,
      };

      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue(mockSearchResponse);
      cacheService.set.mockResolvedValue(undefined);
      analyticsService.logSearch.mockResolvedValue(undefined);

      await service.searchProducts(dto);

      const searchCall = mockElasticsearchClient.search.mock.calls[0][0];
      expect(searchCall.query.bool.filter).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            range: expect.objectContaining({
              rating: { gte: 4.0 },
            }),
          }),
        ]),
      );
    });

    it('should handle search with stock filter', async () => {
      const dto: SearchProductsDto = {
        query: 'mushroom',
        inStock: true,
        page: 1,
        limit: 20,
      };

      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue(mockSearchResponse);

      await service.searchProducts(dto);

      const searchCall = mockElasticsearchClient.search.mock.calls[0][0];
      expect(searchCall.query.bool.filter).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            range: expect.objectContaining({
              stock: { gt: 0 },
            }),
          }),
        ]),
      );
    });

    it('should handle search with facets', async () => {
      const dto: SearchProductsDto = {
        query: 'mushroom',
        includeFacets: true,
        page: 1,
        limit: 20,
      };

      const mockResponseWithAggs = {
        ...mockSearchResponse,
        aggregations: {
          categories: {
            buckets: [
              { key: 'Fresh', doc_count: 50 },
              { key: 'Dried', doc_count: 30 },
            ],
          },
          price_ranges: {
            buckets: [
              { key: '0-10', doc_count: 20 },
              { key: '10-50', doc_count: 60 },
            ],
          },
          tags: {
            buckets: [
              { key: 'organic', doc_count: 40 },
              { key: 'local', doc_count: 35 },
            ],
          },
          avg_rating: {
            value: 4.5,
          },
        },
      };

      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue(mockResponseWithAggs);

      const result = await service.searchProducts(dto);

      expect(result.facets).toBeDefined();
      expect(result.facets.categories).toHaveLength(2);
      expect(result.facets.priceRanges).toHaveLength(2);
      expect(result.facets.tags).toHaveLength(2);
      expect(result.facets.avgRating).toBe(4.5);
    });

    it('should handle sorting by price ascending', async () => {
      const dto: SearchProductsDto = {
        query: 'mushroom',
        sortBy: 'price',
        sortOrder: 'asc',
        page: 1,
        limit: 20,
      };

      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue(mockSearchResponse);

      await service.searchProducts(dto);

      const searchCall = mockElasticsearchClient.search.mock.calls[0][0];
      expect(searchCall.sort).toEqual([{ price: 'asc' }]);
    });

    it('should handle sorting by rating descending', async () => {
      const dto: SearchProductsDto = {
        query: 'mushroom',
        sortBy: 'rating',
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      };

      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue(mockSearchResponse);

      await service.searchProducts(dto);

      const searchCall = mockElasticsearchClient.search.mock.calls[0][0];
      expect(searchCall.sort).toEqual([{ rating: 'desc' }]);
    });

    it('should continue on cache set error', async () => {
      const dto: SearchProductsDto = { query: 'mushroom', page: 1, limit: 20 };

      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue(mockSearchResponse);
      cacheService.set.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.searchProducts(dto);

      expect(result.total).toBe(100);
      // Should still return results even if cache set fails
    });

    it('should continue on analytics logging error', async () => {
      const dto: SearchProductsDto = { query: 'mushroom', page: 1, limit: 20 };

      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue(mockSearchResponse);
      analyticsService.logSearch.mockRejectedValue(new Error('Database error'));

      const result = await service.searchProducts(dto);

      expect(result.total).toBe(100);
      // Should still return results even if analytics logging fails
    });
  });

  describe('autocomplete', () => {
    const mockAutocompleteResponse = {
      took: 15,
      hits: {
        total: { value: 5 },
        hits: [
          {
            _source: {
              id: '1',
              name: 'Shiitake Mushroom',
              price: 12.99,
              category: 'Fresh',
            },
          },
          {
            _source: {
              id: '2',
              name: 'Shiitake Dried',
              price: 15.99,
              category: 'Dried',
            },
          },
        ],
      },
    };

    it('should return autocomplete suggestions', async () => {
      mockElasticsearchClient.search.mockResolvedValue(
        mockAutocompleteResponse,
      );

      const result = await service.autocomplete('shi', 5);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Shiitake Mushroom');
      expect(result[0].id).toBe('1');
      expect(result[0].price).toBe(12.99);
      expect(mockElasticsearchClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'products',
          size: 5,
          query: expect.objectContaining({
            bool: expect.objectContaining({
              must: expect.arrayContaining([
                expect.objectContaining({
                  match: expect.objectContaining({
                    'name.autocomplete': expect.objectContaining({
                      query: 'shi',
                    }),
                  }),
                }),
              ]),
            }),
          }),
        }),
      );
    });

    it('should handle autocomplete with default limit', async () => {
      mockElasticsearchClient.search.mockResolvedValue(
        mockAutocompleteResponse,
      );

      const result = await service.autocomplete('mushroom');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockElasticsearchClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 10, // Default limit
        }),
      );
    });

    it('should return empty results for no matches', async () => {
      const emptyResponse = {
        took: 10,
        hits: {
          total: { value: 0 },
          hits: [],
        },
      };

      mockElasticsearchClient.search.mockResolvedValue(emptyResponse);

      const result = await service.autocomplete('xyz123');

      expect(result).toEqual([]);
    });
  });

  describe('findSimilarProducts', () => {
    const mockSimilarResponse = {
      took: 35,
      hits: {
        total: { value: 10 },
        hits: [
          {
            _id: '2',
            _source: {
              id: '2',
              name: 'Oyster Mushroom',
              price: 9.99,
            },
          },
          {
            _id: '3',
            _source: {
              id: '3',
              name: 'Button Mushroom',
              price: 8.99,
            },
          },
        ],
      },
    };

    it('should return similar products based on product details', async () => {
      const mockProduct = {
        _id: '1',
        _source: {
          id: '1',
          name: 'Shiitake Mushroom',
          description: 'Fresh organic shiitake',
          category: 'Fresh',
          tags: ['organic', 'local'],
        },
      };

      mockElasticsearchClient.get.mockResolvedValue(mockProduct);
      mockElasticsearchClient.search.mockResolvedValue(mockSimilarResponse);

      const result = await service.findSimilarProducts('1', 5);

      expect(result).toHaveLength(2);
      expect(mockElasticsearchClient.get).toHaveBeenCalledWith({
        index: 'products',
        id: '1',
      });
    });

    it('should throw error when product not found', async () => {
      mockElasticsearchClient.get.mockRejectedValue(
        new Error('Product not found'),
      );

      await expect(service.findSimilarProducts('999', 5)).rejects.toThrow(
        'Product not found',
      );
    });
  });

  describe('cache key generation', () => {
    it('should generate consistent cache keys for same queries', async () => {
      const dto: SearchProductsDto = {
        query: 'mushroom',
        page: 1,
        limit: 20,
        minPrice: 10,
        maxPrice: 50,
        categories: ['Fresh'],
      };

      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue({
        took: 45,
        hits: { total: { value: 0 }, hits: [] },
      });

      await service.searchProducts(dto);
      const firstCacheKey = cacheService.get.mock.calls[0][0];

      jest.clearAllMocks();
      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue({
        took: 45,
        hits: { total: { value: 0 }, hits: [] },
      });

      await service.searchProducts(dto);
      const secondCacheKey = cacheService.get.mock.calls[0][0];

      expect(firstCacheKey).toBe(secondCacheKey);
    });

    it('should generate different cache keys for different queries', async () => {
      const dto1: SearchProductsDto = { query: 'mushroom', page: 1, limit: 20 };
      const dto2: SearchProductsDto = { query: 'shiitake', page: 1, limit: 20 };

      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue({
        took: 45,
        hits: { total: { value: 0 }, hits: [] },
      });

      await service.searchProducts(dto1);
      const firstCacheKey = cacheService.get.mock.calls[0][0];

      jest.clearAllMocks();
      cacheService.get.mockResolvedValue(null);
      mockElasticsearchClient.search.mockResolvedValue({
        took: 45,
        hits: { total: { value: 0 }, hits: [] },
      });

      await service.searchProducts(dto2);
      const secondCacheKey = cacheService.get.mock.calls[0][0];

      expect(firstCacheKey).not.toBe(secondCacheKey);
    });
  });
});
