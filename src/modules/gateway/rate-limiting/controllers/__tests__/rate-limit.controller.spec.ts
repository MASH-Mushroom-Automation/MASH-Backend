/**
 * RateLimitController Unit Tests
 *
 * Tests REST endpoints for rate limit management
 * Coverage Target: >85%
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitController } from '../rate-limit.controller';
import { DynamicRateLimitService } from '../../services/dynamic-rate-limit.service';
import { RateLimitAnalyticsService } from '../../services/rate-limit-analytics.service';
import { NotFoundException } from '@nestjs/common';
import { RateLimitStrategy } from '@prisma/client';

describe('RateLimitController', () => {
  let controller: RateLimitController;
  let dynamicRateLimit: jest.Mocked<DynamicRateLimitService>;
  let analytics: jest.Mocked<RateLimitAnalyticsService>;

  // Mock data with correct field names
  const mockOverride = {
    id: 'override-1',
    userId: 'user-123',
    apiKey: null,
    endpoint: '/api/v1/products',
    strategy: RateLimitStrategy.TOKEN_BUCKET,
    requestLimit: 100,
    timeWindowMs: 60000,
    priority: 0,
    expiresAt: new Date('2025-12-31'),
    reason: 'Premium user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Create mocked services with actual method signatures
    const mockDynamicRateLimitService = {
      createOverride: jest.fn(),
      updateOverride: jest.fn(),
      deleteOverride: jest.fn(),
      getOverrides: jest.fn(),
      getUserOverrides: jest.fn(),
      checkLimit: jest.fn(),
      getRemainingLimit: jest.fn(),
      cleanupExpired: jest.fn(),
      clearUserOverrides: jest.fn(),
    };

    const mockAnalyticsService = {
      logViolation: jest.fn(),
      getViolations: jest.fn(),
      getViolationStats: jest.fn(),
      detectAbusePattern: jest.fn(),
      clearViolations: jest.fn(),
      getUserViolations: jest.fn(),
      getEndpointViolations: jest.fn(),
      getAbuseScore: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RateLimitController],
      providers: [
        {
          provide: DynamicRateLimitService,
          useValue: mockDynamicRateLimitService,
        },
        {
          provide: RateLimitAnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<RateLimitController>(RateLimitController);
    dynamicRateLimit = module.get(DynamicRateLimitService);
    analytics = module.get(RateLimitAnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listOverrides', () => {
    it('should return paginated overrides with default pagination', async () => {
      const mockResult = {
        overrides: [mockOverride],
        total: 1,
        skip: 0,
        take: 10,
      };

      dynamicRateLimit.getOverrides.mockResolvedValue(mockResult);

      const result = await controller.listOverrides(0, 10);

      expect(result).toEqual(mockResult);
      expect(dynamicRateLimit.getOverrides).toHaveBeenCalledWith(0, 10);
    });

    it('should limit take to maximum 100 per page', async () => {
      const mockResult = {
        overrides: [],
        total: 0,
        skip: 0,
        take: 100,
      };

      dynamicRateLimit.getOverrides.mockResolvedValue(mockResult);

      await controller.listOverrides(0, 200);

      // Controller should cap at 100
      expect(dynamicRateLimit.getOverrides).toHaveBeenCalledWith(0, 100);
    });

    it('should return empty array when no overrides exist', async () => {
      const mockResult = {
        overrides: [],
        total: 0,
        skip: 0,
        take: 10,
      };

      dynamicRateLimit.getOverrides.mockResolvedValue(mockResult);

      const result = await controller.listOverrides(0, 10);

      expect(result.overrides).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getUserOverrides', () => {
    it('should return overrides for a specific user', async () => {
      dynamicRateLimit.getUserOverrides.mockResolvedValue([mockOverride]);

      const result = await controller.getUserOverrides('user-123');

      expect(result).toEqual([mockOverride]);
      expect(dynamicRateLimit.getUserOverrides).toHaveBeenCalledWith(
        'user-123',
      );
    });
  });

  describe('createOverride', () => {
    const createDto = {
      userId: 'user-123',
      endpoint: '/api/v1/products',
      strategy: RateLimitStrategy.TOKEN_BUCKET,
      requestLimit: 100,
      timeWindowMs: 60000,
      reason: 'Premium user',
    };

    it('should create a new override with valid data', async () => {
      dynamicRateLimit.createOverride.mockResolvedValue(mockOverride);

      const result = await controller.createOverride(createDto);

      expect(result).toEqual(mockOverride);
      expect(dynamicRateLimit.createOverride).toHaveBeenCalledWith(createDto);
    });

    it('should create override with all 5 strategy types', async () => {
      const strategies = [
        RateLimitStrategy.TOKEN_BUCKET,
        RateLimitStrategy.LEAKY_BUCKET,
        RateLimitStrategy.SLIDING_WINDOW,
        RateLimitStrategy.FIXED_WINDOW,
        RateLimitStrategy.ADAPTIVE,
      ];

      for (const strategy of strategies) {
        const dto = { ...createDto, strategy };
        const override = { ...mockOverride, strategy };

        dynamicRateLimit.createOverride.mockResolvedValue(override);

        const result = await controller.createOverride(dto);

        expect(result.strategy).toBe(strategy);
      }

      expect(dynamicRateLimit.createOverride).toHaveBeenCalledTimes(5);
    });
  });

  describe('updateOverride', () => {
    const updateDto = {
      requestLimit: 200,
      reason: 'Updated limit for premium user',
    };

    it('should update override with new values', async () => {
      const updatedOverride = {
        ...mockOverride,
        requestLimit: 200,
        reason: 'Updated limit for premium user',
      };

      dynamicRateLimit.updateOverride.mockResolvedValue(updatedOverride);

      const result = await controller.updateOverride('override-1', updateDto);

      expect(result.requestLimit).toBe(200);
      expect(result.reason).toBe('Updated limit for premium user');
      expect(dynamicRateLimit.updateOverride).toHaveBeenCalledWith(
        'override-1',
        updateDto,
      );
    });

    it('should throw NotFoundException if override not found', async () => {
      dynamicRateLimit.updateOverride.mockResolvedValue(null);

      await expect(
        controller.updateOverride('nonexistent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteOverride', () => {
    it('should delete override and return success message', async () => {
      dynamicRateLimit.deleteOverride.mockResolvedValue(true);

      const result = await controller.deleteOverride('override-1');

      expect(result).toEqual({
        message: 'Rate limit override deleted successfully',
      });
      expect(dynamicRateLimit.deleteOverride).toHaveBeenCalledWith(
        'override-1',
      );
    });

    it('should throw NotFoundException if override not found', async () => {
      dynamicRateLimit.deleteOverride.mockResolvedValue(false);

      await expect(controller.deleteOverride('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUsage', () => {
    it('should return usage stats for user and endpoint', async () => {
      const mockUsage = {
        userId: 'user-123',
        endpoint: '/api/v1/products',
        current: 25,
        limit: 100,
        remaining: 75,
        resetMs: 60000,
        strategy: RateLimitStrategy.TOKEN_BUCKET,
      };

      dynamicRateLimit.checkLimit.mockResolvedValue({
        allowed: true,
        current: 25,
        limit: 100,
        remaining: 75,
        resetMs: 60000,
      });

      const result = await controller.getUsage('user-123', '/api/v1/products');

      expect(result.current).toBe(25);
      expect(result.remaining).toBe(75);
    });
  });

  describe('testRateLimit', () => {
    const testDto = {
      userId: 'user-123',
      endpoint: '/api/v1/products',
      requestCount: 3,
    };

    it('should simulate multiple requests and return results', async () => {
      dynamicRateLimit.checkLimit
        .mockResolvedValueOnce({
          allowed: true,
          current: 1,
          limit: 100,
          remaining: 99,
          resetMs: 60000,
        })
        .mockResolvedValueOnce({
          allowed: true,
          current: 2,
          limit: 100,
          remaining: 98,
          resetMs: 60000,
        })
        .mockResolvedValueOnce({
          allowed: true,
          current: 3,
          limit: 100,
          remaining: 97,
          resetMs: 60000,
        });

      const result = await controller.testRateLimit(testDto);

      expect(result.totalRequests).toBe(3);
      expect(result.allowed).toBe(3);
      expect(result.denied).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(dynamicRateLimit.checkLimit).toHaveBeenCalledTimes(3);
    });

    it('should detect when rate limit is exceeded', async () => {
      dynamicRateLimit.checkLimit
        .mockResolvedValueOnce({
          allowed: true,
          current: 99,
          limit: 100,
          remaining: 1,
          resetMs: 60000,
        })
        .mockResolvedValueOnce({
          allowed: true,
          current: 100,
          limit: 100,
          remaining: 0,
          resetMs: 60000,
        })
        .mockResolvedValueOnce({
          allowed: false,
          current: 101,
          limit: 100,
          remaining: 0,
          resetMs: 60000,
        });

      const result = await controller.testRateLimit(testDto);

      expect(result.allowed).toBe(2);
      expect(result.denied).toBe(1);
      expect(result.results[2].allowed).toBe(false);
    });
  });

  describe('getViolations', () => {
    it('should return paginated violations', async () => {
      const mockViolations = [
        {
          id: 'v1',
          identifier: 'user-456',
          endpoint: '/api/v1/orders',
          timestamp: new Date(),
          requestCount: 105,
          limit: 100,
        },
      ];

      analytics.getViolations.mockResolvedValue(mockViolations);

      const result = await controller.getViolations(0, 10);

      expect(result).toEqual(mockViolations);
      expect(analytics.getViolations).toHaveBeenCalled();
    });
  });

  describe('getViolationStatsByUser', () => {
    it('should return violation stats for specific user', async () => {
      const mockStats = {
        identifier: 'user-456',
        totalViolations: 50,
        uniqueEndpoints: 5,
        firstViolation: new Date('2025-10-01'),
        lastViolation: new Date('2025-10-25'),
        violationsByEndpoint: {
          '/api/v1/orders': 25,
          '/api/v1/products': 25,
        },
      };

      analytics.getViolationStats.mockResolvedValue(mockStats);

      const result = await controller.getViolationStatsByUser('user-456');

      expect(result.identifier).toBe('user-456');
      expect(result.totalViolations).toBe(50);
      expect(analytics.getViolationStats).toHaveBeenCalledWith('user-456');
    });
  });

  describe('getTopViolators', () => {
    it('should return list of top violators', async () => {
      const mockTopViolators = [
        { identifier: 'user-456', violationCount: 100 },
        { identifier: 'user-789', violationCount: 50 },
      ];

      analytics.getViolations.mockResolvedValue(mockTopViolators as any);

      const result = await controller.getTopViolators(10);

      expect(result).toEqual(mockTopViolators);
    });
  });

  describe('detectAbusePattern', () => {
    it('should detect and return abuse patterns for user', async () => {
      const mockPattern = {
        identifier: 'user-456',
        riskScore: 85,
        isHighRisk: true,
        violationCount: 50,
        uniqueEndpoints: 15,
        avgRequestsPerMinute: 250,
        suspiciousPatterns: ['rapid_requests', 'endpoint_scanning'],
      };

      analytics.detectAbusePattern.mockResolvedValue(mockPattern);

      const result = await controller.detectAbusePattern('user-456');

      expect(result.riskScore).toBe(85);
      expect(result.isHighRisk).toBe(true);
      expect(analytics.detectAbusePattern).toHaveBeenCalledWith('user-456');
    });

    it('should return low risk for normal users', async () => {
      analytics.detectAbusePattern.mockResolvedValue({
        identifier: 'user-good',
        riskScore: 10,
        isHighRisk: false,
        violationCount: 1,
        uniqueEndpoints: 2,
        avgRequestsPerMinute: 5,
        suspiciousPatterns: [],
      });

      const result = await controller.detectAbusePattern('user-good');

      expect(result.isHighRisk).toBe(false);
      expect(result.riskScore).toBeLessThan(50);
    });
  });
});
