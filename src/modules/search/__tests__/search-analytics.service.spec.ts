import { Test, TestingModule } from '@nestjs/testing';
import { SearchAnalyticsService } from '../analytics/search-analytics.service';
import { PrismaService } from '../../../database/prisma.service';

describe('SearchAnalyticsService', () => {
  let service: SearchAnalyticsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    searchLog: {
      create: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchAnalyticsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SearchAnalyticsService>(SearchAnalyticsService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logSearch', () => {
    it('should log a search query successfully', async () => {
      const searchParams = {
        query: 'shiitake mushroom',
        index: 'products',
        resultsCount: 42,
        took: 156,
        filters: { minPrice: 10, categories: ['Fresh'] },
        sort: { sortBy: 'price', sortOrder: 'asc' },
        userId: 'user-123',
        ipAddress: '192.168.1.1',
      };

      mockPrismaService.searchLog.create.mockResolvedValue({
        id: 'log-1',
        ...searchParams,
        isSlowQuery: false,
        createdAt: new Date(),
      } as any);

      await service.logSearch(searchParams);

      expect(mockPrismaService.searchLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          query: 'shiitake mushroom',
          index: 'products',
          resultsCount: 42,
          took: 156,
          isSlowQuery: false, // < 500ms
          userId: 'user-123',
          ipAddress: '192.168.1.1',
        }),
      });
    });

    it('should flag slow queries (>500ms)', async () => {
      const searchParams = {
        query: 'complex query',
        index: 'products',
        resultsCount: 1000,
        took: 750, // Slow query
        userId: 'user-123',
      };

      mockPrismaService.searchLog.create.mockResolvedValue({
        id: 'log-2',
        ...searchParams,
        isSlowQuery: true,
        createdAt: new Date(),
      } as any);

      await service.logSearch(searchParams);

      expect(mockPrismaService.searchLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          took: 750,
          isSlowQuery: true, // Should be flagged
        }),
      });
    });

    it('should handle logging errors gracefully', async () => {
      const searchParams = {
        query: 'test',
        index: 'products',
        resultsCount: 10,
        took: 50,
      };

      mockPrismaService.searchLog.create.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Should not throw - logging should be non-blocking
      await expect(service.logSearch(searchParams)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should log search with all optional parameters', async () => {
      const searchParams = {
        query: 'mushroom',
        index: 'products',
        resultsCount: 25,
        took: 100,
        filters: { minPrice: 5, maxPrice: 20, categories: ['Fresh', 'Dried'] },
        sort: { sortBy: 'rating', sortOrder: 'desc' },
        userId: 'user-456',
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
        clickedResult: 'product-789',
      };

      mockPrismaService.searchLog.create.mockResolvedValue({
        id: 'log-3',
        ...searchParams,
        isSlowQuery: false,
        createdAt: new Date(),
      } as any);

      await service.logSearch(searchParams);

      expect(mockPrismaService.searchLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          query: 'mushroom',
          filters: searchParams.filters,
          sort: searchParams.sort,
          userAgent: 'Mozilla/5.0',
          clickedResult: 'product-789',
        }),
      });
    });
  });

  describe('getPopularQueries', () => {
    it('should return popular queries with stats', async () => {
      const mockPopularQueries = [
        {
          query: 'shiitake',
          _count: { query: 150 },
          _avg: { resultsCount: 45, took: 120 },
        },
        {
          query: 'oyster',
          _count: { query: 120 },
          _avg: { resultsCount: 38, took: 95 },
        },
        {
          query: 'button',
          _count: { query: 100 },
          _avg: { resultsCount: 52, took: 110 },
        },
      ];

      mockPrismaService.searchLog.groupBy.mockResolvedValue(
        mockPopularQueries as any,
      );

      const result = await service.getPopularQueries(10);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        query: 'shiitake',
        count: 150,
        avgResults: 45,
        avgResponseTime: 120,
      });
      expect(mockPrismaService.searchLog.groupBy).toHaveBeenCalledWith({
        by: ['query'],
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date), // Last 7 days
          }),
        }),
        _count: { query: true },
        _avg: { resultsCount: true, took: true },
        orderBy: { _count: { query: 'desc' } },
        take: 10,
      });
    });

    it('should handle custom limit parameter', async () => {
      mockPrismaService.searchLog.groupBy.mockResolvedValue([]);

      await service.getPopularQueries(5);

      expect(mockPrismaService.searchLog.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });

    it('should return empty array when no popular queries found', async () => {
      mockPrismaService.searchLog.groupBy.mockResolvedValue([]);

      const result = await service.getPopularQueries(10);

      expect(result).toEqual([]);
    });
  });

  describe('getZeroResultQueries', () => {
    it('should return queries with zero results', async () => {
      const mockZeroResultQueries = [
        {
          query: 'unicorn mushroom',
          _count: { query: 15 },
        },
        {
          query: 'magical truffle',
          _count: { query: 10 },
        },
      ];

      mockPrismaService.searchLog.groupBy.mockResolvedValue(
        mockZeroResultQueries as any,
      );

      const result = await service.getZeroResultQueries(20);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe('unicorn mushroom');
      expect(result[0].count).toBe(15);
      expect(result[1].query).toBe('magical truffle');
      expect(result[1].count).toBe(10);
      expect(mockPrismaService.searchLog.groupBy).toHaveBeenCalledWith({
        by: ['query'],
        _count: {
          query: true,
        },
        where: {
          resultsCount: 0,
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
        },
        orderBy: {
          _count: {
            query: 'desc',
          },
        },
        take: 20,
      });
    });

    it('should return empty array when no zero-result queries found', async () => {
      mockPrismaService.searchLog.groupBy.mockResolvedValue([]);

      const result = await service.getZeroResultQueries(20);

      expect(result).toEqual([]);
    });
  });

  describe('getSlowQueries', () => {
    it('should return slow queries (>500ms)', async () => {
      const mockSlowQueries = [
        {
          id: '1',
          query: 'complex search',
          took: 850,
          resultsCount: 500,
          filters: { minPrice: 0, maxPrice: 100 },
          createdAt: new Date(),
        },
        {
          id: '2',
          query: 'another slow one',
          took: 650,
          resultsCount: 300,
          filters: null,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.searchLog.findMany.mockResolvedValue(
        mockSlowQueries as any,
      );

      const result = await service.getSlowQueries(20);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe('complex search');
      expect(result[0].took).toBe(850);
      expect(mockPrismaService.searchLog.findMany).toHaveBeenCalledWith({
        where: {
          isSlowQuery: true,
          createdAt: expect.objectContaining({
            gte: expect.any(Date), // Last 24 hours
          }),
        },
        orderBy: { took: 'desc' },
        take: 20,
        select: expect.objectContaining({
          query: true,
          took: true,
          resultsCount: true,
          filters: true,
          createdAt: true,
        }),
      });
    });

    it('should filter by last 24 hours only', async () => {
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      mockPrismaService.searchLog.findMany.mockResolvedValue([]);

      await service.getSlowQueries(20);

      const call = mockPrismaService.searchLog.findMany.mock.calls[0][0];
      const createdAtFilter = call.where.createdAt.gte;
      const timeDiff = Math.abs(
        createdAtFilter.getTime() - oneDayAgo.getTime(),
      );

      // Should be within 1 second of 24 hours ago
      expect(timeDiff).toBeLessThan(1000);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return comprehensive performance metrics', async () => {
      // Mock searches for percentile calculation
      const times = Array.from({ length: 100 }, (_, i) => ({
        took: i * 10,
      }));
      mockPrismaService.searchLog.findMany.mockResolvedValue(times as any);

      const result = await service.getPerformanceMetrics();

      expect(result).toEqual(
        expect.objectContaining({
          p50: expect.any(Number),
          p95: expect.any(Number),
          p99: expect.any(Number),
          avg: expect.any(Number),
          max: expect.any(Number),
          min: expect.any(Number),
        }),
      );

      expect(result.p50).toBeGreaterThanOrEqual(0);
      expect(result.p95).toBeGreaterThanOrEqual(result.p50);
      expect(result.p99).toBeGreaterThanOrEqual(result.p95);
    });

    it('should handle zero searches gracefully', async () => {
      mockPrismaService.searchLog.findMany.mockResolvedValue([]);

      const result = await service.getPerformanceMetrics();

      expect(result.avg).toBe(0);
      expect(result.p50).toBe(0);
      expect(result.p95).toBe(0);
      expect(result.p99).toBe(0);
      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
    });

    it('should calculate percentiles correctly', async () => {
      // Simulate 100 searches with known response times
      const times = [
        ...Array(50).fill({ took: 50 }), // 50% at 50ms
        ...Array(40).fill({ took: 100 }), // 40% at 100ms
        ...Array(5).fill({ took: 200 }), // 5% at 200ms
        ...Array(4).fill({ took: 400 }), // 4% at 400ms
        { took: 500 }, // 1% at 500ms
      ];
      mockPrismaService.searchLog.findMany.mockResolvedValue(times as any);

      const result = await service.getPerformanceMetrics();

      expect(result.p50).toBe(50); // Median should be ~50ms
      expect(result.p95).toBe(200); // 95th percentile
      expect(result.p99).toBe(400); // 99th percentile
    });
  });
});
