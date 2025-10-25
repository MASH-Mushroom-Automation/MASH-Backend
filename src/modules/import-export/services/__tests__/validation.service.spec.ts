/**
 * Validation Service Unit Tests
 *
 * Tests for ValidationService covering:
 * - All 11 validation rule types
 * - Batch validation
 * - Error collection and summary
 * - Context management
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ValidationService } from '../validation.service';
import { PrismaService } from '../../../../database/prisma.service';
import {
  ValidationRuleType,
  DataType,
  ValidationRule,
  ValidationOptions,
  ErrorSeverity,
} from '../../validators/validation.types';

describe('ValidationService', () => {
  let service: ValidationService;
  let prisma: PrismaService;

  const mockPrismaService = {
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ValidationService>(ValidationService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('REQUIRED rule', () => {
    it('should pass when required field is present', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'name',
          type: ValidationRuleType.REQUIRED,
          message: 'Name is required',
        },
      ];

      const records = [{ name: 'Product 1' }];

      const result = await service.validateBatch(records, rules);

      expect(result.valid).toBe(true);
      expect(result.validRecords).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when required field is missing', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'name',
          type: ValidationRuleType.REQUIRED,
          message: 'Name is required',
        },
      ];

      const records = [{ price: 100 }];

      const result = await service.validateBatch(records, rules);

      expect(result.valid).toBe(false);
      expect(result.invalidRecords).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('name');
      expect(result.errors[0].type).toBe('REQUIRED');
    });

    it('should fail when required field is empty string', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'name',
          type: ValidationRuleType.REQUIRED,
          message: 'Name is required',
        },
      ];

      const records = [{ name: '' }];

      const result = await service.validateBatch(records, rules);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('name');
    });
  });

  describe('TYPE rule', () => {
    it('should validate STRING type', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'name',
          type: ValidationRuleType.TYPE,
          dataType: DataType.STRING,
          message: 'Name must be a string',
        },
      ];

      const validRecords = [{ name: 'Product 1' }];
      const invalidRecords = [{ name: 123 }];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors[0].type).toBe('TYPE');
    });

    it('should validate NUMBER type', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'price',
          type: ValidationRuleType.TYPE,
          dataType: DataType.NUMBER,
          message: 'Price must be a number',
        },
      ];

      const validRecords = [{ price: 100 }, { price: '100' }]; // String numbers should convert
      const invalidRecords = [{ price: 'invalid' }];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate INTEGER type', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'stock',
          type: ValidationRuleType.TYPE,
          dataType: DataType.INTEGER,
          message: 'Stock must be an integer',
        },
      ];

      const validRecords = [{ stock: 10 }, { stock: '10' }];
      const invalidRecords = [{ stock: 10.5 }, { stock: '10.5' }];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate BOOLEAN type', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'isActive',
          type: ValidationRuleType.TYPE,
          dataType: DataType.BOOLEAN,
          message: 'isActive must be a boolean',
        },
      ];

      const validRecords = [
        { isActive: true },
        { isActive: false },
        { isActive: 'true' },
        { isActive: 'false' },
      ];
      const invalidRecords = [{ isActive: 'invalid' }];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate DATE type', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'createdAt',
          type: ValidationRuleType.TYPE,
          dataType: DataType.DATE,
          message: 'createdAt must be a valid date',
        },
      ];

      const validRecords = [
        { createdAt: new Date() },
        { createdAt: '2025-10-25' },
        { createdAt: '2025-10-25T10:30:00Z' },
      ];
      const invalidRecords = [{ createdAt: 'invalid-date' }];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe('FORMAT rule', () => {
    it('should validate EMAIL format', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'email',
          type: ValidationRuleType.FORMAT,
          dataType: DataType.EMAIL,
          message: 'Invalid email format',
        },
      ];

      const validRecords = [
        { email: 'user@example.com' },
        { email: 'user.name+tag@example.co.uk' },
      ];
      const invalidRecords = [
        { email: 'invalid' },
        { email: 'user@' },
        { email: '@example.com' },
      ];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(3);
    });

    it('should validate PHONE format', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'phone',
          type: ValidationRuleType.FORMAT,
          dataType: DataType.PHONE,
          message: 'Invalid phone format',
        },
      ];

      const validRecords = [
        { phone: '+639171234567' },
        { phone: '09171234567' },
        { phone: '+1-555-123-4567' },
      ];
      const invalidRecords = [{ phone: '123' }, { phone: 'invalid' }];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate URL format', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'website',
          type: ValidationRuleType.FORMAT,
          dataType: DataType.URL,
          message: 'Invalid URL format',
        },
      ];

      const validRecords = [
        { website: 'https://example.com' },
        { website: 'http://example.com/path?query=value' },
      ];
      const invalidRecords = [
        { website: 'invalid' },
        { website: 'ftp://example.com' },
      ];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe('RANGE rule', () => {
    it('should validate number within range', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'price',
          type: ValidationRuleType.RANGE,
          min: 0,
          max: 1000,
          message: 'Price must be between 0 and 1000',
        },
      ];

      const validRecords = [{ price: 0 }, { price: 500 }, { price: 1000 }];
      const invalidRecords = [{ price: -1 }, { price: 1001 }];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(2);
    });

    it('should validate exclusive range', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'score',
          type: ValidationRuleType.RANGE,
          min: 0,
          max: 100,
          minInclusive: false,
          maxInclusive: false,
          message: 'Score must be between 0 and 100 (exclusive)',
        },
      ];

      const validRecords = [{ score: 1 }, { score: 50 }, { score: 99 }];
      const invalidRecords = [{ score: 0 }, { score: 100 }];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe('LENGTH rule', () => {
    it('should validate string length', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'name',
          type: ValidationRuleType.LENGTH,
          minLength: 3,
          maxLength: 50,
          message: 'Name must be between 3 and 50 characters',
        },
      ];

      const validRecords = [
        { name: 'abc' },
        { name: 'Product Name' },
        { name: 'A'.repeat(50) },
      ];
      const invalidRecords = [{ name: 'ab' }, { name: 'A'.repeat(51) }];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(2);
    });
  });

  describe('UNIQUE rule', () => {
    it('should detect duplicate values in batch', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'email',
          type: ValidationRuleType.UNIQUE,
          message: 'Email must be unique',
        },
      ];

      const records = [
        { email: 'user1@example.com' },
        { email: 'user2@example.com' },
        { email: 'user1@example.com' }, // Duplicate
      ];

      const result = await service.validateBatch(records, rules);

      expect(result.valid).toBe(false);
      expect(result.invalidRecords).toBe(1);
      expect(result.errors[0].row).toBe(3);
      expect(result.errors[0].field).toBe('email');
    });

    it('should be case-insensitive when specified', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'email',
          type: ValidationRuleType.UNIQUE,
          caseInsensitive: true,
          message: 'Email must be unique',
        },
      ];

      const records = [
        { email: 'user@example.com' },
        { email: 'USER@EXAMPLE.COM' }, // Duplicate (case-insensitive)
      ];

      const result = await service.validateBatch(records, rules);

      expect(result.valid).toBe(false);
      expect(result.errors[0].row).toBe(2);
    });
  });

  describe('ENUM rule', () => {
    it('should validate enum values', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'status',
          type: ValidationRuleType.ENUM,
          allowedValues: ['ACTIVE', 'INACTIVE', 'PENDING'],
          message: 'Invalid status',
        },
      ];

      const validRecords = [
        { status: 'ACTIVE' },
        { status: 'INACTIVE' },
        { status: 'PENDING' },
      ];
      const invalidRecords = [{ status: 'INVALID' }, { status: 'active' }];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(2);
    });

    it('should support case-insensitive enum validation', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'status',
          type: ValidationRuleType.ENUM,
          allowedValues: ['ACTIVE', 'INACTIVE'],
          caseInsensitive: true,
          message: 'Invalid status',
        },
      ];

      const records = [
        { status: 'active' },
        { status: 'INACTIVE' },
        { status: 'InAcTiVe' },
      ];

      const result = await service.validateBatch(records, rules);

      expect(result.valid).toBe(true);
      expect(result.validRecords).toBe(3);
    });
  });

  describe('PATTERN rule', () => {
    it('should validate regex pattern', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'slug',
          type: ValidationRuleType.PATTERN,
          pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
          message: 'Invalid slug format',
        },
      ];

      const validRecords = [
        { slug: 'product-name' },
        { slug: 'my-product-123' },
        { slug: 'simple' },
      ];
      const invalidRecords = [
        { slug: 'Product Name' }, // Spaces
        { slug: 'product_name' }, // Underscore
        { slug: '-start-dash' }, // Starts with dash
      ];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(3);
    });
  });

  describe('CUSTOM rule', () => {
    it('should execute custom validation function', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'price',
          type: ValidationRuleType.CUSTOM,
          validator: (value: any) => {
            const price = Number(value);
            return price > 0 && price <= 10000;
          },
          message: 'Price must be between 1 and 10000',
        },
      ];

      const validRecords = [{ price: 100 }, { price: 5000 }];
      const invalidRecords = [{ price: 0 }, { price: 10001 }];

      const validResult = await service.validateBatch(validRecords, rules);
      expect(validResult.valid).toBe(true);

      const invalidResult = await service.validateBatch(invalidRecords, rules);
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe('Batch validation options', () => {
    it('should skip invalid records when skipInvalid is true', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'price',
          type: ValidationRuleType.REQUIRED,
          message: 'Price is required',
        },
      ];

      const records = [{ price: 100 }, {}, { price: 200 }]; // Middle record is invalid

      const options: ValidationOptions = { skipInvalid: true };

      const result = await service.validateBatch(records, rules, options);

      expect(result.validRecords).toBe(2);
      expect(result.invalidRecords).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should stop on first error when stopOnFirstError is true', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'name',
          type: ValidationRuleType.REQUIRED,
          message: 'Name is required',
        },
      ];

      const records = [{}, {}, {}]; // All invalid

      const options: ValidationOptions = { stopOnFirstError: true };

      const result = await service.validateBatch(records, rules, options);

      expect(result.errors).toHaveLength(1);
    });

    it('should respect maxErrors limit', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'name',
          type: ValidationRuleType.REQUIRED,
          message: 'Name is required',
        },
      ];

      const records = [{}, {}, {}, {}, {}]; // 5 invalid records

      const options: ValidationOptions = { maxErrors: 2 };

      const result = await service.validateBatch(records, rules, options);

      expect(result.errors.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Error summary', () => {
    it('should generate error summary by type', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'name',
          type: ValidationRuleType.REQUIRED,
          message: 'Name is required',
        },
        {
          field: 'price',
          type: ValidationRuleType.TYPE,
          dataType: DataType.NUMBER,
          message: 'Price must be a number',
        },
      ];

      const records = [{}, { name: 'Product', price: 'invalid' }];

      const result = await service.validateBatch(records, rules);

      expect(result.errorsByType).toHaveProperty('REQUIRED');
      expect(result.errorsByType).toHaveProperty('TYPE');
    });

    it('should generate error summary by field', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'name',
          type: ValidationRuleType.REQUIRED,
          message: 'Name is required',
        },
        {
          field: 'name',
          type: ValidationRuleType.LENGTH,
          minLength: 3,
          message: 'Name too short',
        },
      ];

      const records = [{ name: 'ab' }]; // Fails length check

      const result = await service.validateBatch(records, rules);

      expect(result.errorsByField).toHaveProperty('name');
    });

    it('should generate error summary by severity', async () => {
      const rules: ValidationRule[] = [
        {
          field: 'name',
          type: ValidationRuleType.REQUIRED,
          severity: ErrorSeverity.ERROR,
          message: 'Name is required',
        },
        {
          field: 'description',
          type: ValidationRuleType.REQUIRED,
          severity: ErrorSeverity.WARNING,
          message: 'Description recommended',
        },
      ];

      const records = [{}];

      const result = await service.validateBatch(records, rules);

      expect(result.errorsBySeverity).toHaveProperty('ERROR');
      expect(result.errorsBySeverity).toHaveProperty('WARNING');
    });
  });
});
