/**
 * User Import Validator
 * 
 * Validates user data for import operations.
 * Handles user-specific business rules and constraints.
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
export class UserImportValidator extends BaseImportValidator {
  private readonly logger = new Logger(UserImportValidator.name);

  // Valid user roles from Prisma schema
  private readonly USER_ROLES = ['USER', 'ADMIN', 'SELLER', 'MODERATOR', 'SUPER_ADMIN'];

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  getEntityName(): string {
    return 'User';
  }

  getRules(): AnyValidationRule[] {
    return [
      // Required fields
      Rules.required('email'),
      Rules.email('email'),
      Rules.unique('email', false), // Case-insensitive email

      Rules.required('clerkId'),
      Rules.type('clerkId', 'STRING' as any),
      Rules.unique('clerkId', true),

      // Optional fields
      {
        field: 'username',
        type: ValidationRuleType.TYPE,
        dataType: 'STRING' as any,
        allowNull: true,
      },
      {
        field: 'username',
        type: ValidationRuleType.LENGTH,
        minLength: 3,
        maxLength: 50,
        severity: ErrorSeverity.WARNING,
      },
      {
        field: 'username',
        type: ValidationRuleType.UNIQUE,
        caseSensitive: false,
        message: 'Username must be unique',
      },

      {
        field: 'firstName',
        type: ValidationRuleType.TYPE,
        dataType: 'STRING' as any,
        allowNull: true,
      },
      {
        field: 'firstName',
        type: ValidationRuleType.LENGTH,
        maxLength: 100,
      },

      {
        field: 'lastName',
        type: ValidationRuleType.TYPE,
        dataType: 'STRING' as any,
        allowNull: true,
      },
      {
        field: 'lastName',
        type: ValidationRuleType.LENGTH,
        maxLength: 100,
      },

      {
        field: 'phoneNumber',
        type: ValidationRuleType.FORMAT,
        format: 'PHONE' as any,
        severity: ErrorSeverity.WARNING,
      },

      {
        field: 'imageUrl',
        type: ValidationRuleType.FORMAT,
        format: 'URL' as any,
        severity: ErrorSeverity.WARNING,
      },

      // Role validation
      {
        field: 'role',
        type: ValidationRuleType.ENUM,
        allowedValues: this.USER_ROLES,
        caseSensitive: false,
        message: `Role must be one of: ${this.USER_ROLES.join(', ')}`,
      },

      // Boolean fields
      {
        field: 'isActive',
        type: ValidationRuleType.TYPE,
        dataType: 'BOOLEAN' as any,
        allowNull: true,
      },

      {
        field: 'twoFactorEnabled',
        type: ValidationRuleType.TYPE,
        dataType: 'BOOLEAN' as any,
        allowNull: true,
      },

      // JSON preferences
      {
        field: 'preferences',
        type: ValidationRuleType.TYPE,
        dataType: 'JSON' as any,
        allowNull: true,
      },

      // Date fields
      {
        field: 'lastLoginAt',
        type: ValidationRuleType.TYPE,
        dataType: 'DATETIME' as any,
        allowNull: true,
      },
    ];
  }

  /**
   * Transform imported data
   */
  transformData(data: Record<string, any>): Record<string, any> {
    const transformed = { ...data };

    // Normalize email
    if (transformed.email) {
      transformed.email = transformed.email.toLowerCase().trim();
    }

    // Normalize username
    if (transformed.username) {
      transformed.username = transformed.username.toLowerCase().trim();
    }

    // Normalize role
    if (transformed.role) {
      transformed.role = transformed.role.toUpperCase();
    }

    // Parse preferences JSON
    if (typeof transformed.preferences === 'string') {
      try {
        transformed.preferences = JSON.parse(transformed.preferences);
      } catch {
        this.logger.warn(`Failed to parse preferences JSON for user: ${transformed.email}`);
        transformed.preferences = null;
      }
    }

    // Convert boolean strings
    if (typeof transformed.isActive === 'string') {
      transformed.isActive = transformed.isActive.toLowerCase() === 'true' || transformed.isActive === '1';
    }

    if (typeof transformed.twoFactorEnabled === 'string') {
      transformed.twoFactorEnabled =
        transformed.twoFactorEnabled.toLowerCase() === 'true' || transformed.twoFactorEnabled === '1';
    }

    // Parse date
    if (transformed.lastLoginAt && typeof transformed.lastLoginAt === 'string') {
      transformed.lastLoginAt = new Date(transformed.lastLoginAt);
    }

    return transformed;
  }

  /**
   * Transform for database
   */
  async transformForDatabase(data: Record<string, any>): Promise<Record<string, any>> {
    const transformed = { ...data };

    // Set defaults
    if (transformed.role === undefined || transformed.role === null) {
      transformed.role = 'USER';
    }

    if (transformed.isActive === undefined || transformed.isActive === null) {
      transformed.isActive = true;
    }

    if (transformed.twoFactorEnabled === undefined || transformed.twoFactorEnabled === null) {
      transformed.twoFactorEnabled = false;
    }

    // Initialize empty arrays for relations
    transformed.twoFactorBackupCodes = [];

    return transformed;
  }
}
