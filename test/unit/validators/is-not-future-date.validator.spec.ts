import { validate } from 'class-validator';
import {
  IsNotFutureDate,
  IsNotFutureDateConstraint,
} from '../../../src/common/validators/is-not-future-date.validator';

// Test DTO
class TestTimestampDto {
  @IsNotFutureDate({ gracePeriodMs: 300000 }) // 5 minutes
  timestamp!: string;
}

describe('IsNotFutureDate Validator', () => {
  let validator: IsNotFutureDateConstraint;

  beforeEach(() => {
    validator = new IsNotFutureDateConstraint();
  });

  describe('Valid Timestamps - Past Dates', () => {
    it('should accept timestamp from 1 hour ago', async () => {
      const dto = new TestTimestampDto();
      const oneHourAgo = new Date(Date.now() - 3600000);
      dto.timestamp = oneHourAgo.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept timestamp from 1 day ago', async () => {
      const dto = new TestTimestampDto();
      const oneDayAgo = new Date(Date.now() - 86400000);
      dto.timestamp = oneDayAgo.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept timestamp from 1 year ago', async () => {
      const dto = new TestTimestampDto();
      const oneYearAgo = new Date(Date.now() - 31536000000);
      dto.timestamp = oneYearAgo.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept very old timestamp', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = '2020-01-01T00:00:00.000Z';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept timestamp from 1 minute ago', async () => {
      const dto = new TestTimestampDto();
      const oneMinuteAgo = new Date(Date.now() - 60000);
      dto.timestamp = oneMinuteAgo.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept timestamp from 10 seconds ago', async () => {
      const dto = new TestTimestampDto();
      const tenSecondsAgo = new Date(Date.now() - 10000);
      dto.timestamp = tenSecondsAgo.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Timestamps - Current Time', () => {
    it('should accept current timestamp', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = new Date().toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept timestamp from 1 second ago', async () => {
      const dto = new TestTimestampDto();
      const oneSecondAgo = new Date(Date.now() - 1000);
      dto.timestamp = oneSecondAgo.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Timestamps - Within Grace Period', () => {
    it('should accept timestamp 1 minute in future (within grace period)', async () => {
      const dto = new TestTimestampDto();
      const oneMinuteFuture = new Date(Date.now() + 60000);
      dto.timestamp = oneMinuteFuture.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept timestamp 4 minutes in future (within grace period)', async () => {
      const dto = new TestTimestampDto();
      const fourMinutesFuture = new Date(Date.now() + 240000);
      dto.timestamp = fourMinutesFuture.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept timestamp exactly at grace period boundary', async () => {
      const dto = new TestTimestampDto();
      const fiveMinutesFuture = new Date(Date.now() + 300000);
      dto.timestamp = fiveMinutesFuture.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Invalid Timestamps - Beyond Grace Period', () => {
    it('should reject timestamp 6 minutes in future', async () => {
      const dto = new TestTimestampDto();
      const sixMinutesFuture = new Date(Date.now() + 360000);
      dto.timestamp = sixMinutesFuture.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isNotFutureDate).toContain('future');
    });

    it('should reject timestamp 1 hour in future', async () => {
      const dto = new TestTimestampDto();
      const oneHourFuture = new Date(Date.now() + 3600000);
      dto.timestamp = oneHourFuture.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject timestamp 1 day in future', async () => {
      const dto = new TestTimestampDto();
      const oneDayFuture = new Date(Date.now() + 86400000);
      dto.timestamp = oneDayFuture.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject timestamp far in future', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = '2030-12-31T23:59:59.999Z';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Timestamps - Format Issues', () => {
    it('should reject invalid ISO 8601 format', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = '2024-10-09 14:30:00'; // Missing T separator

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject date without time', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = '2024-10-09';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid date string', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = 'not a date';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject malformed ISO string', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = '2024-13-45T99:99:99.999Z'; // Invalid month/day/time

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty string', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ISO 8601 Format Variations', () => {
    it('should accept ISO string with milliseconds', async () => {
      const dto = new TestTimestampDto();
      const past = new Date(Date.now() - 3600000);
      dto.timestamp = past.toISOString(); // Includes .000Z

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept ISO string without milliseconds', async () => {
      const dto = new TestTimestampDto();
      const past = new Date(Date.now() - 3600000);
      dto.timestamp = past.toISOString().replace(/\.\d{3}Z$/, 'Z');

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept ISO string without Z suffix', async () => {
      const dto = new TestTimestampDto();
      const past = new Date(Date.now() - 3600000);
      dto.timestamp = past.toISOString().replace('Z', '');

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should reject null timestamp', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = null as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject undefined timestamp', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = undefined as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string, non-Date timestamp', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = 1234567890 as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject object as timestamp', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = { date: '2024-10-09' } as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept Date object from past', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = new Date(Date.now() - 3600000) as any;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject Date object from future', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = new Date(Date.now() + 3600000) as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Grace Period Options', () => {
    class CustomGracePeriodDto {
      @IsNotFutureDate({ gracePeriodMs: 60000 }) // 1 minute
      timestamp!: string;
    }

    it('should accept timestamp within 1 minute grace period', async () => {
      const dto = new CustomGracePeriodDto();
      const thirtySecondsFuture = new Date(Date.now() + 30000);
      dto.timestamp = thirtySecondsFuture.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject timestamp beyond 1 minute grace period', async () => {
      const dto = new CustomGracePeriodDto();
      const twoMinutesFuture = new Date(Date.now() + 120000);
      dto.timestamp = twoMinutesFuture.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('No Grace Period', () => {
    class NoGracePeriodDto {
      @IsNotFutureDate({ gracePeriodMs: 0 })
      timestamp!: string;
    }

    it('should accept past timestamp with no grace period', async () => {
      const dto = new NoGracePeriodDto();
      const oneSecondAgo = new Date(Date.now() - 1000);
      dto.timestamp = oneSecondAgo.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject future timestamp with no grace period', async () => {
      const dto = new NoGracePeriodDto();
      const oneSecondFuture = new Date(Date.now() + 1000);
      dto.timestamp = oneSecondFuture.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Constraint Direct Validation', () => {
    it('should return false for future date', () => {
      const future = new Date(Date.now() + 3600000).toISOString();
      const result = validator.validate(future, {
        constraints: [{ gracePeriodMs: 300000 }],
        object: {},
        property: 'timestamp',
        targetName: 'TestDto',
        value: future,
      });

      expect(result).toBe(false);
    });

    it('should return true for past date', () => {
      const past = new Date(Date.now() - 3600000).toISOString();
      const result = validator.validate(past, {
        constraints: [{ gracePeriodMs: 300000 }],
        object: {},
        property: 'timestamp',
        targetName: 'TestDto',
        value: past,
      });

      expect(result).toBe(true);
    });

    it('should return true for date within grace period', () => {
      const withinGrace = new Date(Date.now() + 60000).toISOString();
      const result = validator.validate(withinGrace, {
        constraints: [{ gracePeriodMs: 300000 }],
        object: {},
        property: 'timestamp',
        targetName: 'TestDto',
        value: withinGrace,
      });

      expect(result).toBe(true);
    });

    it('should generate appropriate default message', () => {
      const message = validator.defaultMessage({
        constraints: [{ gracePeriodMs: 300000 }],
        object: {},
        property: 'timestamp',
        targetName: 'TestDto',
        value: 'future',
      });

      expect(message).toContain('future');
      expect(message).toContain('5 minutes');
      expect(message).toContain('grace period');
    });

    it('should generate message with different grace period', () => {
      const message = validator.defaultMessage({
        constraints: [{ gracePeriodMs: 60000 }],
        object: {},
        property: 'timestamp',
        targetName: 'TestDto',
        value: 'future',
      });

      expect(message).toContain('1 minute');
    });
  });

  describe('Security - SQL Injection Attempts', () => {
    it('should handle SQL injection patterns safely', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = "'; DROP TABLE sensors; --";

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle SQL injection with quotes', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = "2024' OR '1'='1";

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Security - XSS Attempts', () => {
    it('should handle XSS script tags', async () => {
      const dto = new TestTimestampDto();
      dto.timestamp = '<script>alert("xss")</script>';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should accept sensor data timestamp from 5 seconds ago', async () => {
      const dto = new TestTimestampDto();
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      dto.timestamp = fiveSecondsAgo.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept log entry from 10 minutes ago', async () => {
      const dto = new TestTimestampDto();
      const tenMinutesAgo = new Date(Date.now() - 600000);
      dto.timestamp = tenMinutesAgo.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject timestamp from client with incorrect clock (1 hour ahead)', async () => {
      const dto = new TestTimestampDto();
      const oneHourFuture = new Date(Date.now() + 3600000);
      dto.timestamp = oneHourFuture.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept timestamp with minor clock skew (2 minutes ahead)', async () => {
      const dto = new TestTimestampDto();
      const twoMinutesFuture = new Date(Date.now() + 120000);
      dto.timestamp = twoMinutesFuture.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Clock Skew Scenarios', () => {
    it('should handle server slightly ahead of client', async () => {
      const dto = new TestTimestampDto();
      // Client time is 3 minutes behind server
      const threeMinutesBehind = new Date(Date.now() - 180000);
      dto.timestamp = threeMinutesBehind.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should handle client slightly ahead of server (within grace)', async () => {
      const dto = new TestTimestampDto();
      // Client time is 4 minutes ahead of server (within 5 min grace)
      const fourMinutesAhead = new Date(Date.now() + 240000);
      dto.timestamp = fourMinutesAhead.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject significant clock skew (20 minutes ahead)', async () => {
      const dto = new TestTimestampDto();
      const twentyMinutesAhead = new Date(Date.now() + 1200000);
      dto.timestamp = twentyMinutesAhead.toISOString();

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
