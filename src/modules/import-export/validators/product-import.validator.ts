/**
 * Product Import Validator
 *
 * Validates product data for import operations.
 * Handles product-specific business rules and constraints.
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
export class ProductImportValidator extends BaseImportValidator {
  private readonly logger = new Logger(ProductImportValidator.name);

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  getEntityName(): string {
    return 'Product';
  }

  getRules(): AnyValidationRule[] {
    return [
      // Required fields
      Rules.required('name'),
      Rules.type('name', 'STRING' as any),
      Rules.stringLength('name', 1, 255),

      Rules.required('slug'),
      Rules.type('slug', 'STRING' as any),
      Rules.stringLength('slug', 1, 255),
      Rules.unique('slug', true),
      Rules.pattern('slug', /^[a-z0-9]+(?:-[a-z0-9]+)*$/, undefined),

      Rules.required('price'),
      Rules.type('price', 'DECIMAL' as any),
      Rules.range('price', 0), // Price must be >= 0

      // Optional fields
      {
        field: 'description',
        type: ValidationRuleType.TYPE,
        dataType: 'STRING' as any,
        allowNull: true,
        severity: ErrorSeverity.WARNING,
      },

      {
        field: 'sku',
        type: ValidationRuleType.TYPE,
        dataType: 'STRING' as any,
        allowNull: true,
        message: 'SKU must be a string',
      },
      {
        field: 'sku',
        type: ValidationRuleType.UNIQUE,
        caseSensitive: false,
        message: 'SKU must be unique',
        severity: ErrorSeverity.ERROR,
      },

      {
        field: 'comparePrice',
        type: ValidationRuleType.TYPE,
        dataType: 'DECIMAL' as any,
        allowNull: true,
      },
      {
        field: 'comparePrice',
        type: ValidationRuleType.RANGE,
        min: 0,
        severity: ErrorSeverity.WARNING,
        message: 'Compare price should be positive',
      },

      {
        field: 'costPrice',
        type: ValidationRuleType.TYPE,
        dataType: 'DECIMAL' as any,
        allowNull: true,
      },
      {
        field: 'costPrice',
        type: ValidationRuleType.RANGE,
        min: 0,
        severity: ErrorSeverity.WARNING,
        message: 'Cost price should be positive',
      },

      Rules.type('stock', 'INTEGER' as any, false),
      Rules.range('stock', 0), // Stock must be >= 0

      {
        field: 'minStock',
        type: ValidationRuleType.TYPE,
        dataType: 'INTEGER' as any,
        allowNull: true,
      },
      {
        field: 'minStock',
        type: ValidationRuleType.RANGE,
        min: 0,
        severity: ErrorSeverity.WARNING,
      },

      {
        field: 'weight',
        type: ValidationRuleType.TYPE,
        dataType: 'NUMBER' as any,
        allowNull: true,
      },
      {
        field: 'weight',
        type: ValidationRuleType.RANGE,
        min: 0,
        severity: ErrorSeverity.WARNING,
        message: 'Weight should be positive',
      },

      // Boolean fields
      {
        field: 'isActive',
        type: ValidationRuleType.TYPE,
        dataType: 'BOOLEAN' as any,
        allowNull: true,
      },

      {
        field: 'isFeatured',
        type: ValidationRuleType.TYPE,
        dataType: 'BOOLEAN' as any,
        allowNull: true,
      },

      // JSON fields
      {
        field: 'dimensions',
        type: ValidationRuleType.TYPE,
        dataType: 'JSON' as any,
        allowNull: true,
      },

      {
        field: 'images',
        type: ValidationRuleType.TYPE,
        dataType: 'JSON' as any,
        allowNull: true,
      },

      {
        field: 'categories',
        type: ValidationRuleType.TYPE,
        dataType: 'JSON' as any,
        allowNull: true,
      },

      {
        field: 'tags',
        type: ValidationRuleType.TYPE,
        dataType: 'JSON' as any,
        allowNull: true,
      },

      {
        field: 'attributes',
        type: ValidationRuleType.TYPE,
        dataType: 'JSON' as any,
        allowNull: true,
      },

      // SEO fields
      {
        field: 'seoTitle',
        type: ValidationRuleType.LENGTH,
        maxLength: 255,
        severity: ErrorSeverity.WARNING,
      },

      {
        field: 'seoDescription',
        type: ValidationRuleType.LENGTH,
        maxLength: 500,
        severity: ErrorSeverity.WARNING,
      },

      // Business rules
      {
        field: 'comparePrice',
        type: ValidationRuleType.CUSTOM,
        validator: (value, record) => {
          if (value && record.price) {
            return parseFloat(value) >= parseFloat(record.price);
          }
          return true;
        },
        message:
          'Compare price should be greater than or equal to regular price',
        severity: ErrorSeverity.WARNING,
      },

      {
        field: 'stock',
        type: ValidationRuleType.CUSTOM,
        validator: (value, record) => {
          if (record.minStock && value !== null && value !== undefined) {
            return parseInt(value) >= parseInt(record.minStock);
          }
          return true;
        },
        message: 'Stock should be greater than or equal to minimum stock',
        severity: ErrorSeverity.WARNING,
      },
    ];
  }

  /**
   * Transform imported data (normalize values)
   */
  transformData(data: Record<string, any>): Record<string, any> {
    const transformed = { ...data };

    // Generate slug from name if not provided
    if (!transformed.slug && transformed.name) {
      transformed.slug = this.generateSlug(transformed.name);
    }

    // Parse JSON strings if needed
    if (typeof transformed.images === 'string') {
      try {
        transformed.images = JSON.parse(transformed.images);
      } catch {
        this.logger.warn(
          `Failed to parse images JSON for product: ${transformed.name}`,
        );
      }
    }

    if (typeof transformed.categories === 'string') {
      try {
        transformed.categories = JSON.parse(transformed.categories);
      } catch {
        this.logger.warn(
          `Failed to parse categories JSON for product: ${transformed.name}`,
        );
      }
    }

    if (typeof transformed.tags === 'string') {
      try {
        transformed.tags = JSON.parse(transformed.tags);
      } catch {
        this.logger.warn(
          `Failed to parse tags JSON for product: ${transformed.name}`,
        );
      }
    }

    if (typeof transformed.attributes === 'string') {
      try {
        transformed.attributes = JSON.parse(transformed.attributes);
      } catch {
        this.logger.warn(
          `Failed to parse attributes JSON for product: ${transformed.name}`,
        );
      }
    }

    if (typeof transformed.dimensions === 'string') {
      try {
        transformed.dimensions = JSON.parse(transformed.dimensions);
      } catch {
        this.logger.warn(
          `Failed to parse dimensions JSON for product: ${transformed.name}`,
        );
      }
    }

    // Convert boolean strings
    if (typeof transformed.isActive === 'string') {
      transformed.isActive =
        transformed.isActive.toLowerCase() === 'true' ||
        transformed.isActive === '1';
    }

    if (typeof transformed.isFeatured === 'string') {
      transformed.isFeatured =
        transformed.isFeatured.toLowerCase() === 'true' ||
        transformed.isFeatured === '1';
    }

    // Convert numbers
    if (transformed.price) {
      transformed.price = parseFloat(transformed.price);
    }

    if (transformed.comparePrice) {
      transformed.comparePrice = parseFloat(transformed.comparePrice);
    }

    if (transformed.costPrice) {
      transformed.costPrice = parseFloat(transformed.costPrice);
    }

    if (transformed.stock) {
      transformed.stock = parseInt(transformed.stock);
    }

    if (transformed.minStock) {
      transformed.minStock = parseInt(transformed.minStock);
    }

    if (transformed.weight) {
      transformed.weight = parseFloat(transformed.weight);
    }

    return transformed;
  }

  /**
   * Transform for database (prepare for Prisma)
   */
  async transformForDatabase(
    data: Record<string, any>,
  ): Promise<Record<string, any>> {
    const transformed = { ...data };

    // Set defaults
    if (transformed.stock === undefined || transformed.stock === null) {
      transformed.stock = 0;
    }

    if (transformed.minStock === undefined || transformed.minStock === null) {
      transformed.minStock = 0;
    }

    if (transformed.isActive === undefined || transformed.isActive === null) {
      transformed.isActive = true;
    }

    if (
      transformed.isFeatured === undefined ||
      transformed.isFeatured === null
    ) {
      transformed.isFeatured = false;
    }

    // Ensure arrays for JSON fields
    if (!transformed.images || !Array.isArray(transformed.images)) {
      transformed.images = [];
    }

    if (!transformed.categories || !Array.isArray(transformed.categories)) {
      transformed.categories = [];
    }

    if (!transformed.tags || !Array.isArray(transformed.tags)) {
      transformed.tags = [];
    }

    return transformed;
  }

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Validate relationships (optional - for future use)
   */
  async validateRelationships(data: Record<string, any>): Promise<string[]> {
    const errors: string[] = [];

    // Validate category IDs if provided
    if (data.categories && Array.isArray(data.categories)) {
      for (const categoryId of data.categories) {
        const exists = await this.prisma.category.findUnique({
          where: { id: categoryId },
          select: { id: true },
        });

        if (!exists) {
          errors.push(`Category with ID "${categoryId}" does not exist`);
        }
      }
    }

    return errors;
  }
}
