import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleLogger } from '@nestjs/common';
import { CacheWarmerService } from './cache-warmer.service';
import { AnalyticsService } from '../analytics.service';
import { ConfigService } from '@nestjs/config';

describe('CacheWarmerService', () => {
  let service: CacheWarmerService;
  let analyticsService: jest.Mocked<AnalyticsService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockAnalyticsService = {
      getDashboardStats: jest.fn().mockResolvedValue({}),
      getSalesAnalytics: jest.fn().mockResolvedValue({}),
      getProductMetrics: jest.fn().mockResolvedValue({}),
      getUserEngagement: jest.fn().mockResolvedValue({}),
      getDeviceStatistics: jest.fn().mockResolvedValue({}),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'ANALYTICS_CACHE_WARMER_ENABLED') {
          return defaultValue || 'true';
        }
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheWarmerService,
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    })

      .setLogger(new ConsoleLogger()) // Use ConsoleLogger for NestJS v11 compatibility

      .compile();

    service = module.get<CacheWarmerService>(CacheWarmerService);
    analyticsService = module.get(AnalyticsService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('warmPopularQueries', () => {
    it('should warm cache with popular date ranges', async () => {
      await service.warmPopularQueries();

      // Should call getDashboardStats for 6 date ranges
      expect(analyticsService.getDashboardStats).toHaveBeenCalledTimes(6);

      // Should call getSalesAnalytics for 6 date ranges
      expect(analyticsService.getSalesAnalytics).toHaveBeenCalledTimes(6);

      // Should call additional queries
      expect(analyticsService.getProductMetrics).toHaveBeenCalledTimes(1);
      expect(analyticsService.getUserEngagement).toHaveBeenCalledTimes(1);
      expect(analyticsService.getDeviceStatistics).toHaveBeenCalledTimes(1);
    });

    it('should not warm cache when disabled', async () => {
      configService.get.mockReturnValue('false');
      const newService = new CacheWarmerService(
        analyticsService,
        configService,
      );

      await newService.warmPopularQueries();

      expect(analyticsService.getDashboardStats).not.toHaveBeenCalled();
      expect(analyticsService.getSalesAnalytics).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      analyticsService.getDashboardStats.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.warmPopularQueries()).resolves.not.toThrow();
    });

    it('should continue warming other queries if one fails', async () => {
      analyticsService.getDashboardStats.mockRejectedValueOnce(
        new Error('Failed'),
      );

      await service.warmPopularQueries();

      // Should still call getSalesAnalytics despite getDashboardStats failure
      expect(analyticsService.getSalesAnalytics).toHaveBeenCalled();
    });
  });

  describe('getCacheHitRate', () => {
    it('should return initial cache hit rate of 0', () => {
      const result = service.getCacheHitRate();

      expect(result).toEqual({
        hits: 0,
        total: 0,
        rate: 0,
      });
    });

    it('should calculate cache hit rate correctly', () => {
      service.recordCacheHit(true);
      service.recordCacheHit(true);
      service.recordCacheHit(false);
      service.recordCacheHit(true);

      const result = service.getCacheHitRate();

      expect(result).toEqual({
        hits: 3,
        total: 4,
        rate: 75,
      });
    });

    it('should handle 100% cache hit rate', () => {
      service.recordCacheHit(true);
      service.recordCacheHit(true);
      service.recordCacheHit(true);

      const result = service.getCacheHitRate();

      expect(result).toEqual({
        hits: 3,
        total: 3,
        rate: 100,
      });
    });

    it('should handle 0% cache hit rate', () => {
      service.recordCacheHit(false);
      service.recordCacheHit(false);

      const result = service.getCacheHitRate();

      expect(result).toEqual({
        hits: 0,
        total: 2,
        rate: 0,
      });
    });
  });

  describe('resetStats', () => {
    it('should reset cache statistics', () => {
      service.recordCacheHit(true);
      service.recordCacheHit(false);

      service.resetStats();

      const result = service.getCacheHitRate();
      expect(result).toEqual({
        hits: 0,
        total: 0,
        rate: 0,
      });
    });
  });

  describe('recordCacheHit', () => {
    it('should increment total requests for cache hits', () => {
      service.recordCacheHit(true);

      const result = service.getCacheHitRate();
      expect(result.total).toBe(1);
      expect(result.hits).toBe(1);
    });

    it('should increment total requests for cache misses', () => {
      service.recordCacheHit(false);

      const result = service.getCacheHitRate();
      expect(result.total).toBe(1);
      expect(result.hits).toBe(0);
    });

    it('should track multiple cache operations', () => {
      service.recordCacheHit(true);
      service.recordCacheHit(true);
      service.recordCacheHit(false);

      const result = service.getCacheHitRate();
      expect(result.total).toBe(3);
      expect(result.hits).toBe(2);
    });
  });
});
