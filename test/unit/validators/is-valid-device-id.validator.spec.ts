import { validate } from 'class-validator';
import {
  IsValidDeviceId,
  IsValidDeviceIdConstraint,
} from '../../../src/common/validators/is-valid-device-id.validator';

// Test DTO
class TestDeviceDto {
  @IsValidDeviceId()
  deviceId!: string;
}

describe('IsValidDeviceId Validator', () => {
  let validator: IsValidDeviceIdConstraint;

  beforeEach(() => {
    validator = new IsValidDeviceIdConstraint();
  });

  describe('Valid Device IDs - UUID v4 Format', () => {
    it('should accept valid UUID v4', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '550e8400-e29b-41d4-a716-446655440000';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept UUID v4 with lowercase', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'a3bb189e-8bf9-4f0e-9b9c-123456789abc';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept UUID v4 with uppercase', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'A3BB189E-8BF9-4F0E-9B9C-123456789ABC';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept UUID v4 with mixed case', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'F47ac10b-58cc-4372-A567-0e02b2c3d479';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept UUID v4 with valid version indicator (4)', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '12345678-1234-4234-8234-567890123456';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept UUID v4 with valid variant (8)', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '12345678-1234-4234-8234-567890123456';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept UUID v4 with valid variant (9)', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '12345678-1234-4234-9234-567890123456';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept UUID v4 with valid variant (a)', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '12345678-1234-4234-a234-567890123456';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept UUID v4 with valid variant (b)', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '12345678-1234-4234-b234-567890123456';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Device IDs - MAC Address Format', () => {
    it('should accept MAC address with colons', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '00:1B:44:11:3A:B7';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept MAC address with dashes', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '00-1B-44-11-3A-B7';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept MAC address with lowercase', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '00:1b:44:11:3a:b7';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept MAC address with uppercase', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'FF:FF:FF:FF:FF:FF';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept MAC address with mixed case', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'Aa:Bb:Cc:Dd:Ee:Ff';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept MAC address with zeros', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '00:00:00:00:00:00';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Device IDs - MASH Custom Format', () => {
    it('should accept MASH format with 5 chars', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'MASH-DEV-ABCDE';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept MASH format with 10 chars (max)', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'MASH-DEV-ABCDE12345';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept MASH format with lowercase', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'mash-dev-abc123';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept MASH format with numbers only', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'MASH-DEV-12345';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept MASH format with letters only', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'MASH-DEV-ABCDE';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept MASH format with mixed alphanumeric', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'MASH-DEV-A1B2C3';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Invalid Device IDs - UUID Issues', () => {
    it('should reject UUID v1', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '550e8400-e29b-11d4-a716-446655440000'; // version 1

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject UUID v3', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '550e8400-e29b-31d4-a716-446655440000'; // version 3

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject UUID without dashes', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '550e8400e29b41d4a716446655440000';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject UUID with wrong length', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '550e8400-e29b-41d4-a716-44665544';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject UUID with invalid characters', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '550e8400-e29b-41d4-g716-446655440000';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject UUID with invalid variant', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '12345678-1234-4234-1234-567890123456'; // variant should be 8,9,a,b

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Device IDs - MAC Address Issues', () => {
    it('should reject MAC address too short', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '00:1B:44:11:3A';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject MAC address too long', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '00:1B:44:11:3A:B7:FF';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject MAC address with dots', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '00.1B.44.11.3A.B7';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject MAC address with mixed separators', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '00:1B-44:11-3A:B7';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject MAC address with invalid hex', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'GG:1B:44:11:3A:B7';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject MAC address without separators', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '001B44113AB7';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Device IDs - MASH Format Issues', () => {
    it('should reject MASH format too short', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'MASH-DEV-ABC';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject MASH format too long', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'MASH-DEV-ABCDE1234567890';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject MASH format without prefix', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'DEV-ABCDE';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject MASH format with special characters', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'MASH-DEV-ABC@#';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject MASH format with spaces', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'MASH-DEV-ABC DE';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject wrong prefix', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'DEVICE-DEV-ABCDE';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should reject null device ID', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = null as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject undefined device ID', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = undefined as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string device ID', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 12345 as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty string', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject whitespace only', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '   ';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Constraint Direct Validation', () => {
    it('should return false for invalid device ID', () => {
      const result = validator.validate('invalid-id', {
        constraints: [],
        object: {},
        property: 'deviceId',
        targetName: 'TestDto',
        value: 'invalid-id',
      });

      expect(result).toBe(false);
    });

    it('should return true for valid UUID', () => {
      const result = validator.validate('550e8400-e29b-41d4-a716-446655440000', {
        constraints: [],
        object: {},
        property: 'deviceId',
        targetName: 'TestDto',
        value: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result).toBe(true);
    });

    it('should return true for valid MAC address', () => {
      const result = validator.validate('00:1B:44:11:3A:B7', {
        constraints: [],
        object: {},
        property: 'deviceId',
        targetName: 'TestDto',
        value: '00:1B:44:11:3A:B7',
      });

      expect(result).toBe(true);
    });

    it('should return true for valid MASH format', () => {
      const result = validator.validate('MASH-DEV-ABC123', {
        constraints: [],
        object: {},
        property: 'deviceId',
        targetName: 'TestDto',
        value: 'MASH-DEV-ABC123',
      });

      expect(result).toBe(true);
    });

    it('should generate appropriate default message', () => {
      const message = validator.defaultMessage({
        constraints: [],
        object: {},
        property: 'deviceId',
        targetName: 'TestDto',
        value: 'invalid',
      });

      expect(message).toContain('UUID v4');
      expect(message).toContain('MAC address');
      expect(message).toContain('MASH');
    });
  });

  describe('Security - SQL Injection Attempts', () => {
    it('should handle SQL injection patterns safely', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = "'; DROP TABLE devices; --";

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle SQL injection with quotes', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = "device' OR '1'='1";

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Security - XSS Attempts', () => {
    it('should handle XSS script tags', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = '<script>alert("xss")</script>';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should accept device ID from IoT sensor (UUID)', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'a3bb189e-8bf9-4f0e-9b9c-123456789abc';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept network device MAC address', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'E8:40:F2:3A:6E:C5';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept custom MASH mushroom sensor', async () => {
      const dto = new TestDeviceDto();
      dto.deviceId = 'MASH-DEV-TEMP01';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
