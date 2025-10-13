import { validate } from 'class-validator';
import {
  IsValidPhone,
  IsValidPhoneConstraint,
} from '../../../src/common/validators/is-valid-phone.validator';

// Test DTO
class TestPhoneDto {
  @IsValidPhone()
  phoneNumber!: string;
}

describe('IsValidPhone Validator', () => {
  let validator: IsValidPhoneConstraint;

  beforeEach(() => {
    validator = new IsValidPhoneConstraint();
  });

  describe('Valid Phone Numbers - Local Format', () => {
    it('should accept valid Globe mobile number (0917)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '09171234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept valid Smart mobile number (0918)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '09181234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept valid Sun mobile number (0922)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '09221234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept valid DITO mobile number (0895)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '09051234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept valid TNT mobile number (0907)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '09071234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept valid TM mobile number (0915)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '09151234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept phone number starting with 0999', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '09991234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Phone Numbers - International Format', () => {
    it('should accept valid phone with +63 prefix (Globe)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '+639171234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept valid phone with +63 prefix (Smart)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '+639181234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept valid phone with +63 prefix (Sun)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '+639221234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept phone with +63 prefix (DITO)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '+639051234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Phone Numbers - With Formatting', () => {
    it('should accept phone with spaces (local)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '0917 123 4567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept phone with dashes (local)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '0917-123-4567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept phone with parentheses', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '(0917) 123-4567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept phone with mixed formatting', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '(+63) 917 123-4567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept international with spaces', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '+63 917 123 4567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Invalid Phone Numbers - Wrong Length', () => {
    it('should reject phone number too short', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '091712345';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isValidPhone).toContain('Philippine');
    });

    it('should reject phone number too long', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '091712345678';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject international format too short', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '+6391712345';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject international format too long', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '+63917123456789';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Phone Numbers - Wrong Prefix', () => {
    it('should reject phone starting with 08', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '08171234567';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid prefix 0900', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '09001234567';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject landline format 02', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '0212345678';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid prefix 0800 (toll-free)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '08001234567';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject international with wrong country code', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '+19171234567'; // US format

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Phone Numbers - Format Issues', () => {
    it('should reject phone without 0 prefix', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '9171234567';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject phone with letters', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '0917ABC4567';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject phone with special characters (except allowed)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '0917@123#4567';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty string', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should reject null phone number', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = null as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject undefined phone number', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = undefined as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string phone number', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = 9171234567 as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject phone with only spaces', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '           ';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject phone with only dashes', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '-----------';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Boundary Testing - All Valid Prefixes', () => {
    it('should accept 0905 (start of range)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '09051234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept 0999 (end of range)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '09991234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept 0813 prefix', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '08131234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept 0945 prefix (mid-range)', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '09451234567';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Constraint Direct Validation', () => {
    it('should return false for invalid phone', () => {
      const result = validator.validate('1234567890', {
        constraints: [],
        object: {},
        property: 'phoneNumber',
        targetName: 'TestDto',
        value: '1234567890',
      });

      expect(result).toBe(false);
    });

    it('should return true for valid phone', () => {
      const result = validator.validate('09171234567', {
        constraints: [],
        object: {},
        property: 'phoneNumber',
        targetName: 'TestDto',
        value: '09171234567',
      });

      expect(result).toBe(true);
    });

    it('should generate appropriate default message', () => {
      const message = validator.defaultMessage({
        constraints: [],
        object: {},
        property: 'phoneNumber',
        targetName: 'TestDto',
        value: 'invalid',
      });

      expect(message).toContain('Philippine mobile number');
      expect(message).toContain('09XXXXXXXXX');
      expect(message).toContain('+639XXXXXXXXX');
    });
  });

  describe('Security - SQL Injection Attempts', () => {
    it('should handle SQL injection patterns safely', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = "'; DROP TABLE users; --";

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle SQL injection with quotes', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = "0917' OR '1'='1";

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Security - XSS Attempts', () => {
    it('should handle XSS script tags', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '<script>alert("xss")</script>';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle XSS event handlers', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '0917<img src=x onerror=alert(1)>';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should accept phone from user input with formatting', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '(0917) 123-4567'; // Common user input format

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept phone copied from contact list', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '+63 917 123 4567'; // Contact list format

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject phone from wrong country', async () => {
      const dto = new TestPhoneDto();
      dto.phoneNumber = '+1 (555) 123-4567'; // US phone

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
