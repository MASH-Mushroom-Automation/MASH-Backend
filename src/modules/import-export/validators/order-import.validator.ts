/**
 * Order Import Validator
 *
 * Validates order data for import operations.
 * Handles order-specific business rules and constraints.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { BaseImportValidator } from './base-import.validator';
import {
  AnyValidationRule,
  ValidationRuleBuilder as Rules,
  ValidationRuleType,
  ErrorSeverity,
} from './validation.types';

@Injectable()
export class OrderImportValidator extends BaseImportValidator {
  private readonly logger = new Logger(OrderImportValidator.name);

  // Valid order statuses from Prisma schema
  private readonly ORDER_STATUSES = [
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ];

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  getEntityName(): string {
    return 'Order';
  }

  getRules(): AnyValidationRule[] {
    return [
      // Required fields
      Rules.required('orderNumber'),
      Rules.type('orderNumber', 'STRING' as any),
      Rules.unique('orderNumber', true),

      Rules.required('userId'),
      Rules.type('userId', 'STRING' as any),
      Rules.foreignKey('userId', 'User', 'id'),

      Rules.required('status'),
      {
        field: 'status',
        type: ValidationRuleType.ENUM,
        allowedValues: this.ORDER_STATUSES,
        caseSensitive: false,
        message: `Status must be one of: ${this.ORDER_STATUSES.join(', ')}`,
      },

      // Financial fields (required)
      Rules.required('subtotal'),
      Rules.type('subtotal', 'DECIMAL' as any),
      Rules.range('subtotal', 0),

      Rules.required('total'),
      Rules.type('total', 'DECIMAL' as any),
      Rules.range('total', 0),

      // Optional financial fields
      {
        field: 'tax',
        type: ValidationRuleType.TYPE,
        dataType: 'DECIMAL' as any,
        allowNull: true,
      },
      {
        field: 'tax',
        type: ValidationRuleType.RANGE,
        min: 0,
      },

      {
        field: 'shipping',
        type: ValidationRuleType.TYPE,
        dataType: 'DECIMAL' as any,
        allowNull: true,
      },
      {
        field: 'shipping',
        type: ValidationRuleType.RANGE,
        min: 0,
      },

      {
        field: 'discount',
        type: ValidationRuleType.TYPE,
        dataType: 'DECIMAL' as any,
        allowNull: true,
      },
      {
        field: 'discount',
        type: ValidationRuleType.RANGE,
        min: 0,
      },

      // Currency
      {
        field: 'currency',
        type: ValidationRuleType.TYPE,
        dataType: 'STRING' as any,
        allowNull: true,
      },
      {
        field: 'currency',
        type: ValidationRuleType.LENGTH,
        minLength: 3,
        maxLength: 3,
        message: 'Currency must be a 3-letter code (e.g., PHP, USD)',
      },

      // Required JSON fields
      Rules.required('shippingAddress'),
      Rules.type('shippingAddress', 'JSON' as any),

      Rules.required('billingAddress'),
      Rules.type('billingAddress', 'JSON' as any),

      // Optional fields
      {
        field: 'notes',
        type: ValidationRuleType.TYPE,
        dataType: 'STRING' as any,
        allowNull: true,
      },

      {
        field: 'trackingNumber',
        type: ValidationRuleType.TYPE,
        dataType: 'STRING' as any,
        allowNull: true,
      },

      // Date fields
      {
        field: 'shippedAt',
        type: ValidationRuleType.TYPE,
        dataType: 'DATETIME' as any,
        allowNull: true,
      },

      {
        field: 'deliveredAt',
        type: ValidationRuleType.TYPE,
        dataType: 'DATETIME' as any,
        allowNull: true,
      },

      {
        field: 'cancelledAt',
        type: ValidationRuleType.TYPE,
        dataType: 'DATETIME' as any,
        allowNull: true,
      },

      // Business rules
      {
        field: 'total',
        type: ValidationRuleType.CUSTOM,
        validator: (value, record) => {
          const subtotal = parseFloat(record.subtotal) || 0;
          const tax = parseFloat(record.tax) || 0;
          const shipping = parseFloat(record.shipping) || 0;
          const discount = parseFloat(record.discount) || 0;
          const expectedTotal = subtotal + tax + shipping - discount;
          const actualTotal = parseFloat(value);

          // Allow small rounding differences (1 cent)
          return Math.abs(actualTotal - expectedTotal) < 0.01;
        },
        message: 'Total must equal subtotal + tax + shipping - discount',
        severity: ErrorSeverity.ERROR,
      },

      {
        field: 'deliveredAt',
        type: ValidationRuleType.CUSTOM,
        validator: (value, record) => {
          if (value && record.shippedAt) {
            const delivered = new Date(value);
            const shipped = new Date(record.shippedAt);
            return delivered >= shipped;
          }
          return true;
        },
        message: 'Delivered date must be after shipped date',
        severity: ErrorSeverity.WARNING,
      },

      {
        field: 'status',
        type: ValidationRuleType.CUSTOM,
        validator: (value, record) => {
          if (value === 'SHIPPED' && !record.shippedAt) {
            return false;
          }
          if (value === 'DELIVERED' && (!record.shippedAt || !record.deliveredAt)) {
            return false;
          }
          if (value === 'CANCELLED' && !record.cancelledAt) {
            return false;
          }
          return true;
        },
        message: 'Status must have corresponding date field (e.g., SHIPPED requires shippedAt)',
        severity: ErrorSeverity.WARNING,
      },
    ];
  }

  /**
   * Transform imported data
   */
  transformData(data: Record<string, any>): Record<string, any> {
    const transformed = { ...data };

    // Normalize status
    if (transformed.status) {
      transformed.status = transformed.status.toUpperCase();
    }

    // Parse address JSON
    if (typeof transformed.shippingAddress === 'string') {
      try {
        transformed.shippingAddress = JSON.parse(transformed.shippingAddress);
      } catch {
        this.logger.warn(
          `Failed to parse shippingAddress JSON for order: ${transformed.orderNumber}`,
        );
      }
    }

    if (typeof transformed.billingAddress === 'string') {
      try {
        transformed.billingAddress = JSON.parse(transformed.billingAddress);
      } catch {
        this.logger.warn(
          `Failed to parse billingAddress JSON for order: ${transformed.orderNumber}`,
        );
      }
    }

    // Convert numbers
    if (transformed.subtotal) {
      transformed.subtotal = parseFloat(transformed.subtotal);
    }

    if (transformed.tax) {
      transformed.tax = parseFloat(transformed.tax);
    }

    if (transformed.shipping) {
      transformed.shipping = parseFloat(transformed.shipping);
    }

    if (transformed.discount) {
      transformed.discount = parseFloat(transformed.discount);
    }

    if (transformed.total) {
      transformed.total = parseFloat(transformed.total);
    }

    // Parse dates
    if (transformed.shippedAt && typeof transformed.shippedAt === 'string') {
      transformed.shippedAt = new Date(transformed.shippedAt);
    }

    if (transformed.deliveredAt && typeof transformed.deliveredAt === 'string') {
      transformed.deliveredAt = new Date(transformed.deliveredAt);
    }

    if (transformed.cancelledAt && typeof transformed.cancelledAt === 'string') {
      transformed.cancelledAt = new Date(transformed.cancelledAt);
    }

    return transformed;
  }

  /**
   * Transform for database
   */
  async transformForDatabase(data: Record<string, any>): Promise<Record<string, any>> {
    const transformed = { ...data };

    // Set defaults
    if (transformed.tax === undefined || transformed.tax === null) {
      transformed.tax = 0;
    }

    if (transformed.shipping === undefined || transformed.shipping === null) {
      transformed.shipping = 0;
    }

    if (transformed.discount === undefined || transformed.discount === null) {
      transformed.discount = 0;
    }

    if (transformed.currency === undefined || transformed.currency === null) {
      transformed.currency = 'PHP';
    }

    return transformed;
  }

  /**
   * Validate relationships
   */
  async validateRelationships(data: Record<string, any>): Promise<string[]> {
    const errors: string[] = [];

    // Validate user exists
    const userExists = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true },
    });

    if (!userExists) {
      errors.push(`User with ID "${data.userId}" does not exist`);
    }

    return errors;
  }
}
