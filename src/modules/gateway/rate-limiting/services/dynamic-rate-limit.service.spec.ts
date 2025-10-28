import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DynamicRateLimitService } from './dynamic-rate-limit.service';
import { PrismaService } from '../../../../database/prisma.service';
import { PrometheusService } from '../../../../monitoring/prometheus/prometheus.service';
import { TokenBucketStrategy } from '../strategies/token-bucket.strategy';
import { LeakyBucketStrategy } from '../strategies/leaky-bucket.strategy';
import { SlidingWindowStrategy } from '../strategies/sliding-window.strategy';
import { RateLimitStrategy } from '@prisma/client';
import { IRateLimitResult } from '../interfaces/rate-limit-strategy.interface';

describe('DynamicRateLimitService', () => {
  let service: DynamicRateLimitService;
  let prismaService: PrismaService;
  let prometheusService: PrometheusService;
  let tokenBucketStrategy: TokenBucketStrategy;
  let leakyBucketStrategy: LeakyBucketStrategy;
  let slidingWindowStrategy: SlidingWindowStrategy;

  // Mock services and strategies
  const mockPrismaService = {
    rateLimitOverride: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockPrometheusService = {
    rateLimitViolationsTotal: {
      inc: jest.fn(),
    },
  };

  const mockTokenBucketStrategy = {
    checkLimit: jest.fn(),
    reset: jest.fn(),
    getName: jest.fn().mockReturnValue('TOKEN_BUCKET'),
  };

  const mockLeakyBucketStrategy = {
    checkLimit: jest.fn(),
    reset: jest.fn(),
    getName: jest.fn().mockReturnValue('LEAKY_BUCKET'),
  };

  const mockSlidingWindowStrategy = {
    checkLimit: jest.fn(),
    reset: jest.fn(),
    getName: jest.fn().mockReturnValue('SLIDING_WINDOW'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicRateLimitService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PrometheusService,
          useValue: mockPrometheusService,
        },
        {
          provide: TokenBucketStrategy,
          useValue: mockTokenBucketStrategy,
        },
        {
          provide: LeakyBucketStrategy,
          useValue: mockLeakyBucketStrategy,
        },
        {
          provide: SlidingWindowStrategy,
          useValue: mockSlidingWindowStrategy,
        },
      ],
    }).compile();

    service = module.get<DynamicRateLimitService>(DynamicRateLimitService);
    prismaService = module.get<PrismaService>(PrismaService);
    prometheusService = module.get<PrometheusService>(PrometheusService);
    tokenBucketStrategy = module.get<TokenBucketStrategy>(TokenBucketStrategy);
    leakyBucketStrategy = module.get<LeakyBucketStrategy>(LeakyBucketStrategy);
    slidingWindowStrategy = module.get<SlidingWindowStrategy>(
      SlidingWindowStrategy,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkLimit', () => {
    describe('with custom override', () => {
      it('should use user-specific override when available', async () => {
        // Arrange
        const userId = 'user_123';
        const endpoint = '/api/v1/orders';
        const method = 'POST';

        const override = {
          id: 'override_1',
          userId,
          endpoint,
          requestLimit: 200,
          timeWindowMs: 60000,
          strategy: RateLimitStrategy.TOKEN_BUCKET,
          priority: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const rateLimitResult: IRateLimitResult = {
          allowed: true,
          current: 10,
          limit: 200,
          remaining: 190,
          resetMs: 50000,
        };

        mockPrismaService.rateLimitOverride.findFirst.mockResolvedValue(
          override,
        );
        mockTokenBucketStrategy.checkLimit.mockResolvedValue(rateLimitResult);

        // Act
        const result = await service.checkLimit(userId, endpoint, method);

        // Assert
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(200);
        expect(result.remaining).toBe(190);
        expect(mockTokenBucketStrategy.checkLimit).toHaveBeenCalledWith(
          expect.stringContaining('custom'),
          expect.objectContaining({
            limit: 200,
            windowMs: 60000,
          }),
        );
        expect(
          mockPrometheusService.rateLimitViolationsTotal.inc,
        ).toHaveBeenCalled();
      });

      it('should use endpoint-specific override when user override not found', async () => {
        // Arrange
        const userId = 'user_123';
        const endpoint = '/api/v1/orders';
        const method = 'POST';

        const override = {
          id: 'override_2',
          userId: null, // Endpoint override (any user)
          endpoint,
          requestLimit: 150,
          timeWindowMs: 60000,
          strategy: RateLimitStrategy.LEAKY_BUCKET,
          priority: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const rateLimitResult: IRateLimitResult = {
          allowed: true,
          current: 50,
          limit: 150,
          remaining: 100,
          resetMs: 40000,
        };

        mockPrismaService.rateLimitOverride.findFirst.mockResolvedValue(
          override,
        );
        mockLeakyBucketStrategy.checkLimit.mockResolvedValue(rateLimitResult);

        // Act
        const result = await service.checkLimit(userId, endpoint, method);

        // Assert
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(150);
        expect(mockLeakyBucketStrategy.checkLimit).toHaveBeenCalled();
      });

      it('should use SLIDING_WINDOW strategy when specified in override', async () => {
        // Arrange
        const userId = 'user_456';
        const endpoint = '/api/v1/products';
        const method = 'GET';

        const override = {
          id: 'override_3',
          userId,
          endpoint,
          requestLimit: 500,
          timeWindowMs: 120000,
          strategy: RateLimitStrategy.SLIDING_WINDOW,
          priority: 15,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const rateLimitResult: IRateLimitResult = {
          allowed: true,
          current: 250,
          limit: 500,
          remaining: 250,
          resetMs: 60000,
        };

        mockPrismaService.rateLimitOverride.findFirst.mockResolvedValue(
          override,
        );
        mockSlidingWindowStrategy.checkLimit.mockResolvedValue(rateLimitResult);

        // Act
        const result = await service.checkLimit(userId, endpoint, method);

        // Assert
        expect(result.allowed).toBe(true);
        expect(mockSlidingWindowStrategy.checkLimit).toHaveBeenCalled();
      });
    });

    describe('with default limits', () => {
      it('should use default limits when no override exists', async () => {
        // Arrange
        const userId = 'user_789';
        const endpoint = '/api/v1/users';
        const method = 'GET';

        mockPrismaService.rateLimitOverride.findFirst.mockResolvedValue(null);

        const rateLimitResult: IRateLimitResult = {
          allowed: true,
          current: 50,
          limit: 100,
          remaining: 50,
          resetMs: 30000,
        };

        mockTokenBucketStrategy.checkLimit.mockResolvedValue(rateLimitResult);

        // Act
        const result = await service.checkLimit(userId, endpoint, method);

        // Assert
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(100);
        expect(mockTokenBucketStrategy.checkLimit).toHaveBeenCalledWith(
          expect.stringContaining('default'),
          expect.objectContaining({
            limit: 100,
            windowMs: 60000,
          }),
        );
      });

      it('should handle anonymous users (null userId)', async () => {
        // Arrange
        const userId = null;
        const endpoint = '/api/v1/public';
        const method = 'GET';

        mockPrismaService.rateLimitOverride.findFirst.mockResolvedValue(null);

        const rateLimitResult: IRateLimitResult = {
          allowed: true,
          current: 10,
          limit: 100,
          remaining: 90,
          resetMs: 50000,
        };

        mockTokenBucketStrategy.checkLimit.mockResolvedValue(rateLimitResult);

        // Act
        const result = await service.checkLimit(userId, endpoint, method);

        // Assert
        expect(result.allowed).toBe(true);
        expect(mockTokenBucketStrategy.checkLimit).toHaveBeenCalledWith(
          expect.stringContaining('anonymous'),
          expect.any(Object),
        );
      });
    });

    describe('rate limit enforcement', () => {
      it('should deny request when limit exceeded', async () => {
        // Arrange
        const userId = 'user_999';
        const endpoint = '/api/v1/orders';
        const method = 'POST';

        mockPrismaService.rateLimitOverride.findFirst.mockResolvedValue(null);

        const rateLimitResult: IRateLimitResult = {
          allowed: false,
          current: 101,
          limit: 100,
          remaining: 0,
          resetMs: 30000,
          retryAfterMs: 30000,
        };

        mockTokenBucketStrategy.checkLimit.mockResolvedValue(rateLimitResult);

        // Act
        const result = await service.checkLimit(userId, endpoint, method);

        // Assert
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.retryAfterMs).toBe(30000);
        expect(
          mockPrometheusService.rateLimitViolationsTotal.inc,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            allowed: 'no',
          }),
        );
      });

      it('should allow request when within limit', async () => {
        // Arrange
        const userId = 'user_888';
        const endpoint = '/api/v1/products';
        const method = 'GET';

        mockPrismaService.rateLimitOverride.findFirst.mockResolvedValue(null);

        const rateLimitResult: IRateLimitResult = {
          allowed: true,
          current: 50,
          limit: 100,
          remaining: 50,
          resetMs: 40000,
        };

        mockTokenBucketStrategy.checkLimit.mockResolvedValue(rateLimitResult);

        // Act
        const result = await service.checkLimit(userId, endpoint, method);

        // Assert
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(50);
        expect(
          mockPrometheusService.rateLimitViolationsTotal.inc,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            allowed: 'yes',
          }),
        );
      });
    });

    describe('error handling', () => {
      it('should fail open (allow request) when strategy throws error', async () => {
        // Arrange
        const userId = 'user_777';
        const endpoint = '/api/v1/orders';
        const method = 'POST';

        mockPrismaService.rateLimitOverride.findFirst.mockResolvedValue(null);
        mockTokenBucketStrategy.checkLimit.mockRejectedValue(
          new Error('Redis connection failed'),
        );

        // Act
        const result = await service.checkLimit(userId, endpoint, method);

        // Assert - Fail open for availability
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(0);
        expect(result.remaining).toBe(0);
      });

      it('should fail open when database query fails', async () => {
        // Arrange
        const userId = 'user_666';
        const endpoint = '/api/v1/users';
        const method = 'GET';

        mockPrismaService.rateLimitOverride.findFirst.mockRejectedValue(
          new Error('Database connection lost'),
        );

        // Act
        const result = await service.checkLimit(userId, endpoint, method);

        // Assert - Fail open for availability
        expect(result.allowed).toBe(true);
      });
    });
  });

  describe('createOverride', () => {
    it('should create new rate limit override', async () => {
      // Arrange
      const dto = {
        userId: 'user_123',
        endpoint: '/api/v1/orders',
        requestLimit: 300,
        timeWindowMs: 60000,
        strategy: RateLimitStrategy.TOKEN_BUCKET,
        priority: 10,
        reason: 'Premium user',
      };

      const createdOverride = {
        id: 'override_new',
        ...dto,
        apiKey: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.rateLimitOverride.create.mockResolvedValue(
        createdOverride,
      );

      // Act
      const result = await service.createOverride(dto);

      // Assert
      expect(result.id).toBe('override_new');
      expect(result.requestLimit).toBe(300);
      expect(mockPrismaService.rateLimitOverride.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: dto.userId,
          endpoint: dto.endpoint,
          requestLimit: 300,
          timeWindowMs: 60000,
        }),
      });
    });

    it('should create override with expiration date', async () => {
      // Arrange
      const expiresAt = new Date(Date.now() + 86400000); // 24 hours
      const dto = {
        userId: 'user_456',
        endpoint: '/api/v1/products',
        requestLimit: 500,
        timeWindowMs: 120000,
        strategy: RateLimitStrategy.SLIDING_WINDOW,
        expiresAt: expiresAt.toISOString(),
      };

      const createdOverride = {
        id: 'override_expiring',
        ...dto,
        expiresAt,
        apiKey: null,
        priority: 0,
        reason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.rateLimitOverride.create.mockResolvedValue(
        createdOverride,
      );

      // Act
      const result = await service.createOverride(dto);

      // Assert
      expect(result.expiresAt).toEqual(expiresAt);
      expect(mockPrismaService.rateLimitOverride.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      });
    });
  });

  describe('updateOverride', () => {
    it('should update existing override', async () => {
      // Arrange
      const id = 'override_123';
      const dto = {
        requestLimit: 400,
        timeWindowMs: 90000,
        strategy: RateLimitStrategy.LEAKY_BUCKET,
      };

      const existingOverride = {
        id,
        userId: 'user_123',
        endpoint: '/api/v1/orders',
        requestLimit: 300,
        timeWindowMs: 60000,
        strategy: RateLimitStrategy.TOKEN_BUCKET,
        priority: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedOverride = {
        ...existingOverride,
        ...dto,
        updatedAt: new Date(),
      };

      mockPrismaService.rateLimitOverride.findUnique.mockResolvedValue(
        existingOverride,
      );
      mockPrismaService.rateLimitOverride.update.mockResolvedValue(
        updatedOverride,
      );

      // Act
      const result = await service.updateOverride(id, dto);

      // Assert
      expect(result.requestLimit).toBe(400);
      expect(result.strategy).toBe(RateLimitStrategy.LEAKY_BUCKET);
      expect(mockPrismaService.rateLimitOverride.update).toHaveBeenCalledWith({
        where: { id },
        data: expect.objectContaining({
          requestLimit: 400,
          timeWindowMs: 90000,
        }),
      });
    });

    it('should throw NotFoundException when override does not exist', async () => {
      // Arrange
      const id = 'nonexistent_override';
      const dto = { requestLimit: 500 };

      mockPrismaService.rateLimitOverride.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateOverride(id, dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.updateOverride(id, dto)).rejects.toThrow(
        `Rate limit override ${id} not found`,
      );
    });
  });

  describe('deleteOverride', () => {
    it('should delete existing override', async () => {
      // Arrange
      const id = 'override_delete';
      const existingOverride = {
        id,
        userId: 'user_123',
        endpoint: '/api/v1/orders',
        requestLimit: 300,
        timeWindowMs: 60000,
        strategy: RateLimitStrategy.TOKEN_BUCKET,
        priority: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.rateLimitOverride.findUnique.mockResolvedValue(
        existingOverride,
      );
      mockPrismaService.rateLimitOverride.delete.mockResolvedValue(
        existingOverride,
      );

      // Act
      const result = await service.deleteOverride(id);

      // Assert
      expect(result.id).toBe(id);
      expect(mockPrismaService.rateLimitOverride.delete).toHaveBeenCalledWith({
        where: { id },
      });
    });

    it('should throw NotFoundException when override does not exist', async () => {
      // Arrange
      const id = 'nonexistent_override';

      mockPrismaService.rateLimitOverride.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteOverride(id)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deleteOverride(id)).rejects.toThrow(
        `Rate limit override ${id} not found`,
      );
    });
  });

  describe('getOverrides', () => {
    it('should return paginated overrides', async () => {
      // Arrange
      const overrides = [
        {
          id: 'override_1',
          userId: 'user_123',
          endpoint: '/api/v1/orders',
          requestLimit: 300,
          timeWindowMs: 60000,
          strategy: RateLimitStrategy.TOKEN_BUCKET,
          priority: 10,
          user: { id: 'user_123', email: 'user@example.com' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'override_2',
          userId: 'user_456',
          endpoint: '/api/v1/products',
          requestLimit: 500,
          timeWindowMs: 120000,
          strategy: RateLimitStrategy.SLIDING_WINDOW,
          priority: 15,
          user: { id: 'user_456', email: 'user2@example.com' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.rateLimitOverride.findMany.mockResolvedValue(overrides);
      mockPrismaService.rateLimitOverride.count.mockResolvedValue(25);

      // Act
      const result = await service.getOverrides(0, 10);

      // Assert
      expect(result.overrides).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(result.skip).toBe(0);
      expect(result.take).toBe(10);
      expect(mockPrismaService.rateLimitOverride.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        }),
      );
    });

    it('should use default pagination values', async () => {
      // Arrange
      mockPrismaService.rateLimitOverride.findMany.mockResolvedValue([]);
      mockPrismaService.rateLimitOverride.count.mockResolvedValue(0);

      // Act
      const result = await service.getOverrides();

      // Assert
      expect(result.skip).toBe(0);
      expect(result.take).toBe(50); // Default take value
      expect(mockPrismaService.rateLimitOverride.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
        }),
      );
    });
  });

  describe('getUserOverrides', () => {
    it('should return all overrides for specific user', async () => {
      // Arrange
      const userId = 'user_123';
      const userOverrides = [
        {
          id: 'override_1',
          userId,
          endpoint: '/api/v1/orders',
          requestLimit: 300,
          timeWindowMs: 60000,
          strategy: RateLimitStrategy.TOKEN_BUCKET,
          priority: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'override_2',
          userId,
          endpoint: '/api/v1/products',
          requestLimit: 500,
          timeWindowMs: 120000,
          strategy: RateLimitStrategy.SLIDING_WINDOW,
          priority: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.rateLimitOverride.findMany.mockResolvedValue(
        userOverrides,
      );

      // Act
      const result = await service.getUserOverrides(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(userId);
      expect(result[1].userId).toBe(userId);
      expect(mockPrismaService.rateLimitOverride.findMany).toHaveBeenCalledWith(
        {
          where: { userId },
          orderBy: { createdAt: 'desc' },
        },
      );
    });
  });

  describe('cleanupExpiredOverrides', () => {
    it('should delete expired overrides', async () => {
      // Arrange
      mockPrismaService.rateLimitOverride.deleteMany.mockResolvedValue({
        count: 5,
      });

      // Act
      const count = await service.cleanupExpiredOverrides();

      // Assert
      expect(count).toBe(5);
      expect(
        mockPrismaService.rateLimitOverride.deleteMany,
      ).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should return zero when no expired overrides exist', async () => {
      // Arrange
      mockPrismaService.rateLimitOverride.deleteMany.mockResolvedValue({
        count: 0,
      });

      // Act
      const count = await service.cleanupExpiredOverrides();

      // Assert
      expect(count).toBe(0);
    });
  });
});
