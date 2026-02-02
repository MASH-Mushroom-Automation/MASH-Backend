import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleLogger } from '@nestjs/common';
import { RealtimeAnalyticsService } from './realtime-analytics.service';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../common/services/cache.service';

describe('RealtimeAnalyticsService', () => {
  let service: RealtimeAnalyticsService;
  let prisma: PrismaService;
  let cacheService: CacheService;

  const mockPrismaService = {
    order: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    session: {
      count: jest.fn(),
    },
    device: {
      count: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeAnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    })

      .setLogger(new ConsoleLogger()) // Use ConsoleLogger for NestJS v11 compatibility

      .compile();

    service = module.get<RealtimeAnalyticsService>(RealtimeAnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLiveMetrics', () => {
    it('should fetch live metrics from database when not cached', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.order.count.mockResolvedValue(10);
      mockPrismaService.order.aggregate.mockResolvedValue({
        _sum: { total: 1500 },
      });
      mockPrismaService.session.count.mockResolvedValue(5);
      mockPrismaService.device.count.mockResolvedValue(3);

      // Act
      const result = await service.getLiveMetrics() as {
        todayOrders: number;
        todayRevenue: number;
        activeUsers: number;
        onlineDevices: number;
        timestamp: string;
      };

      // Assert
      expect(result).toHaveProperty('todayOrders', 10);
      expect(result).toHaveProperty('todayRevenue', 1500);
      expect(result).toHaveProperty('activeUsers', 5);
      expect(result).toHaveProperty('onlineDevices', 3);
      expect(result).toHaveProperty('timestamp');
      expect(mockCacheService.set).toHaveBeenCalledWith('realtime:metrics', result, 5);
    });

    it('should return cached metrics when available', async () => {
      // Arrange
      const cachedData = {
        todayOrders: 15,
        todayRevenue: 2000,
        activeUsers: 8,
        onlineDevices: 4,
        timestamp: new Date().toISOString(),
      };
      mockCacheService.get.mockResolvedValue(cachedData);

      // Act
      const result = await service.getLiveMetrics();

      // Assert
      expect(result).toEqual(cachedData);
      expect(mockPrismaService.order.count).not.toHaveBeenCalled();
    });

    it('should handle null revenue gracefully', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.order.count.mockResolvedValue(0);
      mockPrismaService.order.aggregate.mockResolvedValue({
        _sum: { total: null },
      });
      mockPrismaService.session.count.mockResolvedValue(0);
      mockPrismaService.device.count.mockResolvedValue(0);

      // Act
      const result = await service.getLiveMetrics() as { todayRevenue: number };

      // Assert
      expect(result.todayRevenue).toBe(0);
    });
  });

  describe('getLiveSalesData', () => {
    it('should fetch live sales data from database when not cached', async () => {
      // Arrange
      const mockOrders = [
        { id: '1', total: 100, status: 'COMPLETED', createdAt: new Date() },
        { id: '2', total: 200, status: 'PENDING', createdAt: new Date() },
      ];
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      // Act
      const result = await service.getLiveSalesData();

      // Assert
      expect(result).toHaveProperty('recentOrders');
      expect(result).toHaveProperty('count', 2);
      expect(result).toHaveProperty('totalValue', 300);
      expect(result).toHaveProperty('timestamp');
      expect(mockCacheService.set).toHaveBeenCalledWith('realtime:sales', result, 5);
    });

    it('should return cached sales data when available', async () => {
      // Arrange
      const cachedData = {
        recentOrders: [],
        count: 0,
        totalValue: 0,
        timestamp: new Date().toISOString(),
      };
      mockCacheService.get.mockResolvedValue(cachedData);

      // Act
      const result = await service.getLiveSalesData();

      // Assert
      expect(result).toEqual(cachedData);
      expect(mockPrismaService.order.findMany).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.order.findMany.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.getLiveSalesData()).rejects.toThrow('Database error');
    });
  });
});
