/**
 * Base Import Validator
 * 
 * Abstract base class for entity-specific import validators.
 * Provides common validation logic and helper methods.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  AnyValidationRule,
  ValidationRuleBuilder as Rules,
  DataType,
  ValidationRuleType,
} from './validation.types';

@Injectable()
export abstract class BaseImportValidator {
  constructor(protected readonly prisma: PrismaService) {}

  /**
   * Get validation rules for the entity
   * Must be implemented by each entity validator
   */
  abstract getRules(): AnyValidationRule[];

  /**
   * Get entity name (for logging and error messages)
   */
  abstract getEntityName(): string;

  /**
   * Get required fields
   */
  protected getRequiredFields(): string[] {
    return this.getRules()
      .filter((r) => r.type === ValidationRuleType.REQUIRED)
      .map((r) => r.field);
  }

  /**
   * Transform imported data before validation (optional)
   * Override in entity validators for custom transformations
   */
  transformData(data: Record<string, any>): Record<string, any> {
    return data;
  }

  /**
   * Transform validated data before database insertion (optional)
   * Override in entity validators for custom transformations
   */
  async transformForDatabase(data: Record<string, any>): Promise<Record<string, any>> {
    return data;
  }

  /**
   * Validate relationships (optional)
   * Override in entity validators for relationship-specific validation
   */
  async validateRelationships(data: Record<string, any>): Promise<string[]> {
    return [];
  }

  /**
   * Helper: Create enum rule from Prisma enum
   */
  protected enumRule(field: string, enumValues: string[]): AnyValidationRule {
    return Rules.enum(field, enumValues, false); // Case-insensitive
  }

  /**
   * Helper: Create optional string field rule
   */
  protected optionalString(field: string, maxLength?: number): AnyValidationRule[] {
    const rules: AnyValidationRule[] = [Rules.type(field, DataType.STRING, true)];
    if (maxLength) {
      rules.push(Rules.length(field, undefined, maxLength));
    }
    return rules;
  }

  /**
   * Helper: Create required string field rule
   */
  protected requiredString(field: string, minLength?: number, maxLength?: number): AnyValidationRule[] {
    return [
      Rules.required(field),
      Rules.type(field, DataType.STRING),
      Rules.length(field, minLength, maxLength),
    ];
  }

  /**
   * Helper: Create optional number field rule
   */
  protected optionalNumber(field: string, min?: number, max?: number): AnyValidationRule[] {
    const rules: AnyValidationRule[] = [Rules.type(field, DataType.NUMBER, true)];
    if (min !== undefined || max !== undefined) {
      rules.push(Rules.range(field, min, max));
    }
    return rules;
  }

  /**
   * Helper: Create required number field rule
   */
  protected requiredNumber(field: string, min?: number, max?: number): AnyValidationRule[] {
    const rules: AnyValidationRule[] = [
      Rules.required(field),
      Rules.type(field, DataType.NUMBER),
    ];
    if (min !== undefined || max !== undefined) {
      rules.push(Rules.range(field, min, max));
    }
    return rules;
  }

  /**
   * Helper: Create optional decimal field rule
   */
  protected optionalDecimal(field: string, min?: number, max?: number): AnyValidationRule[] {
    const rules: AnyValidationRule[] = [Rules.type(field, DataType.DECIMAL, true)];
    if (min !== undefined || max !== undefined) {
      rules.push(Rules.range(field, min, max));
    }
    return rules;
  }

  /**
   * Helper: Create required decimal field rule
   */
  protected requiredDecimal(field: string, min?: number, max?: number): AnyValidationRule[] {
    const rules: AnyValidationRule[] = [
      Rules.required(field),
      Rules.type(field, DataType.DECIMAL),
    ];
    if (min !== undefined || max !== undefined) {
      rules.push(Rules.range(field, min, max));
    }
    return rules;
  }

  /**
   * Helper: Create optional integer field rule
   */
  protected optionalInteger(field: string, min?: number, max?: number): AnyValidationRule[] {
    const rules: AnyValidationRule[] = [Rules.type(field, DataType.INTEGER, true)];
    if (min !== undefined || max !== undefined) {
      rules.push(Rules.range(field, min, max));
    }
    return rules;
  }

  /**
   * Helper: Create required integer field rule
   */
  protected requiredInteger(field: string, min?: number, max?: number): AnyValidationRule[] {
    const rules: AnyValidationRule[] = [
      Rules.required(field),
      Rules.type(field, DataType.INTEGER),
    ];
    if (min !== undefined || max !== undefined) {
      rules.push(Rules.range(field, min, max));
    }
    return rules;
  }

  /**
   * Helper: Create optional boolean field rule
   */
  protected optionalBoolean(field: string): AnyValidationRule {
    return Rules.type(field, DataType.BOOLEAN, true);
  }

  /**
   * Helper: Create required boolean field rule
   */
  protected requiredBoolean(field: string): AnyValidationRule[] {
    return [
      Rules.required(field),
      Rules.type(field, DataType.BOOLEAN),
    ];
  }

  /**
   * Helper: Create optional date field rule
   */
  protected optionalDate(field: string): AnyValidationRule[] {
    return [Rules.type(field, DataType.DATE, true)];
  }

  /**
   * Helper: Create required date field rule
   */
  protected requiredDate(field: string): AnyValidationRule[] {
    return [
      Rules.required(field),
      Rules.type(field, DataType.DATE),
    ];
  }

  /**
   * Helper: Create optional JSON field rule
   */
  protected optionalJson(field: string): AnyValidationRule {
    return Rules.type(field, DataType.JSON, true);
  }

  /**
   * Helper: Create required JSON field rule
   */
  protected requiredJson(field: string): AnyValidationRule[] {
    return [
      Rules.required(field),
      Rules.type(field, DataType.JSON),
    ];
  }
}
