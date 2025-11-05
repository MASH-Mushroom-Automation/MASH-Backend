import { Test, TestingModule } from '@nestjs/testing';
import { AlertHistoryService } from './alert-history.service';
import { PrismaService } from '@/database/prisma.service';
import { Logger } from '@nestjs/common';
import { AlertStatus, AlertPriority, AlertCategory } from '@prisma/client';

describe('AlertHistoryService', () => {
  let service: AlertHistoryService;
  let prisma: PrismaService;

  const mockPrismaService = {
    alert: {
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertHistoryService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AlertHistoryService>(AlertHistoryService);
    prisma = module.get<PrismaService>(PrismaService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAlertHistory', () => {
    it('should return paginated alert history', async () => {
      const mockAlerts = [
        {
          id: '1',
          eventType: 'HIGH_ERROR_RATE',
          status: AlertStatus.RESOLVED,
          priority: AlertPriority.HIGH,
          category: AlertCategory.SYSTEM,
          triggeredAt: new Date(),
        },
      ];

      mockPrismaService.alert.findMany.mockResolvedValue(mockAlerts);
      mockPrismaService.alert.count.mockResolvedValue(1);

      const result = await service.getAlertHistory({});

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');

      mockPrismaService.alert.findMany.mockResolvedValue([]);
      mockPrismaService.alert.count.mockResolvedValue(0);

      await service.getAlertHistory({ startDate, endDate });

      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            triggeredAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        }),
      );
    });

    it('should filter by priority', async () => {
      mockPrismaService.alert.findMany.mockResolvedValue([]);
      mockPrismaService.alert.count.mockResolvedValue(0);

      await service.getAlertHistory({ priority: AlertPriority.CRITICAL });

      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: AlertPriority.CRITICAL,
          }),
        }),
      );
    });

    it('should filter by category', async () => {
      mockPrismaService.alert.findMany.mockResolvedValue([]);
      mockPrismaService.alert.count.mockResolvedValue(0);

      await service.getAlertHistory({ category: AlertCategory.SECURITY });

      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: AlertCategory.SECURITY,
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrismaService.alert.findMany.mockResolvedValue([]);
      mockPrismaService.alert.count.mockResolvedValue(0);

      await service.getAlertHistory({ status: AlertStatus.ACKNOWLEDGED });

      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: AlertStatus.ACKNOWLEDGED,
          }),
        }),
      );
    });

    it('should apply pagination', async () => {
      mockPrismaService.alert.findMany.mockResolvedValue([]);
      mockPrismaService.alert.count.mockResolvedValue(0);

      await service.getAlertHistory({ limit: 10, offset: 20 });

      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      );
    });

    it('should calculate pagination metadata', async () => {
      mockPrismaService.alert.findMany.mockResolvedValue([]);
      mockPrismaService.alert.count.mockResolvedValue(100);

      const result = await service.getAlertHistory({ limit: 10, offset: 20 });

      expect(result.pagination.total).toBe(100);
      expect(result.pagination.page).toBe(3); // offset 20 / limit 10 + 1
      expect(result.pagination.pageSize).toBe(10);
      expect(result.pagination.totalPages).toBe(10); // 100 / 10
    });
  });

  describe('getActiveAlerts', () => {
    it('should return only active alerts', async () => {
      const mockAlerts = [
        { id: '1', status: AlertStatus.PENDING },
        { id: '2', status: AlertStatus.SENT },
        { id: '3', status: AlertStatus.ACKNOWLEDGED },
      ];

      mockPrismaService.alert.findMany.mockResolvedValue(mockAlerts);

      const result = await service.getActiveAlerts();

      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: [AlertStatus.PENDING, AlertStatus.SENT, AlertStatus.ACKNOWLEDGED, AlertStatus.ESCALATED],
            },
          }),
        }),
      );
      expect(result).toHaveLength(3);
    });

    it('should order by priority and triggered time', async () => {
      mockPrismaService.alert.findMany.mockResolvedValue([]);

      await service.getActiveAlerts();

      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priority: 'asc' }, { triggeredAt: 'desc' }],
        }),
      );
    });
  });

  describe('acknowledgeAlert', () => {
    it('should update alert status to ACKNOWLEDGED', async () => {
      const mockAlert = {
        id: '1',
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy: 'user-123',
        acknowledgedAt: new Date(),
      };

      mockPrismaService.alert.update.mockResolvedValue(mockAlert);

      const result = await service.acknowledgeAlert('1', 'user-123');

      expect(mockPrismaService.alert.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          status: AlertStatus.ACKNOWLEDGED,
          acknowledgedBy: 'user-123',
          acknowledgedAt: expect.any(Date),
        },
      });
      expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
    });

    it('should set acknowledgedAt timestamp', async () => {
      const mockAlert = {
        id: '1',
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
      };

      mockPrismaService.alert.update.mockResolvedValue(mockAlert);

      const result = await service.acknowledgeAlert('1', 'user-123');

      expect(result.acknowledgedAt).toBeDefined();
      expect(result.acknowledgedAt).toBeInstanceOf(Date);
    });
  });

  describe('resolveAlert', () => {
    it('should update alert status to RESOLVED', async () => {
      const mockAlert = {
        id: '1',
        status: AlertStatus.RESOLVED,
        resolvedBy: 'user-123',
        resolvedAt: new Date(),
        resolutionNotes: 'Fixed the issue',
      };

      mockPrismaService.alert.update.mockResolvedValue(mockAlert);

      const result = await service.resolveAlert('1', 'user-123', 'Fixed the issue');

      expect(mockPrismaService.alert.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          status: AlertStatus.RESOLVED,
          resolvedBy: 'user-123',
          resolvedAt: expect.any(Date),
          resolutionNotes: 'Fixed the issue',
        },
      });
      expect(result.status).toBe(AlertStatus.RESOLVED);
    });

    it('should store resolution notes', async () => {
      const notes = 'Database connection restored';
      const mockAlert = {
        id: '1',
        status: AlertStatus.RESOLVED,
        resolutionNotes: notes,
      };

      mockPrismaService.alert.update.mockResolvedValue(mockAlert);

      const result = await service.resolveAlert('1', 'user-123', notes);

      expect(result.resolutionNotes).toBe(notes);
    });
  });

  describe('getAlertStatistics', () => {
    it('should return statistics for specified period', async () => {
      mockPrismaService.alert.count.mockResolvedValue(100);
      mockPrismaService.alert.groupBy.mockResolvedValueOnce([
        { priority: AlertPriority.CRITICAL, _count: { id: 10 } },
        { priority: AlertPriority.HIGH, _count: { id: 30 } },
      ]);
      mockPrismaService.alert.groupBy.mockResolvedValueOnce([
        { category: AlertCategory.SYSTEM, _count: { id: 50 } },
        { category: AlertCategory.SECURITY, _count: { id: 50 } },
      ]);
      mockPrismaService.alert.findMany.mockResolvedValue([
        {
          triggeredAt: new Date('2025-01-01T10:00:00'),
          resolvedAt: new Date('2025-01-01T11:00:00'),
        },
      ]);

      const result = await service.getAlertStatistics(7);

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('byPriority');
      expect(result).toHaveProperty('byCategory');
      expect(result).toHaveProperty('avgResolutionTime');
      expect(result.total).toBe(100);
    });

    it('should calculate average resolution time', async () => {
      mockPrismaService.alert.count.mockResolvedValue(2);
      mockPrismaService.alert.groupBy.mockResolvedValue([]);
      mockPrismaService.alert.findMany.mockResolvedValue([
        {
          triggeredAt: new Date('2025-01-01T10:00:00'),
          resolvedAt: new Date('2025-01-01T11:00:00'), // 1 hour
        },
        {
          triggeredAt: new Date('2025-01-01T10:00:00'),
          resolvedAt: new Date('2025-01-01T13:00:00'), // 3 hours
        },
      ]);

      const result = await service.getAlertStatistics(7);

      // Average should be 2 hours = 7200 seconds
      expect(result.avgResolutionTime).toBe(7200);
    });

    it('should handle zero resolved alerts', async () => {
      mockPrismaService.alert.count.mockResolvedValue(0);
      mockPrismaService.alert.groupBy.mockResolvedValue([]);
      mockPrismaService.alert.findMany.mockResolvedValue([]);

      const result = await service.getAlertStatistics(7);

      expect(result.avgResolutionTime).toBe(0);
    });
  });

  describe('autoResolveStaleAlerts', () => {
    it('should auto-resolve alerts older than 7 days', async () => {
      const mockAlerts = [
        { id: '1', eventType: 'OLD_ALERT', triggeredAt: new Date('2024-01-01') },
      ];

      mockPrismaService.alert.findMany.mockResolvedValue(mockAlerts);
      mockPrismaService.alert.update.mockResolvedValue({});

      await service.autoResolveStaleAlerts();

      expect(mockPrismaService.alert.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          status: AlertStatus.RESOLVED,
          resolvedBy: 'system',
          resolvedAt: expect.any(Date),
          resolutionNotes: 'Auto-resolved: No activity for 7 days',
        },
      });
    });

    it('should only resolve pending/sent/acknowledged alerts', async () => {
      mockPrismaService.alert.findMany.mockResolvedValue([]);

      await service.autoResolveStaleAlerts();

      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: [AlertStatus.PENDING, AlertStatus.SENT, AlertStatus.ACKNOWLEDGED],
            },
          }),
        }),
      );
    });
  });
});
