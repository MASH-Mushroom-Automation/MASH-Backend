/**
 * RateLimitController Unit Tests
 *
 * Tests all 11 REST endpoints for rate limit management:
 * - Override CRUD operations (5 endpoints)
 * - Usage tracking (1 endpoint)
 * - Testing endpoints (1 endpoint)
 * - Violation management (3 endpoints)
 * - Cleanup operations (1 endpoint)
 *
 * Coverage Target: >85%
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitController } from '../rate-limit.controller';
import { DynamicRateLimitService } from '../../services/dynamic-rate-limit.service';
import { RateLimitAnalyticsService } from '../../services/rate-limit-analytics.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RateLimitStrategy } from '@prisma/client';

describe('RateLimitController', () => {
  let controller: RateLimitController;
  let dynamicRateLimit: jest.Mocked<DynamicRateLimitService>;
  let analytics: jest.Mocked<RateLimitAnalyticsService>;

  // Mock data
  const mockOverride = {
    id: 'override-1',
    userId: 'user-123',
    apiKey: null,
    endpoint: '/api/v1/products',
    method: 'GET',
    strategy: RateLimitStrategy.TOKEN_BUCKET,
    limit: 100,
    windowSeconds: 60,
    active: true,
    expiresAt: new Date('2025-12-31'),
    reason: 'Premium user',
    metadata: { tier: 'premium' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsageStats = {
    identifier: 'user-123',
    endpoint: '/api/v1/products',
    method: 'GET',
    strategy: 'TOKEN_BUCKET',
    stats: {
      current: 25,
      limit: 100,
      remaining: 75,
      resetAt: new Date(),
    },
  };

  const mockViolation = {
    id: 'violation-1',
    identifier: 'user-456',
    endpoint: '/api/v1/orders',
    method: 'POST',
    timestamp: new Date(),
    metadata: { count: 105, currentLimit: 100 },
  };

  beforeEach(async () => {
    // Create mocked services
    const mockDynamicRateLimitService = {
      createOverride: jest.fn(),
      updateOverride: jest.fn(),
      deleteOverride: jest.fn(),
      getOverride: jest.fn(),
      listOverrides: jest.fn(),
      getUsage: jest.fn(),
      checkLimit: jest.fn(),
    };

    const mockAnalyticsService = {
      logViolation: jest.fn(),
      getViolationHistory: jest.fn(),
      getViolationStats: jest.fn(),
      detectAbusePatterns: jest.fn(),
      clearViolations: jest.fn(),
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
    dynamicRateLimit = module.get(
      DynamicRateLimitService,
    ) as jest.Mocked<DynamicRateLimitService>;
    analytics = module.get(
      RateLimitAnalyticsService,
    ) as jest.Mocked<RateLimitAnalyticsService>;
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

      dynamicRateLimit.listOverrides.mockResolvedValue(mockResult);

      const result = await controller.listOverrides(0, 10);

      expect(result).toEqual(mockResult);
      expect(dynamicRateLimit.listOverrides).toHaveBeenCalledWith(0, 10);
    });

    it('should respect skip/take pagination parameters', async () => {
      const mockResult = {
        overrides: [mockOverride],
        total: 50,
        skip: 20,
        take: 10,
      };

      dynamicRateLimit.listOverrides.mockResolvedValue(mockResult);

      const result = await controller.listOverrides(20, 10);

      expect(result.skip).toBe(20);
      expect(result.take).toBe(10);
      expect(dynamicRateLimit.listOverrides).toHaveBeenCalledWith(20, 10);
    });

    it('should limit take to maximum 100 per page', async () => {
      const mockResult = {
        overrides: [],
        total: 0,
        skip: 0,
        take: 100,
      };

      dynamicRateLimit.listOverrides.mockResolvedValue(mockResult);

      await controller.listOverrides(0, 200);

      // Controller should cap at 100
      expect(dynamicRateLimit.listOverrides).toHaveBeenCalledWith(0, 100);
    });

    it('should return empty array when no overrides exist', async () => {
      const mockResult = {
        overrides: [],
        total: 0,
        skip: 0,
        take: 10,
      };

      dynamicRateLimit.listOverrides.mockResolvedValue(mockResult);

      const result = await controller.listOverrides(0, 10);

      expect(result.overrides).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('createOverride', () => {
    const createDto = {
      userId: 'user-123',
      endpoint: '/api/v1/products',
      method: 'GET',
      strategy: RateLimitStrategy.TOKEN_BUCKET,
      limit: 100,
      windowSeconds: 60,
      reason: 'Premium user',
      metadata: { tier: 'premium' },
    };

    it('should create a new override with valid data', async () => {
      dynamicRateLimit.createOverride.mockResolvedValue(mockOverride);

      const result = await controller.createOverride(createDto);

      expect(result).toEqual(mockOverride);
      expect(dynamicRateLimit.createOverride).toHaveBeenCalledWith(createDto);
    });

    it('should create override with API key instead of userId', async () => {
      const apiKeyDto = {
        ...createDto,
        userId: undefined,
        apiKey: 'api-key-123',
      };

      const mockApiKeyOverride = {
        ...mockOverride,
        userId: null,
        apiKey: 'api-key-123',
      };

      dynamicRateLimit.createOverride.mockResolvedValue(mockApiKeyOverride);

      const result = await controller.createOverride(apiKeyDto);

      expect(result.apiKey).toBe('api-key-123');
      expect(result.userId).toBeNull();
    });

    it('should create override with expiration date', async () => {
      const expiringDto = {
        ...createDto,
        expiresAt: new Date('2025-12-31'),
      };

      const mockExpiringOverride = {
        ...mockOverride,
        expiresAt: new Date('2025-12-31'),
      };

      dynamicRateLimit.createOverride.mockResolvedValue(mockExpiringOverride);

      const result = await controller.createOverride(expiringDto);

      expect(result.expiresAt).toEqual(new Date('2025-12-31'));
    });

    it('should reject invalid strategy type', async () => {
      const invalidDto = {
        ...createDto,
        strategy: 'INVALID_STRATEGY' as any,
      };

      dynamicRateLimit.createOverride.mockRejectedValue(
        new BadRequestException('Invalid strategy'),
      );

      await expect(controller.createOverride(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
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

  describe('getOverride', () => {
    it('should return override by id', async () => {
      dynamicRateLimit.getOverride.mockResolvedValue(mockOverride);

      const result = await controller.getOverride('override-1');

      expect(result).toEqual(mockOverride);
      expect(dynamicRateLimit.getOverride).toHaveBeenCalledWith('override-1');
    });

    it('should throw NotFoundException if override not found', async () => {
      dynamicRateLimit.getOverride.mockResolvedValue(null);

      await expect(controller.getOverride('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateOverride', () => {
    const updateDto = {
      limit: 200,
      reason: 'Updated limit for premium user',
    };

    it('should update override with new values', async () => {
      const updatedOverride = {
        ...mockOverride,
        limit: 200,
        reason: 'Updated limit for premium user',
      };

      dynamicRateLimit.updateOverride.mockResolvedValue(updatedOverride);

      const result = await controller.updateOverride('override-1', updateDto);

      expect(result.limit).toBe(200);
      expect(result.reason).toBe('Updated limit for premium user');
      expect(dynamicRateLimit.updateOverride).toHaveBeenCalledWith(
        'override-1',
        updateDto,
      );
    });

    it('should update only specified fields', async () => {
      const partialDto = { limit: 150 };
      const updatedOverride = { ...mockOverride, limit: 150 };

      dynamicRateLimit.updateOverride.mockResolvedValue(updatedOverride);

      const result = await controller.updateOverride('override-1', partialDto);

      expect(result.limit).toBe(150);
      expect(result.reason).toBe(mockOverride.reason); // Unchanged
    });

    it('should throw NotFoundException if override not found', async () => {
      dynamicRateLimit.updateOverride.mockResolvedValue(null);

      await expect(
        controller.updateOverride('nonexistent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow updating expiration date', async () => {
      const newExpiration = new Date('2026-12-31');
      const expirationDto = { expiresAt: newExpiration };
      const updatedOverride = { ...mockOverride, expiresAt: newExpiration };

      dynamicRateLimit.updateOverride.mockResolvedValue(updatedOverride);

      const result = await controller.updateOverride(
        'override-1',
        expirationDto,
      );

      expect(result.expiresAt).toEqual(newExpiration);
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
    it('should return usage stats for override', async () => {
      dynamicRateLimit.getOverride.mockResolvedValue(mockOverride);
      dynamicRateLimit.getUsage.mockResolvedValue(mockUsageStats);

      const result = await controller.getUsage('override-1');

      expect(result).toEqual(mockUsageStats);
      expect(dynamicRateLimit.getUsage).toHaveBeenCalledWith(
        'user-123',
        '/api/v1/products',
        'GET',
      );
    });

    it('should throw NotFoundException if override not found', async () => {
      dynamicRateLimit.getOverride.mockResolvedValue(null);

      await expect(controller.getUsage('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should show remaining quota correctly', async () => {
      dynamicRateLimit.getOverride.mockResolvedValue(mockOverride);
      dynamicRateLimit.getUsage.mockResolvedValue({
        ...mockUsageStats,
        stats: {
          current: 99,
          limit: 100,
          remaining: 1,
          resetAt: new Date(),
        },
      });

      const result = await controller.getUsage('override-1');

      expect(result.stats.remaining).toBe(1);
      expect(result.stats.current).toBe(99);
    });
  });

  describe('testRateLimit', () => {
    const testDto = {
      userId: 'user-123',
      endpoint: '/api/v1/products',
      method: 'GET',
      requestCount: 5,
    };

    it('should simulate multiple requests and return results', async () => {
      const mockResults = [
        { allowed: true, current: 1, limit: 100, remaining: 99 },
        { allowed: true, current: 2, limit: 100, remaining: 98 },
        { allowed: true, current: 3, limit: 100, remaining: 97 },
        { allowed: true, current: 4, limit: 100, remaining: 96 },
        { allowed: true, current: 5, limit: 100, remaining: 95 },
      ];

      dynamicRateLimit.checkLimit
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1])
        .mockResolvedValueOnce(mockResults[2])
        .mockResolvedValueOnce(mockResults[3])
        .mockResolvedValueOnce(mockResults[4]);

      const result = await controller.testRateLimit(testDto);

      expect(result.totalRequests).toBe(5);
      expect(result.allowed).toBe(5);
      expect(result.denied).toBe(0);
      expect(result.results).toHaveLength(5);
      expect(dynamicRateLimit.checkLimit).toHaveBeenCalledTimes(5);
    });

    it('should detect when rate limit is exceeded', async () => {
      dynamicRateLimit.checkLimit
        .mockResolvedValueOnce({
          allowed: true,
          current: 99,
          limit: 100,
          remaining: 1,
        })
        .mockResolvedValueOnce({
          allowed: true,
          current: 100,
          limit: 100,
          remaining: 0,
        })
        .mockResolvedValueOnce({
          allowed: false,
          current: 101,
          limit: 100,
          remaining: 0,
        });

      const result = await controller.testRateLimit({
        ...testDto,
        requestCount: 3,
      });

      expect(result.allowed).toBe(2);
      expect(result.denied).toBe(1);
      expect(result.results[2].allowed).toBe(false);
    });

    it('should return summary statistics', async () => {
      dynamicRateLimit.checkLimit.mockResolvedValue({
        allowed: true,
        current: 1,
        limit: 100,
        remaining: 99,
      });

      const result = await controller.testRateLimit(testDto);

      expect(result).toHaveProperty('totalRequests');
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('denied');
      expect(result).toHaveProperty('successRate');
    });
  });

  describe('getViolations', () => {
    it('should return paginated violations', async () => {
      const mockViolations = {
        violations: [mockViolation],
        total: 1,
        skip: 0,
        take: 10,
      };

      analytics.getViolationHistory.mockResolvedValue(mockViolations);

      const result = await controller.getViolations(0, 10);

      expect(result).toEqual(mockViolations);
      expect(analytics.getViolationHistory).toHaveBeenCalledWith(0, 10);
    });

    it('should limit take to maximum 100', async () => {
      analytics.getViolationHistory.mockResolvedValue({
        violations: [],
        total: 0,
        skip: 0,
        take: 100,
      });

      await controller.getViolations(0, 200);

      expect(analytics.getViolationHistory).toHaveBeenCalledWith(0, 100);
    });
  });

  describe('getViolationStats', () => {
    it('should return aggregated violation statistics', async () => {
      const mockStats = {
        total: 150,
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-10-25'),
        byEndpoint: {
          '/api/v1/orders': 75,
          '/api/v1/products': 50,
          '/api/v1/users': 25,
        },
        byUser: {
          'user-456': 100,
          'user-789': 50,
        },
        topOffenders: [
          { identifier: 'user-456', count: 100 },
          { identifier: 'user-789', count: 50 },
        ],
      };

      analytics.getViolationStats.mockResolvedValue(mockStats);

      const result = await controller.getViolationStats(
        new Date('2025-10-01'),
        new Date('2025-10-25'),
      );

      expect(result).toEqual(mockStats);
      expect(analytics.getViolationStats).toHaveBeenCalledWith(
        new Date('2025-10-01'),
        new Date('2025-10-25'),
      );
    });

    it('should handle optional date parameters', async () => {
      analytics.getViolationStats.mockResolvedValue({
        total: 0,
        byEndpoint: {},
        byUser: {},
        topOffenders: [],
      });

      await controller.getViolationStats();

      expect(analytics.getViolationStats).toHaveBeenCalled();
    });
  });

  describe('getAbusePatterns', () => {
    it('should detect and return abuse patterns', async () => {
      const mockPatterns = {
        riskScore: 85,
        isHighRisk: true,
        patterns: {
          repeatedViolations: true,
          endpointScanning: true,
          unusualTraffic: false,
          rapidRequests: true,
        },
        recommendations: [
          'Block user temporarily',
          'Reduce rate limits',
          'Enable CAPTCHA',
        ],
        details: {
          violationCount: 50,
          uniqueEndpoints: 15,
          avgRequestsPerSecond: 25,
        },
      };

      analytics.detectAbusePatterns.mockResolvedValue(mockPatterns);

      const result = await controller.getAbusePatterns('user-456');

      expect(result).toEqual(mockPatterns);
      expect(result.riskScore).toBe(85);
      expect(result.isHighRisk).toBe(true);
      expect(analytics.detectAbusePatterns).toHaveBeenCalledWith('user-456');
    });

    it('should return low risk for normal users', async () => {
      analytics.detectAbusePatterns.mockResolvedValue({
        riskScore: 25,
        isHighRisk: false,
        patterns: {
          repeatedViolations: false,
          endpointScanning: false,
          unusualTraffic: false,
          rapidRequests: false,
        },
        recommendations: [],
        details: {
          violationCount: 2,
          uniqueEndpoints: 3,
          avgRequestsPerSecond: 1,
        },
      });

      const result = await controller.getAbusePatterns('user-good');

      expect(result.isHighRisk).toBe(false);
      expect(result.riskScore).toBeLessThan(50);
    });
  });

  describe('cleanupViolations', () => {
    it('should delete violations older than specified days', async () => {
      analytics.clearViolations.mockResolvedValue(42);

      const result = await controller.cleanupViolations(90);

      expect(result.deleted).toBe(42);
      expect(result.message).toContain('42 violation records deleted');
      expect(analytics.clearViolations).toHaveBeenCalledWith(90);
    });

    it('should use default 90 days if not specified', async () => {
      analytics.clearViolations.mockResolvedValue(10);

      await controller.cleanupViolations();

      expect(analytics.clearViolations).toHaveBeenCalledWith(90);
    });

    it('should return zero if no violations to clean up', async () => {
      analytics.clearViolations.mockResolvedValue(0);

      const result = await controller.cleanupViolations(30);

      expect(result.deleted).toBe(0);
    });
  });
});
