import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleLogger, ConflictException, NotFoundException } from '@nestjs/common';
import { AlertRuleService } from '../alert-rule.service';
import { PrismaService } from '../../../../database/prisma.service';
import { AlertCategory, AlertPriority } from '@prisma/client';

describe('AlertRuleService', () => {
  let service: AlertRuleService;
  let prisma: PrismaService;

  const mockPrismaService = {
    alertRule: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockAlertRule = {
    id: 'rule-123',
    name: 'High Temperature Alert',
    description: 'Alert when temperature exceeds threshold',
    category: AlertCategory.SENSOR,
    priority: AlertPriority.HIGH,
    eventType: 'sensor.temperature',
    condition: { field: 'value', operator: 'GT', threshold: 30 },
    activeHours: null,
    cooldownMinutes: 15,
    isActive: true,
    isDeleted: false,
    createdBy: 'user-123',
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertRuleService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    })
      .setLogger(new ConsoleLogger()) // Use ConsoleLogger for NestJS v11 compatibility
      .compile();

    service = module.get<AlertRuleService>(AlertRuleService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'High Temperature Alert',
      description: 'Alert when temperature exceeds threshold',
      category: AlertCategory.SENSOR,
      priority: AlertPriority.HIGH,
      eventType: 'sensor.temperature',
      condition: { field: 'value', operator: 'GT', threshold: 30 },
      cooldownMinutes: 15,
      isActive: true,
    };

    it('should create a new alert rule successfully', async () => {
      mockPrismaService.alertRule.create.mockResolvedValue(mockAlertRule);

      const result = await service.create(createDto, 'user-123');

      expect(result).toEqual(mockAlertRule);
      expect(mockPrismaService.alertRule.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          description: createDto.description,
          category: createDto.category,
          priority: createDto.priority,
          eventType: createDto.eventType,
          condition: createDto.condition,
          activeHours: null,
          cooldownMinutes: createDto.cooldownMinutes,
          isActive: createDto.isActive,
          createdBy: 'user-123',
          updatedBy: 'user-123',
        },
        include: expect.objectContaining({
          creator: expect.any(Object),
        }),
      });
    });

    it('should set default values for optional fields', async () => {
      const minimalDto = {
        name: 'Test Alert',
        category: AlertCategory.SYSTEM,
        priority: AlertPriority.MEDIUM,
        eventType: 'system.event',
        condition: { field: 'status', operator: 'EQ', value: 'failed' },
      };

      mockPrismaService.alertRule.create.mockResolvedValue({
        ...mockAlertRule,
        ...minimalDto,
        cooldownMinutes: 15,
        isActive: true,
      });

      await service.create(minimalDto, 'user-123');

      expect(mockPrismaService.alertRule.create).toHaveBeenCalledWith({
        data: {
          name: minimalDto.name,
          description: undefined,
          category: minimalDto.category,
          priority: minimalDto.priority,
          eventType: minimalDto.eventType,
          condition: minimalDto.condition,
          activeHours: null,
          cooldownMinutes: 15,
          isActive: true,
          createdBy: 'user-123',
          updatedBy: 'user-123',
        },
        include: expect.objectContaining({
          creator: expect.any(Object),
        }),
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaService.alertRule.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.create(createDto, 'user-123')).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('findAll', () => {
    const mockRules = [mockAlertRule, { ...mockAlertRule, id: 'rule-456' }];

    it('should return all alert rules without filters', async () => {
      mockPrismaService.alertRule.findMany.mockResolvedValue(mockRules);

      const result = await service.findAll({});

      expect(result).toEqual(mockRules);
      expect(mockPrismaService.alertRule.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          recipients: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by category', async () => {
      mockPrismaService.alertRule.findMany.mockResolvedValue([mockAlertRule]);

      await service.findAll({ category: AlertCategory.SENSOR });

      expect(mockPrismaService.alertRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: AlertCategory.SENSOR },
        }),
      );
    });

    it('should filter by priority', async () => {
      mockPrismaService.alertRule.findMany.mockResolvedValue([mockAlertRule]);

      await service.findAll({ priority: AlertPriority.HIGH });

      expect(mockPrismaService.alertRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { priority: AlertPriority.HIGH },
        }),
      );
    });

    it('should filter by active status', async () => {
      mockPrismaService.alertRule.findMany.mockResolvedValue([mockAlertRule]);

      await service.findAll({ isActive: true });

      expect(mockPrismaService.alertRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('should filter by multiple criteria', async () => {
      mockPrismaService.alertRule.findMany.mockResolvedValue([mockAlertRule]);

      await service.findAll({
        category: AlertCategory.SENSOR,
        priority: AlertPriority.HIGH,
        isActive: true,
      });

      expect(mockPrismaService.alertRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            category: AlertCategory.SENSOR,
            priority: AlertPriority.HIGH,
            isActive: true,
          },
        }),
      );
    });

    it('should return empty array when no rules exist', async () => {
      mockPrismaService.alertRule.findMany.mockResolvedValue([]);

      const result = await service.findAll({});

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a single alert rule with relations', async () => {
      const mockRuleWithRelations = {
        ...mockAlertRule,
        alerts: [],
        recipients: [],
        creator: {
          id: 'user-123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
        updater: {
          id: 'user-456',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        },
      };

      mockPrismaService.alertRule.findUnique.mockResolvedValue(mockRuleWithRelations);

      const result = await service.findOne('rule-123');

      expect(result).toEqual(mockRuleWithRelations);
      expect(mockPrismaService.alertRule.findUnique).toHaveBeenCalledWith({
        where: { id: 'rule-123' },
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          updater: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          recipients: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          alerts: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    });

    it('should throw NotFoundException when rule does not exist', async () => {
      mockPrismaService.alertRule.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        "Alert rule with ID 'nonexistent' not found",
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Alert Name',
      priority: AlertPriority.CRITICAL,
      isActive: false,
    };

    it('should update an alert rule successfully', async () => {
      const updatedRule = {
        ...mockAlertRule,
        ...updateDto,
        updatedAt: expect.any(Date),
      };
      mockPrismaService.alertRule.findUnique.mockResolvedValue(mockAlertRule);
      mockPrismaService.alertRule.update.mockResolvedValue(updatedRule);

      const result = await service.update('rule-123', updateDto, 'user-456');

      expect(result).toEqual(updatedRule);
      expect(mockPrismaService.alertRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-123' },
        data: expect.objectContaining({
          name: updateDto.name,
          priority: updateDto.priority,
          isActive: updateDto.isActive,
          updatedBy: 'user-456',
          updatedAt: expect.any(Date),
        }),
        include: expect.objectContaining({
          creator: expect.any(Object),
          updater: expect.any(Object),
        }),
      });
    });

    it('should throw NotFoundException when rule does not exist', async () => {
      mockPrismaService.alertRule.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateDto, 'user-456')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow partial updates', async () => {
      const partialUpdate = { isActive: false };
      mockPrismaService.alertRule.findUnique.mockResolvedValue(mockAlertRule);
      mockPrismaService.alertRule.update.mockResolvedValue({
        ...mockAlertRule,
        ...partialUpdate,
        updatedAt: new Date(),
      });

      await service.update('rule-123', partialUpdate, 'user-456');

      expect(mockPrismaService.alertRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-123' },
        data: expect.objectContaining({
          isActive: false,
          updatedBy: 'user-456',
          updatedAt: expect.any(Date),
        }),
        include: expect.objectContaining({
          creator: expect.any(Object),
          updater: expect.any(Object),
        }),
      });
    });
  });

  describe('remove', () => {
    it('should delete an alert rule successfully', async () => {
      mockPrismaService.alertRule.findUnique.mockResolvedValue(mockAlertRule);
      mockPrismaService.alertRule.delete.mockResolvedValue(mockAlertRule);

      const result = await service.remove('rule-123');

      expect(result).toBeUndefined(); // Service returns void
      expect(mockPrismaService.alertRule.delete).toHaveBeenCalledWith({
        where: { id: 'rule-123' },
      });
    });

    it('should throw NotFoundException when rule does not exist', async () => {
      mockPrismaService.alertRule.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleActive', () => {
    it('should toggle rule from active to inactive', async () => {
      const activeRule = { ...mockAlertRule, isActive: true };
      const inactiveRule = {
        ...mockAlertRule,
        isActive: false,
        updatedAt: new Date(),
      };

      mockPrismaService.alertRule.findUnique.mockResolvedValue(activeRule);
      mockPrismaService.alertRule.update.mockResolvedValue(inactiveRule);

      const result = await service.toggleActive('rule-123', 'user-456');

      expect(result).toEqual(inactiveRule);
      expect(mockPrismaService.alertRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-123' },
        data: {
          isActive: false,
          updatedBy: 'user-456',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should toggle rule from inactive to active', async () => {
      const inactiveRule = { ...mockAlertRule, isActive: false };
      const activeRule = {
        ...mockAlertRule,
        isActive: true,
        updatedAt: new Date(),
      };

      mockPrismaService.alertRule.findUnique.mockResolvedValue(inactiveRule);
      mockPrismaService.alertRule.update.mockResolvedValue(activeRule);

      const result = await service.toggleActive('rule-123', 'user-456');

      expect(result).toEqual(activeRule);
      expect(mockPrismaService.alertRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-123' },
        data: {
          isActive: true,
          updatedBy: 'user-456',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException when rule does not exist', async () => {
      mockPrismaService.alertRule.findUnique.mockResolvedValue(null);

      await expect(service.toggleActive('nonexistent', 'user-456')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getActiveRulesByCategory', () => {
    it('should return active rules for a specific category', async () => {
      const sensorRules = [mockAlertRule, { ...mockAlertRule, id: 'rule-789' }];

      mockPrismaService.alertRule.findMany.mockResolvedValue(sensorRules);

      const result = await service.getActiveRulesByCategory(AlertCategory.SENSOR);

      expect(result).toEqual(sensorRules);
      expect(mockPrismaService.alertRule.findMany).toHaveBeenCalledWith({
        where: {
          category: AlertCategory.SENSOR,
          isActive: true,
        },
        include: {
          recipients: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });
    });

    it('should return empty array when no active rules exist for category', async () => {
      mockPrismaService.alertRule.findMany.mockResolvedValue([]);

      const result = await service.getActiveRulesByCategory(AlertCategory.BUSINESS);

      expect(result).toEqual([]);
    });
  });
});
