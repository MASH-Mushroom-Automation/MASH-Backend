import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleLogger } from '@nestjs/common';
import { BatchProcessorService } from './batch-processor.service';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../common/services/cache.service';

describe('BatchProcessorService', () => {
  let service: BatchProcessorService;
  let prisma: PrismaService;
  let cacheService: CacheService;

  const mockPrismaService = {
    order: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    orderItem: {
      groupBy: jest.fn(),
    },
    sensorData: {
      count: jest.fn(),
    },
  };

  const mockCacheService = {
    set: jest.fn(),
  };

  beforeEach(async () => {
    // Set environment variable for tests
    process.env.ANALYTICS_BATCH_ENABLED = 'true';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchProcessorService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    })

      .setLogger(new ConsoleLogger()) // Use ConsoleLogger for NestJS v11 compatibility

      .compile();

    service = module.get<BatchProcessorService>(BatchProcessorService);
    prisma = module.get<PrismaService>(PrismaService);
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.ANALYTICS_BATCH_ENABLED;
  });

  describe('generateDailyReport', () => {
    it('should generate daily report with metrics', async () => {
      // Arrange
      mockPrismaService.order.count.mockResolvedValue(50);
      mockPrismaService.order.aggregate.mockResolvedValue({
        _sum: { total: 5000 },
      });
      mockPrismaService.user.count.mockResolvedValue(10);
      mockPrismaService.orderItem.groupBy.mockResolvedValue([
        { productId: '1', _sum: { quantity: 100 }, _count: 20 },
      ]);
      mockPrismaService.sensorData.count.mockResolvedValue(1000);

      // Act
      await service.generateDailyReport();

      // Assert
      expect(mockPrismaService.order.count).toHaveBeenCalled();
      expect(mockPrismaService.order.aggregate).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('batch:report:daily'),
        expect.objectContaining({
          type: 'daily',
          metrics: expect.objectContaining({
            totalOrders: 50,
            totalRevenue: 5000,
            newUsers: 10,
          }),
        }),
        86400 * 7,
      );
    });

    it('should not run when ANALYTICS_BATCH_ENABLED is false', async () => {
      // Arrange
      process.env.ANALYTICS_BATCH_ENABLED = 'false';

      // Act
      await service.generateDailyReport();

      // Assert
      expect(mockPrismaService.order.count).not.toHaveBeenCalled();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockPrismaService.order.count.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert - should not throw
      await expect(service.generateDailyReport()).resolves.not.toThrow();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('generateWeeklyReport', () => {
    it('should generate weekly report with metrics', async () => {
      // Arrange
      mockPrismaService.order.count.mockResolvedValue(300);
      mockPrismaService.order.aggregate.mockResolvedValue({
        _sum: { total: 30000 },
      });
      mockPrismaService.user.count.mockResolvedValue(50);
      mockPrismaService.orderItem.groupBy.mockResolvedValue([]);
      mockPrismaService.sensorData.count.mockResolvedValue(7000);

      // Act
      await service.generateWeeklyReport();

      // Assert
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('batch:report:weekly'),
        expect.objectContaining({
          type: 'weekly',
          metrics: expect.objectContaining({
            totalOrders: 300,
            totalRevenue: 30000,
          }),
        }),
        86400 * 7,
      );
    });

    it('should handle null revenue gracefully', async () => {
      // Arrange
      mockPrismaService.order.count.mockResolvedValue(0);
      mockPrismaService.order.aggregate.mockResolvedValue({
        _sum: { total: null },
      });
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.orderItem.groupBy.mockResolvedValue([]);
      mockPrismaService.sensorData.count.mockResolvedValue(0);

      // Act
      await service.generateWeeklyReport();

      // Assert
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metrics: expect.objectContaining({
            totalRevenue: 0,
          }),
        }),
        expect.anything(),
      );
    });
  });

  describe('generateMonthlyReport', () => {
    it('should generate monthly report with metrics', async () => {
      // Arrange
      mockPrismaService.order.count.mockResolvedValue(1000);
      mockPrismaService.order.aggregate.mockResolvedValue({
        _sum: { total: 100000 },
      });
      mockPrismaService.user.count.mockResolvedValue(200);
      mockPrismaService.orderItem.groupBy.mockResolvedValue([
        { productId: '1', _sum: { quantity: 500 }, _count: 100 },
        { productId: '2', _sum: { quantity: 300 }, _count: 80 },
      ]);
      mockPrismaService.sensorData.count.mockResolvedValue(30000);

      // Act
      await service.generateMonthlyReport();

      // Assert
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('batch:report:monthly'),
        expect.objectContaining({
          type: 'monthly',
          metrics: expect.objectContaining({
            totalOrders: 1000,
            totalRevenue: 100000,
            newUsers: 200,
            topProducts: expect.arrayContaining([
              expect.objectContaining({ productId: '1' }),
            ]),
          }),
        }),
        86400 * 7,
      );
    });

    it('should cache report for 7 days', async () => {
      // Arrange
      mockPrismaService.order.count.mockResolvedValue(100);
      mockPrismaService.order.aggregate.mockResolvedValue({
        _sum: { total: 10000 },
      });
      mockPrismaService.user.count.mockResolvedValue(20);
      mockPrismaService.orderItem.groupBy.mockResolvedValue([]);
      mockPrismaService.sensorData.count.mockResolvedValue(5000);

      // Act
      await service.generateMonthlyReport();

      // Assert
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        86400 * 7, // 7 days in seconds
      );
    });
  });
});
