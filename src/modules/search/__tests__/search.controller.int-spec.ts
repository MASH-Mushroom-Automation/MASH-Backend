import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { SearchModule } from '../search.module';
import { DatabaseModule } from '../../../database/database.module';
import { CommonModule } from '../../../common/common.module';
import { ConfigModule } from '@nestjs/config';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

describe('SearchController (Integration)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        SearchModule,
        DatabaseModule,
        CommonModule,
        ElasticsearchModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/search/test-connection', () => {
    it('should test Elasticsearch connection successfully', async () => {
      const response = await request(server)
        .get('/api/v1/search/test-connection')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          status: 'connected',
          cluster: expect.any(String),
          status_code: expect.any(String),
          nodes: expect.any(Number),
        }),
      );
    });
  });

  describe('POST /api/v1/search/products', () => {
    it('should search products with basic query', async () => {
      const response = await request(server)
        .post('/api/v1/search/products')
        .send({
          query: 'mushroom',
          page: 1,
          limit: 10,
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          hits: expect.any(Array),
          total: expect.any(Number),
          page: 1,
          limit: 10,
          totalPages: expect.any(Number),
          took: expect.any(Number),
        }),
      );
    });

    it('should search products with price filters', async () => {
      const response = await request(server)
        .post('/api/v1/search/products')
        .send({
          query: 'mushroom',
          minPrice: 10,
          maxPrice: 50,
          page: 1,
          limit: 10,
        })
        .expect(201);

      expect(response.body.hits).toBeDefined();
      
      // Verify all results are within price range
      response.body.hits.forEach((hit: any) => {
        if (hit.price) {
          expect(hit.price).toBeGreaterThanOrEqual(10);
          expect(hit.price).toBeLessThanOrEqual(50);
        }
      });
    });

    it('should search products with category filter', async () => {
      const response = await request(server)
        .post('/api/v1/search/products')
        .send({
          query: 'mushroom',
          categories: ['Fresh'],
          page: 1,
          limit: 10,
        })
        .expect(201);

      expect(response.body.hits).toBeDefined();
      
      // Verify all results match category
      response.body.hits.forEach((hit: any) => {
        if (hit.category) {
          expect(['Fresh']).toContain(hit.category);
        }
      });
    });

    it('should search products with rating filter', async () => {
      const response = await request(server)
        .post('/api/v1/search/products')
        .send({
          query: 'mushroom',
          minRating: 4.0,
          page: 1,
          limit: 10,
        })
        .expect(201);

      expect(response.body.hits).toBeDefined();
      
      // Verify all results meet minimum rating
      response.body.hits.forEach((hit: any) => {
        if (hit.rating) {
          expect(hit.rating).toBeGreaterThanOrEqual(4.0);
        }
      });
    });

    it('should search products with stock filter', async () => {
      const response = await request(server)
        .post('/api/v1/search/products')
        .send({
          query: 'mushroom',
          inStock: true,
          page: 1,
          limit: 10,
        })
        .expect(201);

      expect(response.body.hits).toBeDefined();
      
      // Verify all results are in stock
      response.body.hits.forEach((hit: any) => {
        if (hit.stock !== undefined) {
          expect(hit.stock).toBeGreaterThan(0);
        }
      });
    });

    it('should search products with facets', async () => {
      const response = await request(server)
        .post('/api/v1/search/products')
        .send({
          query: 'mushroom',
          includeFacets: true,
          page: 1,
          limit: 10,
        })
        .expect(201);

      expect(response.body.facets).toBeDefined();
      expect(response.body.facets.categories).toBeDefined();
      expect(response.body.facets.priceRanges).toBeDefined();
      expect(response.body.facets.tags).toBeDefined();
      expect(response.body.facets.avgRating).toBeDefined();
      
      expect(Array.isArray(response.body.facets.categories)).toBe(true);
      expect(Array.isArray(response.body.facets.priceRanges)).toBe(true);
      expect(Array.isArray(response.body.facets.tags)).toBe(true);
      expect(typeof response.body.facets.avgRating).toBe('number');
    });

    it('should sort products by price ascending', async () => {
      const response = await request(server)
        .post('/api/v1/search/products')
        .send({
          query: 'mushroom',
          sortBy: 'price',
          sortOrder: 'asc',
          page: 1,
          limit: 10,
        })
        .expect(201);

      const prices = response.body.hits
        .filter((hit: any) => hit.price !== undefined)
        .map((hit: any) => hit.price);

      // Verify prices are in ascending order
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    it('should sort products by rating descending', async () => {
      const response = await request(server)
        .post('/api/v1/search/products')
        .send({
          query: 'mushroom',
          sortBy: 'rating',
          sortOrder: 'desc',
          page: 1,
          limit: 10,
        })
        .expect(201);

      const ratings = response.body.hits
        .filter((hit: any) => hit.rating !== undefined)
        .map((hit: any) => hit.rating);

      // Verify ratings are in descending order
      for (let i = 1; i < ratings.length; i++) {
        expect(ratings[i]).toBeLessThanOrEqual(ratings[i - 1]);
      }
    });

    it('should handle pagination correctly', async () => {
      const page1Response = await request(server)
        .post('/api/v1/search/products')
        .send({
          query: 'mushroom',
          page: 1,
          limit: 5,
        })
        .expect(201);

      const page2Response = await request(server)
        .post('/api/v1/search/products')
        .send({
          query: 'mushroom',
          page: 2,
          limit: 5,
        })
        .expect(201);

      expect(page1Response.body.page).toBe(1);
      expect(page2Response.body.page).toBe(2);
      
      // Ensure different results on different pages
      if (page1Response.body.total > 5) {
        const page1Ids = page1Response.body.hits.map((h: any) => h.id);
        const page2Ids = page2Response.body.hits.map((h: any) => h.id);
        
        // No overlap between pages
        const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
        expect(overlap.length).toBe(0);
      }
    });

    it('should validate required fields', async () => {
      const response = await request(server)
        .post('/api/v1/search/products')
        .send({
          // Missing query
          page: -1, // Invalid page
          limit: 1000, // Invalid limit
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should handle empty search results', async () => {
      const response = await request(server)
        .post('/api/v1/search/products')
        .send({
          query: 'nonexistentproduct12345xyz',
          page: 1,
          limit: 10,
        })
        .expect(201);

      expect(response.body.total).toBe(0);
      expect(response.body.hits).toEqual([]);
      expect(response.body.totalPages).toBe(0);
    });

    it('should test cache behavior on repeated queries', async () => {
      const queryParams = {
        query: 'shiitake',
        page: 1,
        limit: 10,
      };

      // First request (cache miss)
      const response1 = await request(server)
        .post('/api/v1/search/products')
        .send(queryParams)
        .expect(201);

      const firstResponseTime = response1.body.took;

      // Second request (should hit cache)
      const response2 = await request(server)
        .post('/api/v1/search/products')
        .send(queryParams)
        .expect(201);

      const secondResponseTime = response2.body.took;

      // Cached response should be faster
      expect(secondResponseTime).toBeLessThanOrEqual(firstResponseTime);
      
      // Results should be identical
      expect(response2.body.total).toBe(response1.body.total);
    });
  });

  describe('POST /api/v1/search/autocomplete', () => {
    it('should return autocomplete suggestions', async () => {
      const response = await request(server)
        .post('/api/v1/search/autocomplete')
        .send({
          query: 'shi',
          limit: 5,
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          suggestions: expect.any(Array),
          took: expect.any(Number),
        }),
      );
      
      expect(response.body.suggestions.length).toBeLessThanOrEqual(5);
      expect(response.body.took).toBeLessThan(100); // Target: <100ms
    });

    it('should handle empty autocomplete query', async () => {
      const response = await request(server)
        .post('/api/v1/search/autocomplete')
        .send({
          query: '',
          limit: 5,
        })
        .expect(201);

      expect(response.body.suggestions).toEqual([]);
    });

    it('should validate autocomplete limit', async () => {
      await request(server)
        .post('/api/v1/search/autocomplete')
        .send({
          query: 'test',
          limit: 200, // Exceeds max limit
        })
        .expect(400);
    });

    it('should return unique suggestions', async () => {
      const response = await request(server)
        .post('/api/v1/search/autocomplete')
        .send({
          query: 'mu',
          limit: 10,
        })
        .expect(201);

      const suggestions = response.body.suggestions;
      const uniqueSuggestions = [...new Set(suggestions)];
      
      expect(suggestions.length).toBe(uniqueSuggestions.length);
    });
  });

  describe('GET /api/v1/search/similar/:productId', () => {
    it('should return similar products', async () => {
      // First, search for a product to get a valid ID
      const searchResponse = await request(server)
        .post('/api/v1/search/products')
        .send({
          query: 'mushroom',
          page: 1,
          limit: 1,
        })
        .expect(201);

      if (searchResponse.body.hits.length > 0) {
        const productId = searchResponse.body.hits[0].id;

        const response = await request(server)
          .get(`/api/v1/search/similar/${productId}`)
          .query({ limit: 5 })
          .expect(200);

        expect(response.body).toEqual(
          expect.objectContaining({
            similar: expect.any(Array),
            total: expect.any(Number),
            took: expect.any(Number),
          }),
        );

        expect(response.body.similar.length).toBeLessThanOrEqual(5);
        
        // Ensure the original product is not in similar products
        const similarIds = response.body.similar.map((p: any) => p.id);
        expect(similarIds).not.toContain(productId);
      }
    });

    it('should handle non-existent product ID', async () => {
      await request(server)
        .get('/api/v1/search/similar/nonexistent-id-12345')
        .query({ limit: 5 })
        .expect(404);
    });

    it('should validate limit parameter', async () => {
      await request(server)
        .get('/api/v1/search/similar/some-id')
        .query({ limit: 200 })
        .expect(400);
    });
  });

  describe('Analytics Endpoints', () => {
    describe('GET /api/v1/search/analytics', () => {
      it('should return analytics overview', async () => {
        const response = await request(server)
          .get('/api/v1/search/analytics')
          .expect(200);

        expect(response.body).toEqual(
          expect.objectContaining({
            popularQueries: expect.any(Array),
            zeroResultQueries: expect.any(Array),
            slowQueries: expect.any(Array),
            performanceMetrics: expect.objectContaining({
              totalSearches: expect.any(Number),
              avgResponseTime: expect.any(Number),
              slowQueryPercentage: expect.any(Number),
            }),
          }),
        );
      });
    });

    describe('GET /api/v1/search/analytics/popular', () => {
      it('should return popular queries', async () => {
        const response = await request(server)
          .get('/api/v1/search/analytics/popular')
          .query({ limit: 10 })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(10);
        
        if (response.body.length > 0) {
          expect(response.body[0]).toEqual(
            expect.objectContaining({
              query: expect.any(String),
              count: expect.any(Number),
              avgResults: expect.any(Number),
              avgResponseTime: expect.any(Number),
            }),
          );
        }
      });

      it('should validate limit parameter', async () => {
        await request(server)
          .get('/api/v1/search/analytics/popular')
          .query({ limit: 200 })
          .expect(400);
      });
    });

    describe('GET /api/v1/search/analytics/zero-results', () => {
      it('should return zero-result queries', async () => {
        const response = await request(server)
          .get('/api/v1/search/analytics/zero-results')
          .query({ limit: 20 })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(20);
        
        if (response.body.length > 0) {
          expect(response.body[0]).toEqual(
            expect.objectContaining({
              query: expect.any(String),
              resultsCount: 0,
              took: expect.any(Number),
            }),
          );
        }
      });
    });

    describe('GET /api/v1/search/analytics/slow-queries', () => {
      it('should return slow queries', async () => {
        const response = await request(server)
          .get('/api/v1/search/analytics/slow-queries')
          .query({ limit: 20 })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(20);
        
        if (response.body.length > 0) {
          expect(response.body[0]).toEqual(
            expect.objectContaining({
              query: expect.any(String),
              took: expect.any(Number),
            }),
          );
          
          // Verify all slow queries exceed 500ms threshold
          expect(response.body[0].took).toBeGreaterThan(500);
        }
      });
    });

    describe('GET /api/v1/search/analytics/performance', () => {
      it('should return performance metrics', async () => {
        const response = await request(server)
          .get('/api/v1/search/analytics/performance')
          .expect(200);

        expect(response.body).toEqual(
          expect.objectContaining({
            totalSearches: expect.any(Number),
            avgResponseTime: expect.any(Number),
            minResponseTime: expect.any(Number),
            maxResponseTime: expect.any(Number),
            slowQueryCount: expect.any(Number),
            slowQueryPercentage: expect.any(Number),
            zeroResultCount: expect.any(Number),
            zeroResultPercentage: expect.any(Number),
            p50: expect.any(Number),
            p95: expect.any(Number),
            p99: expect.any(Number),
          }),
        );
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent searches efficiently', async () => {
      const concurrentRequests = 10;
      const promises = Array(concurrentRequests)
        .fill(null)
        .map((_, index) =>
          request(server)
            .post('/api/v1/search/products')
            .send({
              query: `test${index}`,
              page: 1,
              limit: 10,
            }),
        );

      const results = await Promise.all(promises);
      
      results.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('hits');
      });
    });

    it('should maintain performance under load', async () => {
      const iterations = 20;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await request(server)
          .post('/api/v1/search/products')
          .send({
            query: 'mushroom',
            page: 1,
            limit: 10,
          })
          .expect(201);
        
        responseTimes.push(Date.now() - start);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      
      // Average response time should be reasonable
      expect(avgResponseTime).toBeLessThan(500); // 500ms threshold
    });
  });
});
