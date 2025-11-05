import { validate } from 'class-validator';
import {
  IsValidOrderStatus,
  IsValidOrderStatusConstraint,
  OrderStatus,
} from '../../../src/common/validators/is-valid-order-status.validator';

// Test DTO
class TestOrderStatusDto {
  @IsValidOrderStatus()
  status!: OrderStatus;

  currentStatus?: OrderStatus;
}

describe('IsValidOrderStatus Validator', () => {
  let validator: IsValidOrderStatusConstraint;

  beforeEach(() => {
    validator = new IsValidOrderStatusConstraint();
  });

  describe('Valid Status Values - New Orders', () => {
    it('should accept PENDING for new order', async () => {
      const dto = new TestOrderStatusDto();
      dto.status = OrderStatus.PENDING;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept CONFIRMED for new order', async () => {
      const dto = new TestOrderStatusDto();
      dto.status = OrderStatus.CONFIRMED;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept any valid status when no current status', async () => {
      const dto = new TestOrderStatusDto();
      dto.status = OrderStatus.PROCESSING;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Status Transitions - PENDING', () => {
    it('should allow PENDING -> CONFIRMED', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.PENDING;
      dto.status = OrderStatus.CONFIRMED;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow PENDING -> CANCELLED', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.PENDING;
      dto.status = OrderStatus.CANCELLED;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Status Transitions - CONFIRMED', () => {
    it('should allow CONFIRMED -> PROCESSING', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.CONFIRMED;
      dto.status = OrderStatus.PROCESSING;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow CONFIRMED -> CANCELLED', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.CONFIRMED;
      dto.status = OrderStatus.CANCELLED;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Status Transitions - PROCESSING', () => {
    it('should allow PROCESSING -> SHIPPED', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.PROCESSING;
      dto.status = OrderStatus.SHIPPED;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow PROCESSING -> CANCELLED', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.PROCESSING;
      dto.status = OrderStatus.CANCELLED;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Status Transitions - SHIPPED', () => {
    it('should allow SHIPPED -> DELIVERED', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.SHIPPED;
      dto.status = OrderStatus.DELIVERED;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow SHIPPED -> CANCELLED (return during shipping)', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.SHIPPED;
      dto.status = OrderStatus.CANCELLED;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Valid Status Transitions - DELIVERED', () => {
    it('should allow DELIVERED -> REFUNDED', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.DELIVERED;
      dto.status = OrderStatus.REFUNDED;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Invalid Status Transitions - PENDING', () => {
    it('should reject PENDING -> PROCESSING (must confirm first)', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.PENDING;
      dto.status = OrderStatus.PROCESSING;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isValidOrderStatus).toContain('PENDING');
    });

    it('should reject PENDING -> SHIPPED', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.PENDING;
      dto.status = OrderStatus.SHIPPED;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject PENDING -> DELIVERED', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.PENDING;
      dto.status = OrderStatus.DELIVERED;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject PENDING -> REFUNDED', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.PENDING;
      dto.status = OrderStatus.REFUNDED;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Status Transitions - CONFIRMED', () => {
    it('should reject CONFIRMED -> SHIPPED (must process first)', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.CONFIRMED;
      dto.status = OrderStatus.SHIPPED;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject CONFIRMED -> DELIVERED', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.CONFIRMED;
      dto.status = OrderStatus.DELIVERED;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject CONFIRMED -> REFUNDED', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.CONFIRMED;
      dto.status = OrderStatus.REFUNDED;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Status Transitions - PROCESSING', () => {
    it('should reject PROCESSING -> DELIVERED (must ship first)', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.PROCESSING;
      dto.status = OrderStatus.DELIVERED;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject PROCESSING -> REFUNDED', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.PROCESSING;
      dto.status = OrderStatus.REFUNDED;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Status Transitions - Terminal States', () => {
    it('should reject CANCELLED -> CONFIRMED (terminal state)', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.CANCELLED;
      dto.status = OrderStatus.CONFIRMED;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isValidOrderStatus).toContain('terminal state');
    });

    it('should reject CANCELLED -> PROCESSING', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.CANCELLED;
      dto.status = OrderStatus.PROCESSING;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject REFUNDED -> DELIVERED (terminal state)', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.REFUNDED;
      dto.status = OrderStatus.DELIVERED;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject REFUNDED -> PROCESSING', async () => {
      const dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.REFUNDED;
      dto.status = OrderStatus.PROCESSING;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Status Values', () => {
    it('should reject invalid status string', async () => {
      const dto = new TestOrderStatusDto();
      dto.status = 'INVALID_STATUS' as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty string', async () => {
      const dto = new TestOrderStatusDto();
      dto.status = '' as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject lowercase status', async () => {
      const dto = new TestOrderStatusDto();
      dto.status = 'pending' as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should reject null status', async () => {
      const dto = new TestOrderStatusDto();
      dto.status = null as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject undefined status', async () => {
      const dto = new TestOrderStatusDto();
      dto.status = undefined as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string status', async () => {
      const dto = new TestOrderStatusDto();
      dto.status = 123 as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject object as status', async () => {
      const dto = new TestOrderStatusDto();
      dto.status = { status: 'PENDING' } as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Constraint Direct Validation', () => {
    it('should return false for invalid status', () => {
      const result = validator.validate('INVALID', {
        constraints: [],
        object: {},
        property: 'status',
        targetName: 'TestDto',
        value: 'INVALID',
      });

      expect(result).toBe(false);
    });

    it('should return true for valid status without current status', () => {
      const result = validator.validate(OrderStatus.PENDING, {
        constraints: [],
        object: {},
        property: 'status',
        targetName: 'TestDto',
        value: OrderStatus.PENDING,
      });

      expect(result).toBe(true);
    });

    it('should return true for valid transition', () => {
      const result = validator.validate(OrderStatus.CONFIRMED, {
        constraints: [],
        object: { currentStatus: OrderStatus.PENDING },
        property: 'status',
        targetName: 'TestDto',
        value: OrderStatus.CONFIRMED,
      });

      expect(result).toBe(true);
    });

    it('should return false for invalid transition', () => {
      const result = validator.validate(OrderStatus.PROCESSING, {
        constraints: [],
        object: { currentStatus: OrderStatus.PENDING },
        property: 'status',
        targetName: 'TestDto',
        value: OrderStatus.PROCESSING,
      });

      expect(result).toBe(false);
    });

    it('should generate appropriate message for new order', () => {
      const message = validator.defaultMessage({
        constraints: [],
        object: {},
        property: 'status',
        targetName: 'TestDto',
        value: 'INVALID',
      });

      expect(message).toContain('PENDING');
      expect(message).toContain('CONFIRMED');
      expect(message).toContain('PROCESSING');
    });

    it('should generate appropriate message for terminal state', () => {
      const message = validator.defaultMessage({
        constraints: [],
        object: { currentStatus: OrderStatus.CANCELLED },
        property: 'status',
        targetName: 'TestDto',
        value: OrderStatus.CONFIRMED,
      });

      expect(message).toContain('terminal state');
      expect(message).toContain('CANCELLED');
    });

    it('should generate appropriate message for invalid transition', () => {
      const message = validator.defaultMessage({
        constraints: [],
        object: { currentStatus: OrderStatus.PENDING },
        property: 'status',
        targetName: 'TestDto',
        value: OrderStatus.SHIPPED,
      });

      expect(message).toContain('PENDING');
      expect(message).toContain('Allowed transitions');
    });
  });

  describe('Security - SQL Injection Attempts', () => {
    it('should handle SQL injection patterns safely', async () => {
      const dto = new TestOrderStatusDto();
      dto.status = "'; DROP TABLE orders; --" as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle SQL injection with quotes', async () => {
      const dto = new TestOrderStatusDto();
      dto.status = "PENDING' OR '1'='1" as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Security - XSS Attempts', () => {
    it('should handle XSS script tags', async () => {
      const dto = new TestOrderStatusDto();
      dto.status = '<script>alert("xss")</script>' as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Complete Order Flow', () => {
    it('should validate complete happy path flow', async () => {
      // PENDING -> CONFIRMED
      let dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.PENDING;
      dto.status = OrderStatus.CONFIRMED;
      let errors = await validate(dto);
      expect(errors.length).toBe(0);

      // CONFIRMED -> PROCESSING
      dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.CONFIRMED;
      dto.status = OrderStatus.PROCESSING;
      errors = await validate(dto);
      expect(errors.length).toBe(0);

      // PROCESSING -> SHIPPED
      dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.PROCESSING;
      dto.status = OrderStatus.SHIPPED;
      errors = await validate(dto);
      expect(errors.length).toBe(0);

      // SHIPPED -> DELIVERED
      dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.SHIPPED;
      dto.status = OrderStatus.DELIVERED;
      errors = await validate(dto);
      expect(errors.length).toBe(0);

      // DELIVERED -> REFUNDED
      dto = new TestOrderStatusDto();
      dto.currentStatus = OrderStatus.DELIVERED;
      dto.status = OrderStatus.REFUNDED;
      errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate cancellation at each stage', async () => {
      const stages = [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
      ];

      for (const stage of stages) {
        const dto = new TestOrderStatusDto();
        dto.currentStatus = stage;
        dto.status = OrderStatus.CANCELLED;

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });
});
