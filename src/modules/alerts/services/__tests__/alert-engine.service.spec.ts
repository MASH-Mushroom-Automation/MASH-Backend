import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleLogger } from '@nestjs/common';
import { AlertEngineService } from '../alert-engine.service';
import { PrismaService } from '../../../../database/prisma.service';
import { NotificationQueueService } from '../../../queues/services/notification-queue.service';
import { AlertCategory, AlertPriority } from '@prisma/client';

describe('AlertEngineService', () => {
  let service: AlertEngineService;

  const mockPrismaService = {
    alertRule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    alert: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockNotificationQueueService = {
    addEmailJob: jest.fn(),
    addSmsJob: jest.fn(),
    addPushNotificationJob: jest.fn(),
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
        AlertEngineService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationQueueService,
          useValue: mockNotificationQueueService,
        },
      ],
    })
      .setLogger(new ConsoleLogger()) // Use ConsoleLogger for NestJS v11 compatibility
      .compile();

    service = module.get<AlertEngineService>(AlertEngineService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateEvent', () => {
    const mockEvent = {
      eventType: 'sensor.temperature',
      data: {
        sensorId: 'temp-001',
        value: 35,
        unit: 'celsius',
      },
      timestamp: new Date(),
    };

    it('should trigger alert when condition is met', async () => {
      mockPrismaService.alertRule.findMany.mockResolvedValue([mockAlertRule]);
      mockPrismaService.alert.findFirst.mockResolvedValue(null); // No cooldown
      mockPrismaService.alert.create.mockResolvedValue({
        id: 'alert-123',
        ruleId: 'rule-123',
      });

      const result = await service.evaluateEvent(mockEvent);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockAlertRule);
      expect(mockPrismaService.alert.create).toHaveBeenCalled();
    });

    it('should not trigger alert when condition is not met', async () => {
      const belowThresholdEvent = {
        ...mockEvent,
        data: { ...mockEvent.data, value: 25 },
      };

      mockPrismaService.alertRule.findMany.mockResolvedValue([mockAlertRule]);

      const result = await service.evaluateEvent(belowThresholdEvent);

      expect(result).toHaveLength(0);
      expect(mockPrismaService.alert.create).not.toHaveBeenCalled();
    });

    it('should evaluate multiple rules for the same event', async () => {
      const rule2 = {
        ...mockAlertRule,
        id: 'rule-456',
        condition: { field: 'value', operator: 'GTE', threshold: 30 },
      };

      mockPrismaService.alertRule.findMany.mockResolvedValue([mockAlertRule, rule2]);
      mockPrismaService.alert.findFirst.mockResolvedValue(null);
      mockPrismaService.alert.create.mockResolvedValue({});

      const result = await service.evaluateEvent(mockEvent);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.alert.create).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully and continue evaluation', async () => {
      const rule2 = {
        ...mockAlertRule,
        id: 'rule-456',
      };

      mockPrismaService.alertRule.findMany.mockResolvedValue([mockAlertRule, rule2]);
      mockPrismaService.alert.findFirst.mockResolvedValue(null);
      mockPrismaService.alert.create
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({});

      const result = await service.evaluateEvent(mockEvent);

      // The service logs errors but continues evaluation
      // Both rules match the condition, one fails to create alert
      // The function still returns both triggered rules (the error is logged)
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no active rules exist', async () => {
      mockPrismaService.alertRule.findMany.mockResolvedValue([]);

      const result = await service.evaluateEvent(mockEvent);

      expect(result).toHaveLength(0);
      expect(mockPrismaService.alert.create).not.toHaveBeenCalled();
    });
  });

  describe('checkCondition - GT operator', () => {
    it('should return true when value is greater than threshold', () => {
      const condition = { field: 'temperature', operator: 'GT', threshold: 30 };
      const data = { temperature: 35 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return false when value is equal to threshold', () => {
      const condition = { field: 'temperature', operator: 'GT', threshold: 30 };
      const data = { temperature: 30 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });

    it('should return false when value is less than threshold', () => {
      const condition = { field: 'temperature', operator: 'GT', threshold: 30 };
      const data = { temperature: 25 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });
  });

  describe('checkCondition - GTE operator', () => {
    it('should return true when value is greater than threshold', () => {
      const condition = {
        field: 'temperature',
        operator: 'GTE',
        threshold: 30,
      };
      const data = { temperature: 35 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return true when value is equal to threshold', () => {
      const condition = {
        field: 'temperature',
        operator: 'GTE',
        threshold: 30,
      };
      const data = { temperature: 30 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return false when value is less than threshold', () => {
      const condition = {
        field: 'temperature',
        operator: 'GTE',
        threshold: 30,
      };
      const data = { temperature: 25 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });
  });

  describe('checkCondition - LT operator', () => {
    it('should return true when value is less than threshold', () => {
      const condition = { field: 'humidity', operator: 'LT', threshold: 50 };
      const data = { humidity: 40 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return false when value is equal to threshold', () => {
      const condition = { field: 'humidity', operator: 'LT', threshold: 50 };
      const data = { humidity: 50 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });

    it('should return false when value is greater than threshold', () => {
      const condition = { field: 'humidity', operator: 'LT', threshold: 50 };
      const data = { humidity: 60 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });
  });

  describe('checkCondition - LTE operator', () => {
    it('should return true when value is less than threshold', () => {
      const condition = { field: 'humidity', operator: 'LTE', threshold: 50 };
      const data = { humidity: 40 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return true when value is equal to threshold', () => {
      const condition = { field: 'humidity', operator: 'LTE', threshold: 50 };
      const data = { humidity: 50 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return false when value is greater than threshold', () => {
      const condition = { field: 'humidity', operator: 'LTE', threshold: 50 };
      const data = { humidity: 60 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });
  });

  describe('checkCondition - EQ operator', () => {
    it('should return true when values are equal (string)', () => {
      const condition = { field: 'status', operator: 'EQ', value: 'failed' };
      const data = { status: 'failed' };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return true when values are equal (number)', () => {
      const condition = { field: 'count', operator: 'EQ', value: 5 };
      const data = { count: 5 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return false when values are not equal', () => {
      const condition = { field: 'status', operator: 'EQ', value: 'failed' };
      const data = { status: 'success' };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });
  });

  describe('checkCondition - NE operator', () => {
    it('should return true when values are not equal', () => {
      const condition = { field: 'status', operator: 'NE', value: 'success' };
      const data = { status: 'failed' };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return false when values are equal', () => {
      const condition = { field: 'status', operator: 'NE', value: 'success' };
      const data = { status: 'success' };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });
  });

  describe('checkCondition - BETWEEN operator', () => {
    it('should return true when value is within range', () => {
      const condition = {
        field: 'temperature',
        operator: 'BETWEEN',
        min: 20,
        max: 30,
      };
      const data = { temperature: 25 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return true when value equals min', () => {
      const condition = {
        field: 'temperature',
        operator: 'BETWEEN',
        min: 20,
        max: 30,
      };
      const data = { temperature: 20 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return true when value equals max', () => {
      const condition = {
        field: 'temperature',
        operator: 'BETWEEN',
        min: 20,
        max: 30,
      };
      const data = { temperature: 30 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return false when value is below range', () => {
      const condition = {
        field: 'temperature',
        operator: 'BETWEEN',
        min: 20,
        max: 30,
      };
      const data = { temperature: 15 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });

    it('should return false when value is above range', () => {
      const condition = {
        field: 'temperature',
        operator: 'BETWEEN',
        min: 20,
        max: 30,
      };
      const data = { temperature: 35 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });
  });

  describe('checkCondition - IN operator', () => {
    it('should return true when value is in array', () => {
      const condition = {
        field: 'status',
        operator: 'IN',
        values: ['pending', 'processing', 'failed'],
      };
      const data = { status: 'failed' };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return false when value is not in array', () => {
      const condition = {
        field: 'status',
        operator: 'IN',
        values: ['pending', 'processing'],
      };
      const data = { status: 'failed' };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });

    it('should handle numeric arrays', () => {
      const condition = {
        field: 'code',
        operator: 'IN',
        values: [400, 401, 403, 404],
      };
      const data = { code: 404 };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });
  });

  describe('checkCondition - CONTAINS operator', () => {
    it('should return true when string contains substring (case-insensitive)', () => {
      const condition = {
        field: 'message',
        operator: 'CONTAINS',
        value: 'error',
      };
      const data = { message: 'Database ERROR occurred' };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return false when string does not contain substring', () => {
      const condition = {
        field: 'message',
        operator: 'CONTAINS',
        value: 'error',
      };
      const data = { message: 'Success: Operation completed' };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });

    it('should handle exact match', () => {
      const condition = { field: 'type', operator: 'CONTAINS', value: 'alert' };
      const data = { type: 'alert' };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });
  });

  describe('checkCondition - REGEX operator', () => {
    it('should return true when value matches regex pattern', () => {
      const condition = {
        field: 'email',
        operator: 'REGEX',
        value: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      };
      const data = { email: 'user@example.com' };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return false when value does not match regex', () => {
      const condition = {
        field: 'email',
        operator: 'REGEX',
        value: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      };
      const data = { email: 'invalid-email' };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });

    it('should handle simple pattern matching', () => {
      const condition = {
        field: 'deviceId',
        operator: 'REGEX',
        value: '^DEV-\\d{3}$',
      };
      const data = { deviceId: 'DEV-123' };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });
  });

  describe('checkCondition - nested fields', () => {
    it('should access nested field with dot notation', () => {
      const condition = {
        field: 'sensor.temperature.value',
        operator: 'GT',
        threshold: 30,
      };
      const data = {
        sensor: {
          temperature: {
            value: 35,
          },
        },
      };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(true);
    });

    it('should return false when nested field is undefined', () => {
      const condition = {
        field: 'sensor.temperature.value',
        operator: 'GT',
        threshold: 30,
      };
      const data = {
        sensor: {
          humidity: 60,
        },
      };

      const result = service['checkCondition'](condition, data);

      expect(result).toBe(false);
    });
  });

  describe('isWithinActiveHours', () => {
    it('should return true when no active hours specified', () => {
      const result = service['isWithinActiveHours'](null, new Date());

      expect(result).toBe(true);
    });

    it('should return true when current day is in allowed days', () => {
      const monday = new Date('2025-10-06T10:00:00'); // Monday
      const activeHours = {
        days: [1, 2, 3, 4, 5], // Monday-Friday
        start: '09:00',
        end: '17:00',
      };

      const result = service['isWithinActiveHours'](activeHours, monday);

      expect(result).toBe(true);
    });

    it('should return false when current day is not in allowed days', () => {
      const saturday = new Date('2025-10-11T10:00:00'); // Saturday
      const activeHours = {
        days: [1, 2, 3, 4, 5], // Monday-Friday
        start: '09:00',
        end: '17:00',
      };

      const result = service['isWithinActiveHours'](activeHours, saturday);

      expect(result).toBe(false);
    });

    it('should return true when time is within range', () => {
      const timestamp = new Date('2025-10-06T14:30:00'); // Monday 14:30
      const activeHours = {
        days: [1],
        start: '09:00',
        end: '17:00',
      };

      const result = service['isWithinActiveHours'](activeHours, timestamp);

      expect(result).toBe(true);
    });

    it('should return false when time is before start', () => {
      const timestamp = new Date('2025-10-06T08:00:00'); // Monday 08:00
      const activeHours = {
        days: [1],
        start: '09:00',
        end: '17:00',
      };

      const result = service['isWithinActiveHours'](activeHours, timestamp);

      expect(result).toBe(false);
    });

    it('should return false when time is after end', () => {
      const timestamp = new Date('2025-10-06T18:00:00'); // Monday 18:00
      const activeHours = {
        days: [1],
        start: '09:00',
        end: '17:00',
      };

      const result = service['isWithinActiveHours'](activeHours, timestamp);

      expect(result).toBe(false);
    });

    it('should handle time range without days restriction', () => {
      const timestamp = new Date('2025-10-11T10:00:00'); // Saturday 10:00
      const activeHours = {
        start: '09:00',
        end: '17:00',
      };

      const result = service['isWithinActiveHours'](activeHours, timestamp);

      expect(result).toBe(true);
    });
  });

  describe('isInCooldown', () => {
    it('should return false when no previous alert exists', async () => {
      mockPrismaService.alert.findFirst.mockResolvedValue(null);

      const result = await service['isInCooldown'](mockAlertRule);

      expect(result).toBe(false);
    });

    it('should return true when within cooldown period', async () => {
      const now = new Date();
      const recentAlert = {
        createdAt: new Date(now.getTime() - 5 * 60 * 1000), // 5 minutes ago
      };

      mockPrismaService.alert.findFirst.mockResolvedValue(recentAlert);

      const result = await service['isInCooldown'](mockAlertRule);

      expect(result).toBe(true);
    });

    it('should return false when cooldown period has expired', async () => {
      const now = new Date();
      const oldAlert = {
        createdAt: new Date(now.getTime() - 20 * 60 * 1000), // 20 minutes ago
      };

      mockPrismaService.alert.findFirst.mockResolvedValue(oldAlert);

      const result = await service['isInCooldown'](mockAlertRule);

      expect(result).toBe(false);
    });
  });

  describe('generateFingerprint', () => {
    it('should generate consistent fingerprint for same inputs', () => {
      const event = {
        eventType: 'sensor.temperature',
        data: { value: 35 },
      };

      const fp1 = service['generateFingerprint']('rule-123', event);
      const fp2 = service['generateFingerprint']('rule-123', event);

      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(16);
    });

    it('should generate different fingerprints for different rule IDs', () => {
      const event = {
        eventType: 'sensor.temperature',
        data: { value: 35 },
      };

      const fp1 = service['generateFingerprint']('rule-123', event);
      const fp2 = service['generateFingerprint']('rule-456', event);

      expect(fp1).not.toBe(fp2);
    });

    it('should generate different fingerprints for different event data', () => {
      const event1 = {
        eventType: 'sensor.temperature',
        data: { value: 35 },
      };
      const event2 = {
        eventType: 'sensor.temperature',
        data: { value: 40 },
      };

      const fp1 = service['generateFingerprint']('rule-123', event1);
      const fp2 = service['generateFingerprint']('rule-123', event2);

      expect(fp1).not.toBe(fp2);
    });
  });

  describe('getNestedValue', () => {
    it('should get top-level property', () => {
      const obj = { temperature: 35 };
      const result = service['getNestedValue'](obj, 'temperature') as number;

      expect(result).toBe(35);
    });

    it('should get nested property with dot notation', () => {
      const obj = {
        sensor: {
          temperature: {
            value: 35,
          },
        },
      };
      const result = service['getNestedValue'](obj, 'sensor.temperature.value') as number;

      expect(result).toBe(35);
    });

    it('should return undefined for non-existent property', () => {
      const obj = { temperature: 35 };
      const result = service['getNestedValue'](obj, 'humidity') as number | undefined;

      expect(result).toBeUndefined();
    });

    it('should return undefined for non-existent nested property', () => {
      const obj = { sensor: { temperature: 35 } };
      const result = service['getNestedValue'](obj, 'sensor.humidity.value') as number | undefined;

      expect(result).toBeUndefined();
    });
  });
});
