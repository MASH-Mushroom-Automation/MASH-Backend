import { Test, TestingModule } from '@nestjs/testing';
import { CartSchedulerService } from './cart-scheduler.service';
import { PrismaService } from '../../database/prisma.service';
import { CartCacheService } from './cart-cache.service';
import { PrometheusService } from '../../monitoring/prometheus/prometheus.service';
import { CartStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('CartSchedulerService', () => {
  let service: CartSchedulerService;
  let prismaService: jest.Mocked<PrismaService>;
  let cacheService: jest.Mocked<CartCacheService>;
  let prometheusService: jest.Mocked<PrometheusService>;

  const mockExpiredCart = {
    id: 'cart-1',
    userId: 'user-1',
    sessionId: null,
    status: CartStatus.ACTIVE,
    expiresAt: new Date(Date.now() - 86400000), // Yesterday
    createdAt: new Date(Date.now() - 172800000), // 2 days ago
    updatedAt: new Date(Date.now() - 86400000),
    subtotal: new Decimal(100),
    tax: new Decimal(12),
    shippingCost: new Decimal(50),
    total: new Decimal(162),
    metadata: {},
    items: [],
  };

  const mockAbandonedCart = {
    id: 'cart-2',
    userId: 'user-2',
    sessionId: null,
    status: CartStatus.ACTIVE,
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(Date.now() - 14400000), // 4 hours ago
    updatedAt: new Date(Date.now() - 14400000),
    subtotal: new Decimal(200),
    tax: new Decimal(24),
    shippingCost: new Decimal(50),
    total: new Decimal(274),
    metadata: {},
    items: [],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      cart: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const mockCacheService = {
      invalidateCart: jest.fn(),
      invalidateUserCarts: jest.fn(),
      invalidateSessionCarts: jest.fn(),
    };

    const mockPrometheusService = {
      recordCartAbandonment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartSchedulerService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CartCacheService, useValue: mockCacheService },
        { provide: PrometheusService, useValue: mockPrometheusService },
      ],
    }).compile();

    service = module.get<CartSchedulerService>(CartSchedulerService);
    prismaService = module.get(PrismaService);
    cacheService = module.get(CartCacheService);
    prometheusService = module.get(PrometheusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('expireInactiveCarts', () => {
    it('should expire carts that have passed expiresAt date', async () => {
      prismaService.cart.findMany.mockResolvedValue([mockExpiredCart] as any);
      prismaService.cart.updateMany.mockResolvedValue({ count: 1 });

      await service.expireInactiveCarts();

      expect(prismaService.cart.findMany).toHaveBeenCalledWith({
        where: {
          status: CartStatus.ACTIVE,
          expiresAt: { lte: expect.any(Date) },
        },
      });
      expect(prismaService.cart.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: [mockExpiredCart.id] },
          status: CartStatus.ACTIVE,
        },
        data: { status: CartStatus.EXPIRED },
      });
    });

    it('should invalidate cache for expired carts', async () => {
      prismaService.cart.findMany.mockResolvedValue([mockExpiredCart] as any);
      prismaService.cart.updateMany.mockResolvedValue({ count: 1 });

      await service.expireInactiveCarts();

      expect(cacheService.invalidateCart).toHaveBeenCalledWith(
        mockExpiredCart.userId,
        mockExpiredCart.sessionId,
      );
    });

    it('should handle multiple expired carts', async () => {
      const expiredCarts = [
        mockExpiredCart,
        { ...mockExpiredCart, id: 'cart-3', userId: 'user-3' },
        { ...mockExpiredCart, id: 'cart-4', userId: null, sessionId: 'session-4' },
      ];
      prismaService.cart.findMany.mockResolvedValue(expiredCarts as any);
      prismaService.cart.updateMany.mockResolvedValue({ count: 3 });

      await service.expireInactiveCarts();

      expect(cacheService.invalidateCart).toHaveBeenCalledTimes(3);
      expect(prismaService.cart.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: expiredCarts.map((c) => c.id) },
          status: CartStatus.ACTIVE,
        },
        data: { status: CartStatus.EXPIRED },
      });
    });

    it('should handle guest cart expiration', async () => {
      const guestCart = { ...mockExpiredCart, userId: null, sessionId: 'guest-session' };
      prismaService.cart.findMany.mockResolvedValue([guestCart] as any);
      prismaService.cart.updateMany.mockResolvedValue({ count: 1 });

      await service.expireInactiveCarts();

      expect(cacheService.invalidateCart).toHaveBeenCalledWith(null, 'guest-session');
    });

    it('should do nothing when no expired carts found', async () => {
      prismaService.cart.findMany.mockResolvedValue([]);

      await service.expireInactiveCarts();

      expect(prismaService.cart.updateMany).not.toHaveBeenCalled();
      expect(cacheService.invalidateCart).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      prismaService.cart.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.expireInactiveCarts()).rejects.toThrow('Database error');
    });
  });

  describe('detectAbandonedCarts', () => {
    it('should detect carts inactive for more than 3 hours', async () => {
      prismaService.cart.findMany.mockResolvedValue([mockAbandonedCart] as any);
      prismaService.cart.updateMany.mockResolvedValue({ count: 1 });

      await service.detectAbandonedCarts();

      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(prismaService.cart.findMany).toHaveBeenCalledWith({
        where: {
          status: CartStatus.ACTIVE,
          updatedAt: { lte: expect.any(Date) },
          metadata: { path: ['abandonedNotified'], equals: undefined },
        },
      });
    });

    it('should mark carts as abandoned with notification flag', async () => {
      prismaService.cart.findMany.mockResolvedValue([mockAbandonedCart] as any);
      prismaService.cart.updateMany.mockResolvedValue({ count: 1 });

      await service.detectAbandonedCarts();

      expect(prismaService.cart.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: [mockAbandonedCart.id] },
        },
        data: {
          metadata: { abandonedNotified: true, abandonedAt: expect.any(String) },
        },
      });
    });

    it('should record abandonment metrics for each cart', async () => {
      const abandonedCarts = [
        mockAbandonedCart,
        { ...mockAbandonedCart, id: 'cart-5', userId: 'user-5' },
      ];
      prismaService.cart.findMany.mockResolvedValue(abandonedCarts as any);
      prismaService.cart.updateMany.mockResolvedValue({ count: 2 });

      await service.detectAbandonedCarts();

      expect(prometheusService.recordCartAbandonment).toHaveBeenCalledTimes(2);
      expect(prometheusService.recordCartAbandonment).toHaveBeenCalledWith('authenticated');
    });

    it('should record guest cart abandonments', async () => {
      const guestAbandonedCart = { ...mockAbandonedCart, userId: null, sessionId: 'session-123' };
      prismaService.cart.findMany.mockResolvedValue([guestAbandonedCart] as any);
      prismaService.cart.updateMany.mockResolvedValue({ count: 1 });

      await service.detectAbandonedCarts();

      expect(prometheusService.recordCartAbandonment).toHaveBeenCalledWith('guest');
    });

    it('should not detect already notified abandoned carts', async () => {
      const notifiedCart = {
        ...mockAbandonedCart,
        metadata: { abandonedNotified: true },
      };
      prismaService.cart.findMany.mockResolvedValue([notifiedCart] as any);

      await service.detectAbandonedCarts();

      // Should still find carts but check the where clause excludes notified ones
      expect(prismaService.cart.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          metadata: { path: ['abandonedNotified'], equals: undefined },
        }),
      });
    });

    it('should do nothing when no abandoned carts found', async () => {
      prismaService.cart.findMany.mockResolvedValue([]);

      await service.detectAbandonedCarts();

      expect(prismaService.cart.updateMany).not.toHaveBeenCalled();
      expect(prometheusService.recordCartAbandonment).not.toHaveBeenCalled();
    });

    it('should handle multiple abandoned carts', async () => {
      const multipleCarts = [
        mockAbandonedCart,
        { ...mockAbandonedCart, id: 'cart-6' },
        { ...mockAbandonedCart, id: 'cart-7' },
      ];
      prismaService.cart.findMany.mockResolvedValue(multipleCarts as any);
      prismaService.cart.updateMany.mockResolvedValue({ count: 3 });

      await service.detectAbandonedCarts();

      expect(prometheusService.recordCartAbandonment).toHaveBeenCalledTimes(3);
      expect(prismaService.cart.updateMany).toHaveBeenCalledWith({
        where: { id: { in: multipleCarts.map((c) => c.id) } },
        data: expect.objectContaining({
          metadata: expect.objectContaining({ abandonedNotified: true }),
        }),
      });
    });
  });

  describe('getSchedulerStats', () => {
    it('should return statistics for due expirations and abandonments', async () => {
      prismaService.cart.count
        .mockResolvedValueOnce(5) // Carts due for expiration
        .mockResolvedValueOnce(3); // Carts due for abandonment

      const stats = await service.getSchedulerStats();

      expect(stats).toEqual({
        cartsDueForExpiration: 5,
        cartsDueForAbandonment: 3,
        nextExpirationRun: expect.any(String),
        nextAbandonmentCheck: expect.any(String),
      });
    });

    it('should count carts with expiresAt in the past', async () => {
      prismaService.cart.count.mockResolvedValue(2);

      await service.getSchedulerStats();

      expect(prismaService.cart.count).toHaveBeenCalledWith({
        where: {
          status: CartStatus.ACTIVE,
          expiresAt: { lte: expect.any(Date) },
        },
      });
    });

    it('should count carts inactive for more than 3 hours', async () => {
      prismaService.cart.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(4);

      await service.getSchedulerStats();

      const secondCall = prismaService.cart.count.mock.calls[1][0];
      expect(secondCall).toMatchObject({
        where: {
          status: CartStatus.ACTIVE,
          updatedAt: { lte: expect.any(Date) },
          metadata: { path: ['abandonedNotified'], equals: undefined },
        },
      });
    });

    it('should return zero counts when no carts are due', async () => {
      prismaService.cart.count.mockResolvedValue(0);

      const stats = await service.getSchedulerStats();

      expect(stats.cartsDueForExpiration).toBe(0);
      expect(stats.cartsDueForAbandonment).toBe(0);
    });

    it('should include next run times in stats', async () => {
      prismaService.cart.count.mockResolvedValue(0);

      const stats = await service.getSchedulerStats();

      expect(stats.nextExpirationRun).toContain('00:00');
      expect(stats.nextAbandonmentCheck).toMatch(/00:00|06:00|12:00|18:00/);
    });
  });

  describe('manualTriggerExpiration', () => {
    it('should call expireInactiveCarts when manually triggered', async () => {
      const expireSpy = jest.spyOn(service, 'expireInactiveCarts').mockResolvedValue();

      await service.manualTriggerExpiration();

      expect(expireSpy).toHaveBeenCalled();
    });
  });

  describe('manualTriggerAbandonment', () => {
    it('should call detectAbandonedCarts when manually triggered', async () => {
      const abandonmentSpy = jest.spyOn(service, 'detectAbandonedCarts').mockResolvedValue();

      await service.manualTriggerAbandonment();

      expect(abandonmentSpy).toHaveBeenCalled();
    });
  });
});
