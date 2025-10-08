import { validate } from 'class-validator';
import {
  IsStrongPassword,
  IsStrongPasswordConstraint,
} from '../../../src/common/validators/is-strong-password.validator';

// Test DTO
class TestPasswordDto {
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;

  username?: string;
  email?: string;
}

describe('IsStrongPassword Validator', () => {
  let validator: IsStrongPasswordConstraint;

  beforeEach(() => {
    validator = new IsStrongPasswordConstraint();
  });

  describe('Valid Passwords', () => {
    it('should accept a strong password with all requirements', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'SecurePass123!';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept password with minimum requirements', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'Abcd1234!';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept password with multiple special characters', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'MyP@ssw0rd!#$';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept long secure password', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'ThisIsAVeryLongAndSecurePassword123!@#';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept password with various special characters', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'P@$$w0rd!';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept password with underscores and hyphens', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'Secure_Pass-123!';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Invalid Passwords - Length Requirements', () => {
    it('should reject password shorter than minimum length', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'Pass1!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isStrongPassword).toContain(
        'at least 8 characters',
      );
    });

    it('should reject empty password', async () => {
      const dto = new TestPasswordDto();
      dto.password = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Passwords - Character Requirements', () => {
    it('should reject password without uppercase letter', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'password123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isStrongPassword).toContain('uppercase');
    });

    it('should reject password without lowercase letter', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'PASSWORD123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isStrongPassword).toContain('lowercase');
    });

    it('should reject password without number', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'SecurePass!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isStrongPassword).toContain('number');
    });

    it('should reject password without special character', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'SecurePass123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isStrongPassword).toContain(
        'special character',
      );
    });

    it('should reject password with only lowercase', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'abcdefghijk';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject password with only uppercase', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'ABCDEFGHIJK';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject password with only numbers', async () => {
      const dto = new TestPasswordDto();
      dto.password = '12345678901';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Passwords - Common Weak Passwords', () => {
    it('should reject "password"', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'Password123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject "password123"', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'Password123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject "12345678"', async () => {
      const dto = new TestPasswordDto();
      dto.password = '12345678';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject "qwerty"', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'Qwerty123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject "admin"', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'Admin123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject "letmein"', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'Letmein123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Passwords - Username/Email in Password', () => {
    it('should reject password containing username', async () => {
      const dto = new TestPasswordDto();
      dto.username = 'johndoe';
      dto.password = 'Johndoe123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isStrongPassword).toContain('username');
    });

    it('should reject password containing email username', async () => {
      const dto = new TestPasswordDto();
      dto.email = 'john.doe@example.com';
      dto.password = 'John.doe123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isStrongPassword).toContain('email');
    });

    it('should reject password with username variation', async () => {
      const dto = new TestPasswordDto();
      dto.username = 'alice';
      dto.password = 'Alice_Password123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Space Handling', () => {
    it('should reject password with spaces by default', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'Secure Pass 123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Options', () => {
    class CustomPasswordDto {
      @IsStrongPassword({
        minLength: 12,
        minLowercase: 2,
        minUppercase: 2,
        minNumbers: 2,
        minSymbols: 2,
        allowSpaces: true,
      })
      password: string;
    }

    it('should enforce custom minimum length', async () => {
      const dto = new CustomPasswordDto();
      dto.password = 'Pass123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isStrongPassword).toContain('12 characters');
    });

    it('should enforce custom character counts', async () => {
      const dto = new CustomPasswordDto();
      dto.password = 'Passw0rd1!@#$%';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow spaces when configured', async () => {
      const dto = new CustomPasswordDto();
      dto.password = 'My SecurePass 123!@';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject if not enough uppercase letters', async () => {
      const dto = new CustomPasswordDto();
      dto.password = 'password123!!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isStrongPassword).toContain(
        '2 uppercase letter',
      );
    });

    it('should reject if not enough symbols', async () => {
      const dto = new CustomPasswordDto();
      dto.password = 'SecurePassword123';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isStrongPassword).toContain(
        '2 special character',
      );
    });
  });

  describe('Edge Cases', () => {
    it('should reject null password', async () => {
      const dto = new TestPasswordDto();
      dto.password = null as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject undefined password', async () => {
      const dto = new TestPasswordDto();
      dto.password = undefined as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string password', async () => {
      const dto = new TestPasswordDto();
      dto.password = 12345678 as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject password with only whitespace', async () => {
      const dto = new TestPasswordDto();
      dto.password = '        ';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Constraint Direct Validation', () => {
    it('should return false for invalid input', () => {
      const result = validator.validate('weak', {
        constraints: [
          {
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1,
          },
        ],
        object: {},
        property: 'password',
        targetName: 'TestDto',
        value: 'weak',
      });

      expect(result).toBe(false);
    });

    it('should return true for valid input', () => {
      const result = validator.validate('ValidPass123!', {
        constraints: [
          {
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1,
          },
        ],
        object: {},
        property: 'password',
        targetName: 'TestDto',
        value: 'ValidPass123!',
      });

      expect(result).toBe(true);
    });

    it('should generate appropriate default message', () => {
      const message = validator.defaultMessage({
        constraints: [
          {
            minLength: 10,
            minLowercase: 2,
            minUppercase: 2,
            minNumbers: 2,
            minSymbols: 2,
          },
        ],
        object: {},
        property: 'password',
        targetName: 'TestDto',
        value: 'weak',
      });

      expect(message).toContain('10 characters');
      expect(message).toContain('2 lowercase');
      expect(message).toContain('2 uppercase');
      expect(message).toContain('2 number');
      expect(message).toContain('2 special character');
    });
  });

  describe('Security - SQL Injection Attempts', () => {
    it('should handle SQL injection patterns safely', async () => {
      const dto = new TestPasswordDto();
      dto.password = "'; DROP TABLE users; --";

      const errors = await validate(dto);
      // Should fail validation but not cause security issues
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle SQL injection with quotes', async () => {
      const dto = new TestPasswordDto();
      dto.password = "admin'--";

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Security - XSS Attempts', () => {
    it('should handle XSS script tags', async () => {
      const dto = new TestPasswordDto();
      dto.password = '<script>alert("xss")</script>';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle XSS event handlers', async () => {
      const dto = new TestPasswordDto();
      dto.password = 'Pass<img src=x onerror=alert(1)>123!';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
