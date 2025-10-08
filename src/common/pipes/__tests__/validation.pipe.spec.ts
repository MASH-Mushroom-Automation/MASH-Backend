/**
 * Validation Pipe Tests
 * Tests DTO validation and transformation
 */

import { CustomValidationPipe } from '../validation.pipe';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

// Mock class-validator
jest.mock('class-validator', () => ({
  validate: jest.fn(),
}));

describe('CustomValidationPipe', () => {
  let pipe: CustomValidationPipe;

  beforeEach(() => {
    pipe = new CustomValidationPipe();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  describe('transform', () => {
    it('should pass validation for valid DTO', async () => {
      const mockValidate = validate as jest.MockedFunction<typeof validate>;
      mockValidate.mockResolvedValue([]);

      class TestDto {
        name: string;
        age: number;
      }

      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: TestDto,
      };

      const value = { name: 'John', age: 30 };

      const result = await pipe.transform(value, metadata);

      expect(result).toBeDefined();
      expect(mockValidate).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid DTO', async () => {
      const mockValidate = validate as jest.MockedFunction<typeof validate>;
      mockValidate.mockResolvedValue([
        {
          property: 'name',
          constraints: {
            isNotEmpty: 'name should not be empty',
          },
        } as any,
      ]);

      class TestDto {
        name: string;
      }

      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: TestDto,
      };

      const value = { name: '' };

      await expect(pipe.transform(value, metadata)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should skip validation for primitive types', async () => {
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: String,
      };

      const value = 'test-string';

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(value);
      expect(validate).not.toHaveBeenCalled();
    });

    it('should skip validation for undefined metatype', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: undefined,
      };

      const value = { test: 'data' };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(value);
      expect(validate).not.toHaveBeenCalled();
    });

    it('should handle multiple validation errors', async () => {
      const mockValidate = validate as jest.MockedFunction<typeof validate>;
      mockValidate.mockResolvedValue([
        {
          property: 'email',
          constraints: {
            isEmail: 'email must be an email',
          },
        } as any,
        {
          property: 'age',
          constraints: {
            isNumber: 'age must be a number',
            min: 'age must be at least 18',
          },
        } as any,
      ]);

      class TestDto {
        email: string;
        age: number;
      }

      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: TestDto,
      };

      const value = { email: 'invalid', age: 10 };

      await expect(pipe.transform(value, metadata)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
