import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleLogger } from '@nestjs/common';
import { AuditLogService, AuditAction } from '../audit-log.service';
import { PrismaService } from '../../../database/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    })
      .setLogger(new ConsoleLogger()) // Use ConsoleLogger for NestJS v11 compatibility
      .compile();

    service = module.get<AuditLogService>(AuditLogService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should log an audit event to database', async () => {
      const entry = {
        userId: 'user_123',
        action: AuditAction.LOGIN,
        entity: 'User',
        entityId: 'user_123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'audit_123',
        ...entry,
        timestamp: new Date(),
      });

      await service.log(entry);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_123',
          action: AuditAction.LOGIN,
          entity: 'User',
          entityId: 'user_123',
          oldValues: null,
          newValues: null,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      });
    });

    it('should log event with old and new values', async () => {
      const entry = {
        userId: 'user_123',
        action: AuditAction.USER_UPDATE,
        entity: 'User',
        entityId: 'user_123',
        oldValues: { name: 'Old Name' },
        newValues: { name: 'New Name' },
      };

      await service.log(entry);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          oldValues: { name: 'Old Name' },
          newValues: { name: 'New Name' },
        }),
      });
    });

    it('should not throw error if logging fails', async () => {
      mockPrismaService.auditLog.create.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.log({
          action: AuditAction.LOGIN,
          entity: 'User',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('findByUserId', () => {
    it('should find audit logs by user ID', async () => {
      const userId = 'user_123';
      const mockLogs = [
        {
          id: 'audit_1',
          userId,
          action: AuditAction.LOGIN,
          entity: 'User',
          timestamp: new Date(),
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.findByUserId(userId);

      expect(result).toEqual(mockLogs);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          timestamp: {
            gte: undefined,
            lte: undefined,
          },
          action: undefined,
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });

    it('should apply date filters', async () => {
      const userId = 'user_123';
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');

      await service.findByUserId(userId, { startDate, endDate });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        }),
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });

    it('should apply action filter', async () => {
      const userId = 'user_123';
      const actions = [AuditAction.LOGIN, AuditAction.LOGOUT];

      await service.findByUserId(userId, { actions });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          action: { in: actions },
        }),
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });
  });

  describe('findByEntity', () => {
    it('should find audit logs by entity', async () => {
      const entity = 'User';
      const entityId = 'user_123';

      await service.findByEntity(entity, entityId);

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entity,
          entityId,
          timestamp: {
            gte: undefined,
            lte: undefined,
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });
  });

  describe('getSecurityEvents', () => {
    it('should retrieve security-related events', async () => {
      const mockEvents = [
        {
          id: 'audit_1',
          action: AuditAction.LOGIN_FAILED,
          entity: 'Auth',
          timestamp: new Date(),
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockEvents);

      const result = await service.getSecurityEvents();

      expect(result).toEqual(mockEvents);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          action: {
            in: [
              AuditAction.LOGIN_FAILED,
              AuditAction.RATE_LIMIT_EXCEEDED,
              AuditAction.IP_BLOCKED,
              AuditAction.SUSPICIOUS_ACTIVITY,
              AuditAction.UNAUTHORIZED_ACCESS,
            ],
          },
          timestamp: {
            gte: undefined,
            lte: undefined,
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });
  });

  describe('getComplianceReport', () => {
    it('should generate compliance report', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');
      const mockLogs = [
        {
          id: 'audit_1',
          action: AuditAction.LOGIN,
          entity: 'User',
          timestamp: new Date('2025-06-01'),
        },
        {
          id: 'audit_2',
          action: AuditAction.LOGIN,
          entity: 'User',
          timestamp: new Date('2025-06-02'),
        },
        {
          id: 'audit_3',
          action: AuditAction.LOGOUT,
          entity: 'User',
          timestamp: new Date('2025-06-03'),
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getComplianceReport(startDate, endDate);

      expect(result).toMatchObject({
        period: { startDate, endDate },
        totalEvents: 3,
        actionCounts: {
          [AuditAction.LOGIN]: 2,
          [AuditAction.LOGOUT]: 1,
        },
        logs: mockLogs,
      });
    });
  });

  describe('getUserActivitySummary', () => {
    it('should generate user activity summary', async () => {
      const userId = 'user_123';
      const mockLogs = [
        {
          id: 'audit_1',
          userId,
          action: AuditAction.LOGIN,
          entity: 'User',
          timestamp: new Date('2025-06-03'),
        },
        {
          id: 'audit_2',
          userId,
          action: AuditAction.LOGIN,
          entity: 'User',
          timestamp: new Date('2025-06-02'),
        },
        {
          id: 'audit_3',
          userId,
          action: AuditAction.USER_UPDATE,
          entity: 'User',
          timestamp: new Date('2025-06-01'),
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getUserActivitySummary(userId);

      expect(result).toMatchObject({
        userId,
        totalActions: 3,
        actionCounts: {
          [AuditAction.LOGIN]: 2,
          [AuditAction.USER_UPDATE]: 1,
        },
        lastActivity: mockLogs[0].timestamp,
      });
      expect(result.recentLogs).toHaveLength(3);
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete logs older than specified days', async () => {
      const daysToKeep = 90;
      mockPrismaService.auditLog.deleteMany.mockResolvedValue({ count: 50 });

      const result = await service.cleanupOldLogs(daysToKeep);

      expect(result).toBe(50);
      expect(mockPrismaService.auditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should use default 90 days if not specified', async () => {
      mockPrismaService.auditLog.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupOldLogs();

      expect(mockPrismaService.auditLog.deleteMany).toHaveBeenCalled();
    });
  });
});
