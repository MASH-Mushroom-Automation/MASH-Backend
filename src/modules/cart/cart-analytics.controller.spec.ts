import { Test, TestingModule } from '@nestjs/testing';
import { CartAnalyticsController } from './cart-analytics.controller';
import { PrismaService } from '../../database/prisma.service';
import { CartStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('CartAnalyticsController', () => {
  let controller: CartAnalyticsController;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrismaService = {
      cart: {
        groupBy: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      cartItem: {
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartAnalyticsController],
      providers: [{ provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    controller = module.get<CartAnalyticsController>(CartAnalyticsController);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCartAnalytics', () => {
    it('should return comprehensive cart analytics', async () => {
      const mockStatusCounts = [
        { status: CartStatus.ACTIVE, _count: { status: 50 } },
        { status: CartStatus.COMPLETED, _count: { status: 100 } },
        { status: CartStatus.ABANDONED, _count: { status: 20 } },
      ];

      const mockAvgValue = { _avg: { total: new Decimal(150) } };
      const mockUserTypeCounts = [
        { userId: 'user-1', _count: { userId: 70 } },
        { userId: null, _count: { userId: 100 } },
      ];

      prismaService.cart.groupBy.mockResolvedValueOnce(mockStatusCounts as any);
      prismaService.cart.aggregate.mockResolvedValue(mockAvgValue as any);
      prismaService.cart.groupBy.mockResolvedValueOnce(mockUserTypeCounts as any);

      const result = await controller.getCartAnalytics();

      expect(result).toEqual({
        totalActiveCarts: 50,
        totalAbandonedCarts: 20,
        totalCompletedCarts: 100,
        averageCartValue: 150,
        conversionRate: expect.any(Number),
        abandonmentRate: expect.any(Number),
        guestCarts: 100,
        authenticatedCarts: 70,
      });
    });

    it('should calculate conversion rate correctly', async () => {
      const mockStatusCounts = [
        { status: CartStatus.ACTIVE, _count: { status: 10 } },
        { status: CartStatus.COMPLETED, _count: { status: 90 } },
      ];

      prismaService.cart.groupBy.mockResolvedValueOnce(mockStatusCounts as any);
      prismaService.cart.aggregate.mockResolvedValue({ _avg: { total: new Decimal(100) } } as any);
      prismaService.cart.groupBy.mockResolvedValueOnce([]);

      const result = await controller.getCartAnalytics();

      // 90 completed out of 100 total = 90%
      expect(result.conversionRate).toBe(90);
    });

    it('should calculate abandonment rate correctly', async () => {
      const mockStatusCounts = [
        { status: CartStatus.ABANDONED, _count: { status: 25 } },
        { status: CartStatus.COMPLETED, _count: { status: 75 } },
      ];

      prismaService.cart.groupBy.mockResolvedValueOnce(mockStatusCounts as any);
      prismaService.cart.aggregate.mockResolvedValue({ _avg: { total: new Decimal(100) } } as any);
      prismaService.cart.groupBy.mockResolvedValueOnce([]);

      const result = await controller.getCartAnalytics();

      // 25 abandoned out of 100 total = 25%
      expect(result.abandonmentRate).toBe(25);
    });

    it('should filter by date range when provided', async () => {
      const startDate = '2025-11-01';
      const endDate = '2025-11-30';

      prismaService.cart.groupBy.mockResolvedValue([]);
      prismaService.cart.aggregate.mockResolvedValue({ _avg: { total: null } } as any);

      await controller.getCartAnalytics(startDate, endDate);

      expect(prismaService.cart.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
        }),
      );
    });

    it('should use last 30 days as default date range', async () => {
      prismaService.cart.groupBy.mockResolvedValue([]);
      prismaService.cart.aggregate.mockResolvedValue({ _avg: { total: null } } as any);

      await controller.getCartAnalytics();

      const calls = prismaService.cart.groupBy.mock.calls[0];
      const whereClause = calls[0].where;
      expect(whereClause.createdAt.gte).toBeInstanceOf(Date);
      expect(whereClause.createdAt.lte).toBeInstanceOf(Date);
    });

    it('should handle zero carts gracefully', async () => {
      prismaService.cart.groupBy.mockResolvedValue([]);
      prismaService.cart.aggregate.mockResolvedValue({ _avg: { total: null } } as any);

      const result = await controller.getCartAnalytics();

      expect(result.totalActiveCarts).toBe(0);
      expect(result.totalCompletedCarts).toBe(0);
      expect(result.totalAbandonedCarts).toBe(0);
      expect(result.conversionRate).toBe(0);
      expect(result.abandonmentRate).toBe(0);
    });

    it('should distinguish between guest and authenticated carts', async () => {
      const mockUserTypeCounts = [
        { userId: 'user-1', _count: { userId: 60 } },
        { userId: 'user-2', _count: { userId: 40 } },
        { userId: null, _count: { userId: 50 } },
      ];

      prismaService.cart.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockUserTypeCounts as any);
      prismaService.cart.aggregate.mockResolvedValue({ _avg: { total: null } } as any);

      const result = await controller.getCartAnalytics();

      expect(result.authenticatedCarts).toBe(100); // 60 + 40
      expect(result.guestCarts).toBe(50);
    });
  });

  describe('getShippingRevenue', () => {
    it('should return shipping revenue breakdown by method', async () => {
      const mockShippingData = [
        { metadata: { shippingMethod: 'STANDARD' }, _sum: { shippingCost: new Decimal(1000) }, _count: { id: 50 } },
        { metadata: { shippingMethod: 'EXPRESS' }, _sum: { shippingCost: new Decimal(3000) }, _count: { id: 20 } },
        { metadata: { shippingMethod: 'SAME_DAY' }, _sum: { shippingCost: new Decimal(6000) }, _count: { id: 10 } },
      ];

      prismaService.cart.groupBy.mockResolvedValue(mockShippingData as any);

      const result = await controller.getShippingRevenue();

      expect(result.totalShippingRevenue).toBe(10000);
      expect(result.averageShippingCost).toBe(125); // 10000 / 80 orders
      expect(result.breakdown).toHaveLength(3);
      expect(result.breakdown[0]).toEqual({
        method: 'STANDARD',
        revenue: 1000,
        orderCount: 50,
      });
    });

    it('should filter by date range', async () => {
      const startDate = '2025-11-01';
      const endDate = '2025-11-30';

      prismaService.cart.groupBy.mockResolvedValue([]);

      await controller.getShippingRevenue(startDate, endDate);

      expect(prismaService.cart.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
        }),
      );
    });

    it('should handle zero shipping revenue', async () => {
      prismaService.cart.groupBy.mockResolvedValue([]);

      const result = await controller.getShippingRevenue();

      expect(result.totalShippingRevenue).toBe(0);
      expect(result.averageShippingCost).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });

    it('should only include completed carts', async () => {
      prismaService.cart.groupBy.mockResolvedValue([]);

      await controller.getShippingRevenue();

      expect(prismaService.cart.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: CartStatus.COMPLETED,
          }),
        }),
      );
    });

    it('should round revenue values to 2 decimal places', async () => {
      const mockData = [
        { metadata: { shippingMethod: 'STANDARD' }, _sum: { shippingCost: new Decimal(123.456) }, _count: { id: 1 } },
      ];

      prismaService.cart.groupBy.mockResolvedValue(mockData as any);

      const result = await controller.getShippingRevenue();

      expect(result.totalShippingRevenue).toBe(123.46);
      expect(result.breakdown[0].revenue).toBe(123.46);
    });
  });

  describe('getTaxCollected', () => {
    it('should return tax collection breakdown by region', async () => {
      const mockTaxData = [
        { metadata: { region: 'NCR' }, _sum: { tax: new Decimal(1200) }, _count: { id: 100 } },
        { metadata: { region: 'PROVINCE' }, _sum: { tax: new Decimal(800) }, _count: { id: 80 } },
      ];

      prismaService.cart.groupBy.mockResolvedValue(mockTaxData as any);

      const result = await controller.getTaxCollected();

      expect(result.totalTaxCollected).toBe(2000);
      expect(result.breakdown).toHaveLength(2);
      expect(result.breakdown[0]).toEqual({
        region: 'NCR',
        taxCollected: 1200,
        orderCount: 100,
      });
    });

    it('should filter by date range', async () => {
      const startDate = '2025-11-01';
      const endDate = '2025-11-30';

      prismaService.cart.groupBy.mockResolvedValue([]);

      await controller.getTaxCollected(startDate, endDate);

      expect(prismaService.cart.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
        }),
      );
    });

    it('should handle zero tax collected', async () => {
      prismaService.cart.groupBy.mockResolvedValue([]);

      const result = await controller.getTaxCollected();

      expect(result.totalTaxCollected).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });

    it('should only include completed carts', async () => {
      prismaService.cart.groupBy.mockResolvedValue([]);

      await controller.getTaxCollected();

      expect(prismaService.cart.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: CartStatus.COMPLETED,
          }),
        }),
      );
    });
  });

  describe('getActiveCarts', () => {
    it('should return active cart metrics', async () => {
      const mockActiveCarts = [
        {
          id: 'cart-1',
          total: new Decimal(150),
          updatedAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
          items: [{ id: 'item-1' }, { id: 'item-2' }],
        },
        {
          id: 'cart-2',
          total: new Decimal(250),
          updatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          items: [{ id: 'item-3' }],
        },
      ];

      prismaService.cart.count.mockResolvedValue(2);
      prismaService.cartItem.aggregate.mockResolvedValue({ _count: { id: 3 } } as any);
      prismaService.cart.aggregate.mockResolvedValue({ _avg: { total: new Decimal(200) } } as any);
      prismaService.cart.findMany.mockResolvedValue(mockActiveCarts as any);

      const result = await controller.getActiveCarts();

      expect(result.totalActiveCarts).toBe(2);
      expect(result.totalItems).toBe(3);
      expect(result.averageCartValue).toBe(200);
      expect(result.recentActivity).toBeDefined();
    });

    it('should track activity in last 5 minutes', async () => {
      const recentCart = {
        id: 'cart-1',
        total: new Decimal(100),
        updatedAt: new Date(Date.now() - 2 * 60 * 1000),
        items: [],
      };

      prismaService.cart.count.mockResolvedValue(1);
      prismaService.cartItem.aggregate.mockResolvedValue({ _count: { id: 0 } } as any);
      prismaService.cart.aggregate.mockResolvedValue({ _avg: { total: new Decimal(100) } } as any);
      prismaService.cart.findMany.mockResolvedValue([recentCart] as any);

      const result = await controller.getActiveCarts();

      expect(result.recentActivity.last5Minutes).toBe(1);
    });

    it('should track activity in last 15 minutes', async () => {
      const cart1 = {
        id: 'cart-1',
        total: new Decimal(100),
        updatedAt: new Date(Date.now() - 2 * 60 * 1000),
        items: [],
      };
      const cart2 = {
        id: 'cart-2',
        total: new Decimal(150),
        updatedAt: new Date(Date.now() - 12 * 60 * 1000),
        items: [],
      };

      prismaService.cart.count.mockResolvedValue(2);
      prismaService.cartItem.aggregate.mockResolvedValue({ _count: { id: 0 } } as any);
      prismaService.cart.aggregate.mockResolvedValue({ _avg: { total: new Decimal(125) } } as any);
      prismaService.cart.findMany.mockResolvedValue([cart1, cart2] as any);

      const result = await controller.getActiveCarts();

      expect(result.recentActivity.last15Minutes).toBe(2);
    });

    it('should track activity in last hour', async () => {
      const carts = [
        { id: '1', total: new Decimal(100), updatedAt: new Date(Date.now() - 2 * 60 * 1000), items: [] },
        { id: '2', total: new Decimal(150), updatedAt: new Date(Date.now() - 30 * 60 * 1000), items: [] },
        { id: '3', total: new Decimal(200), updatedAt: new Date(Date.now() - 55 * 60 * 1000), items: [] },
      ];

      prismaService.cart.count.mockResolvedValue(3);
      prismaService.cartItem.aggregate.mockResolvedValue({ _count: { id: 0 } } as any);
      prismaService.cart.aggregate.mockResolvedValue({ _avg: { total: new Decimal(150) } } as any);
      prismaService.cart.findMany.mockResolvedValue(carts as any);

      const result = await controller.getActiveCarts();

      expect(result.recentActivity.lastHour).toBe(3);
    });

    it('should handle zero active carts', async () => {
      prismaService.cart.count.mockResolvedValue(0);
      prismaService.cartItem.aggregate.mockResolvedValue({ _count: { id: 0 } } as any);
      prismaService.cart.aggregate.mockResolvedValue({ _avg: { total: null } } as any);
      prismaService.cart.findMany.mockResolvedValue([]);

      const result = await controller.getActiveCarts();

      expect(result.totalActiveCarts).toBe(0);
      expect(result.totalItems).toBe(0);
      expect(result.averageCartValue).toBe(0);
      expect(result.recentActivity.last5Minutes).toBe(0);
    });
  });
});
