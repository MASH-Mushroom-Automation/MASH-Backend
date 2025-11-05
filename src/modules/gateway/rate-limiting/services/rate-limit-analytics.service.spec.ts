import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitAnalyticsService } from './rate-limit-analytics.service';
import { PrismaService } from '../../../../database/prisma.service';

describe('RateLimitAnalyticsService', () => {
  let service: RateLimitAnalyticsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    rateLimitLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitAnalyticsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RateLimitAnalyticsService>(RateLimitAnalyticsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logViolation', () => {
    it('should log rate limit violation with metadata', async () => {
      // Arrange
      const identifier = 'user_123';
      const endpoint = '/api/v1/orders';
      const metadata = {
        count: 105,
        currentLimit: 100,
      };

      mockPrismaService.rateLimitLog.create.mockResolvedValue({
        id: 'log_1',
        identifier,
        endpoint,
        count: 105,
        windowStart: new Date(),
        windowEnd: new Date(),
        blocked: true,
      });

      // Act
      await service.logViolation(identifier, endpoint, metadata);

      // Assert
      expect(mockPrismaService.rateLimitLog.create).toHaveBeenCalledWith({
        data: {
          identifier,
          endpoint,
          count: 105,
          windowStart: expect.any(Date),
          windowEnd: expect.any(Date),
          blocked: true,
        },
      });
    });

    it('should use default count of 1 when not provided', async () => {
      // Arrange
      const identifier = 'user_456';
      const endpoint = '/api/v1/products';
      const metadata = {};

      mockPrismaService.rateLimitLog.create.mockResolvedValue({
        id: 'log_2',
        identifier,
        endpoint,
        count: 1,
        windowStart: new Date(),
        windowEnd: new Date(),
        blocked: true,
      });

      // Act
      await service.logViolation(identifier, endpoint, metadata);

      // Assert
      expect(mockPrismaService.rateLimitLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          count: 1,
        }),
      });
    });

    it('should not throw error when logging fails', async () => {
      // Arrange
      const identifier = 'user_789';
      const endpoint = '/api/v1/users';
      const metadata = { count: 50 };

      mockPrismaService.rateLimitLog.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert - Should not throw
      await expect(service.logViolation(identifier, endpoint, metadata)).resolves.not.toThrow();
    });
  });

  describe('getViolationStats', () => {
    it('should return violation statistics for identifier', async () => {
      // Arrange
      const identifier = 'user_123';
      const now = new Date();
      const violations = [
        {
          id: '1',
          identifier,
          endpoint: '/api/v1/orders',
          count: 5,
          windowStart: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
          windowEnd: new Date(now.getTime() - 29 * 60 * 1000),
          blocked: true,
        },
        {
          id: '2',
          identifier,
          endpoint: '/api/v1/orders',
          count: 10,
          windowStart: new Date(now.getTime() - 15 * 60 * 1000), // 15 minutes ago
          windowEnd: new Date(now.getTime() - 14 * 60 * 1000),
          blocked: true,
        },
        {
          id: '3',
          identifier,
          endpoint: '/api/v1/products',
          count: 3,
          windowStart: new Date(now.getTime() - 5 * 60 * 1000), // 5 minutes ago
          windowEnd: new Date(now.getTime() - 4 * 60 * 1000),
          blocked: true,
        },
      ];

      mockPrismaService.rateLimitLog.findMany.mockResolvedValue(violations);

      // Act
      const result = await service.getViolationStats(identifier);

      // Assert
      expect(result.identifier).toBe(identifier);
      expect(result.totalViolations).toBe(3);
      expect(result.violationsLast24h).toBe(3);
      expect(result.violationsLastHour).toBe(3);
      expect(result.topEndpoints).toHaveLength(2);
      expect(result.topEndpoints[0]).toEqual({
        endpoint: '/api/v1/orders',
        count: 15, // 5 + 10
      });
      expect(result.topEndpoints[1]).toEqual({
        endpoint: '/api/v1/products',
        count: 3,
      });
      expect(result.firstViolation).toEqual(violations[0].windowStart);
      expect(result.lastViolation).toEqual(violations[2].windowStart);
    });

    it('should filter violations by date range', async () => {
      // Arrange
      const identifier = 'user_456';
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      mockPrismaService.rateLimitLog.findMany.mockResolvedValue([]);

      // Act
      await service.getViolationStats(identifier, startDate, endDate);

      // Assert
      expect(mockPrismaService.rateLimitLog.findMany).toHaveBeenCalledWith({
        where: {
          identifier,
          windowStart: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { windowStart: 'asc' },
      });
    });

    it('should return empty stats when no violations found', async () => {
      // Arrange
      const identifier = 'user_clean';
      mockPrismaService.rateLimitLog.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getViolationStats(identifier);

      // Assert
      expect(result.identifier).toBe(identifier);
      expect(result.totalViolations).toBe(0);
      expect(result.violationsLast24h).toBe(0);
      expect(result.violationsLastHour).toBe(0);
      expect(result.topEndpoints).toHaveLength(0);
      expect(result.firstViolation).toBeNull();
      expect(result.lastViolation).toBeNull();
    });
  });

  describe('getViolations', () => {
    it('should return recent violations with default limit', async () => {
      // Arrange
      const violations = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `log_${i}`,
          identifier: `user_${i}`,
          endpoint: '/api/v1/test',
          count: 1,
          windowStart: new Date(),
          windowEnd: new Date(),
          blocked: true,
        }));

      mockPrismaService.rateLimitLog.findMany.mockResolvedValue(violations);

      // Act
      const result = await service.getViolations();

      // Assert
      expect(result).toHaveLength(100);
      expect(mockPrismaService.rateLimitLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { windowStart: 'desc' },
        take: 100,
      });
    });

    it('should filter violations by identifier', async () => {
      // Arrange
      const identifier = 'user_123';
      mockPrismaService.rateLimitLog.findMany.mockResolvedValue([]);

      // Act
      await service.getViolations(identifier);

      // Assert
      expect(mockPrismaService.rateLimitLog.findMany).toHaveBeenCalledWith({
        where: { identifier },
        orderBy: { windowStart: 'desc' },
        take: 100,
      });
    });

    it('should filter violations by endpoint', async () => {
      // Arrange
      const endpoint = '/api/v1/orders';
      mockPrismaService.rateLimitLog.findMany.mockResolvedValue([]);

      // Act
      await service.getViolations(undefined, endpoint);

      // Assert
      expect(mockPrismaService.rateLimitLog.findMany).toHaveBeenCalledWith({
        where: { endpoint },
        orderBy: { windowStart: 'desc' },
        take: 100,
      });
    });

    it('should filter violations by both identifier and endpoint', async () => {
      // Arrange
      const identifier = 'user_789';
      const endpoint = '/api/v1/products';
      mockPrismaService.rateLimitLog.findMany.mockResolvedValue([]);

      // Act
      await service.getViolations(identifier, endpoint, 50);

      // Assert
      expect(mockPrismaService.rateLimitLog.findMany).toHaveBeenCalledWith({
        where: { identifier, endpoint },
        orderBy: { windowStart: 'desc' },
        take: 50,
      });
    });
  });

  describe('getTopViolators', () => {
    it('should return top violators sorted by count', async () => {
      // Arrange
      const now = new Date();
      const violations = [
        {
          id: '1',
          identifier: 'user_1',
          endpoint: '/api/v1/orders',
          count: 1,
          windowStart: now,
          windowEnd: now,
          blocked: true,
        },
        {
          id: '2',
          identifier: 'user_1',
          endpoint: '/api/v1/orders',
          count: 1,
          windowStart: now,
          windowEnd: now,
          blocked: true,
        },
        {
          id: '3',
          identifier: 'user_2',
          endpoint: '/api/v1/products',
          count: 1,
          windowStart: now,
          windowEnd: now,
          blocked: true,
        },
        {
          id: '4',
          identifier: 'user_1',
          endpoint: '/api/v1/products',
          count: 1,
          windowStart: now,
          windowEnd: now,
          blocked: true,
        },
      ];

      mockPrismaService.rateLimitLog.findMany.mockResolvedValue(violations);

      // Act
      const result = await service.getTopViolators(2);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].identifier).toBe('user_1');
      expect(result[0].violationCount).toBe(3);
      expect(result[0].topEndpoint).toBe('/api/v1/orders'); // Most frequent
      expect(result[1].identifier).toBe('user_2');
      expect(result[1].violationCount).toBe(1);
    });

    it('should filter top violators by date range', async () => {
      // Arrange
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      mockPrismaService.rateLimitLog.findMany.mockResolvedValue([]);

      // Act
      await service.getTopViolators(20, startDate, endDate);

      // Assert
      expect(mockPrismaService.rateLimitLog.findMany).toHaveBeenCalledWith({
        where: {
          windowStart: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
    });
  });

  describe('detectAbusePattern', () => {
    it('should detect HIGH_VIOLATION_RATE pattern', async () => {
      // Arrange
      const identifier = 'abuser_1';
      mockPrismaService.rateLimitLog.count
        .mockResolvedValueOnce(150) // Total
        .mockResolvedValueOnce(120) // Last 24h
        .mockResolvedValueOnce(15); // Last hour

      mockPrismaService.rateLimitLog.findMany.mockResolvedValue(
        Array(15)
          .fill(null)
          .map((_, i) => ({
            id: `log_${i}`,
            identifier,
            endpoint: '/api/v1/orders',
            count: 1,
            windowStart: new Date(),
            windowEnd: new Date(),
            blocked: true,
          })),
      );

      // Act
      const result = await service.detectAbusePattern(identifier);

      // Assert
      expect(result).not.toBeNull();
      expect(result.identifier).toBe(identifier);
      expect(result.violationCount).toBe(150);
      expect(result.violationsInLast24h).toBe(120);
      expect(result.violationsInLastHour).toBe(15);
      expect(result.suspiciousPatterns).toContain('HIGH_VIOLATION_RATE');
      expect(result.suspiciousPatterns).toContain('FREQUENT_VIOLATIONS');
      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.recommendation).toBeDefined();
    });

    it('should detect RAPID_VIOLATIONS pattern', async () => {
      // Arrange
      const identifier = 'abuser_2';
      mockPrismaService.rateLimitLog.count
        .mockResolvedValueOnce(100) // Total
        .mockResolvedValueOnce(60) // Last 24h
        .mockResolvedValueOnce(25); // Last hour (>20 = RAPID)

      mockPrismaService.rateLimitLog.findMany.mockResolvedValue(
        Array(25)
          .fill(null)
          .map((_, i) => ({
            id: `log_${i}`,
            identifier,
            endpoint: '/api/v1/test',
            count: 1,
            windowStart: new Date(),
            windowEnd: new Date(),
            blocked: true,
          })),
      );

      // Act
      const result = await service.detectAbusePattern(identifier);

      // Assert
      expect(result.suspiciousPatterns).toContain('ELEVATED_VIOLATION_RATE');
      expect(result.suspiciousPatterns).toContain('RAPID_VIOLATIONS');
      expect(result.riskScore).toBeGreaterThanOrEqual(50); // 20 + 30
    });

    it('should detect API_SCRAPING pattern (many endpoints)', async () => {
      // Arrange
      const identifier = 'scraper_1';
      mockPrismaService.rateLimitLog.count
        .mockResolvedValueOnce(50) // Total
        .mockResolvedValueOnce(40) // Last 24h
        .mockResolvedValueOnce(30); // Last hour (>20 = RAPID +30)

      // Generate violations for 25 different endpoints
      const violations = Array(30)
        .fill(null)
        .map((_, i) => ({
          id: `log_${i}`,
          identifier,
          endpoint: `/api/v1/endpoint_${i}`,
          count: 1,
          windowStart: new Date(),
          windowEnd: new Date(),
          blocked: true,
        }));

      mockPrismaService.rateLimitLog.findMany.mockResolvedValue(violations);

      // Act
      const result = await service.detectAbusePattern(identifier);

      // Assert
      expect(result.suspiciousPatterns).toContain('API_SCRAPING');
      expect(result.riskScore).toBeGreaterThanOrEqual(50); // 30 (RAPID) + 20 (SCRAPING) = 50
    });

    it('should detect PERSISTENT_ATTACKER pattern', async () => {
      // Arrange
      const identifier = 'attacker_1';
      mockPrismaService.rateLimitLog.count
        .mockResolvedValueOnce(100) // Total
        .mockResolvedValueOnce(80) // Last 24h
        .mockResolvedValueOnce(20); // Last hour

      // 90% blocked rate (18 out of 20)
      const violations = Array(20)
        .fill(null)
        .map((_, i) => ({
          id: `log_${i}`,
          identifier,
          endpoint: '/api/v1/test',
          count: 1,
          windowStart: new Date(),
          windowEnd: new Date(),
          blocked: i < 18, // First 18 are blocked
        }));

      mockPrismaService.rateLimitLog.findMany.mockResolvedValue(violations);

      // Act
      const result = await service.detectAbusePattern(identifier);

      // Assert
      expect(result.suspiciousPatterns).toContain('PERSISTENT_ATTACKER');
    });

    it('should recommend BLOCK for high risk score (>80)', async () => {
      // Arrange
      const identifier = 'critical_abuser';
      mockPrismaService.rateLimitLog.count
        .mockResolvedValueOnce(200) // Total
        .mockResolvedValueOnce(150) // Last 24h (>100 = +40)
        .mockResolvedValueOnce(30); // Last hour (>20 = +30)

      // Many unique endpoints (>20 = +20)
      const violations = Array(30)
        .fill(null)
        .map((_, i) => ({
          id: `log_${i}`,
          identifier,
          endpoint: `/api/v1/endpoint_${i}`,
          count: 1,
          windowStart: new Date(),
          windowEnd: new Date(),
          blocked: true,
        }));

      mockPrismaService.rateLimitLog.findMany.mockResolvedValue(violations);

      // Act
      const result = await service.detectAbusePattern(identifier);

      // Assert
      expect(result.riskScore).toBeGreaterThanOrEqual(81);
      expect(result.recommendation).toBe('BLOCK');
    });

    it('should recommend THROTTLE for moderate risk score (61-80)', async () => {
      // Arrange
      const identifier = 'moderate_abuser';
      mockPrismaService.rateLimitLog.count
        .mockResolvedValueOnce(150) // Total
        .mockResolvedValueOnce(120) // Last 24h (>100 = +40)
        .mockResolvedValueOnce(25); // Last hour (>20 = +30)

      mockPrismaService.rateLimitLog.findMany.mockResolvedValue(
        Array(25)
          .fill(null)
          .map((_, i) => ({
            id: `log_${i}`,
            identifier,
            endpoint: '/api/v1/test',
            count: 1,
            windowStart: new Date(),
            windowEnd: new Date(),
            blocked: true,
          })),
      );

      // Act
      const result = await service.detectAbusePattern(identifier);

      // Assert
      expect(result.riskScore).toBeGreaterThanOrEqual(61); // 40 + 30 = 70
      expect(result.recommendation).toBe('THROTTLE');
    });

    it('should recommend WARN for low-moderate risk score (31-60)', async () => {
      // Arrange
      const identifier = 'suspicious_user';
      mockPrismaService.rateLimitLog.count
        .mockResolvedValueOnce(50) // Total
        .mockResolvedValueOnce(60) // Last 24h (>50 = +20)
        .mockResolvedValueOnce(15); // Last hour (10-20 = +15)

      mockPrismaService.rateLimitLog.findMany.mockResolvedValue(
        Array(15)
          .fill(null)
          .map((_, i) => ({
            id: `log_${i}`,
            identifier,
            endpoint: '/api/v1/test',
            count: 1,
            windowStart: new Date(),
            windowEnd: new Date(),
            blocked: true,
          })),
      );

      // Act
      const result = await service.detectAbusePattern(identifier);

      // Assert
      expect(result.riskScore).toBeGreaterThanOrEqual(31); // 20 + 15 = 35
      expect(result.riskScore).toBeLessThan(61);
      expect(result.recommendation).toBe('WARN');
    });

    it('should recommend MONITOR for low risk score (<31)', async () => {
      // Arrange
      const identifier = 'normal_user';
      mockPrismaService.rateLimitLog.count
        .mockResolvedValueOnce(10) // Total
        .mockResolvedValueOnce(5) // Last 24h
        .mockResolvedValueOnce(2); // Last hour

      mockPrismaService.rateLimitLog.findMany.mockResolvedValue(
        Array(2)
          .fill(null)
          .map((_, i) => ({
            id: `log_${i}`,
            identifier,
            endpoint: '/api/v1/test',
            count: 1,
            windowStart: new Date(),
            windowEnd: new Date(),
            blocked: true,
          })),
      );

      // Act
      const result = await service.detectAbusePattern(identifier);

      // Assert
      expect(result.riskScore).toBeLessThan(31);
      expect(result.recommendation).toBe('MONITOR');
    });

    it('should return null when no violations found', async () => {
      // Arrange
      const identifier = 'clean_user';
      mockPrismaService.rateLimitLog.count.mockResolvedValue(0);

      // Act
      const result = await service.detectAbusePattern(identifier);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('cleanupOldViolations', () => {
    it('should delete violations older than specified days', async () => {
      // Arrange
      const daysToKeep = 30;
      mockPrismaService.rateLimitLog.deleteMany.mockResolvedValue({
        count: 150,
      });

      // Act
      const count = await service.cleanupOldViolations(daysToKeep);

      // Assert
      expect(count).toBe(150);
      expect(mockPrismaService.rateLimitLog.deleteMany).toHaveBeenCalledWith({
        where: {
          windowStart: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should use default 30 days when not specified', async () => {
      // Arrange
      mockPrismaService.rateLimitLog.deleteMany.mockResolvedValue({
        count: 50,
      });

      // Act
      const count = await service.cleanupOldViolations();

      // Assert
      expect(count).toBe(50);
      expect(mockPrismaService.rateLimitLog.deleteMany).toHaveBeenCalled();
    });

    it('should return zero when no old violations found', async () => {
      // Arrange
      mockPrismaService.rateLimitLog.deleteMany.mockResolvedValue({
        count: 0,
      });

      // Act
      const count = await service.cleanupOldViolations(60);

      // Assert
      expect(count).toBe(0);
    });
  });
});
