/**
 * Validation Types & Interfaces
 * 
 * Defines types and interfaces for the validation system used in import/export operations.
 * Supports various validation rule types, error tracking, and validation results.
 */

import { ErrorSeverity, ErrorType } from '@prisma/client';

// Re-export Prisma enums for convenience
export { ErrorSeverity, ErrorType };

/**
 * Validation rule types
 */
export enum ValidationRuleType {
  REQUIRED = 'REQUIRED',
  TYPE = 'TYPE',
  FORMAT = 'FORMAT',
  RANGE = 'RANGE',
  LENGTH = 'LENGTH',
  UNIQUE = 'UNIQUE',
  FOREIGN_KEY = 'FOREIGN_KEY',
  ENUM = 'ENUM',
  PATTERN = 'PATTERN',
  CUSTOM = 'CUSTOM',
  CONDITIONAL = 'CONDITIONAL',
}

/**
 * Data types for validation
 */
export enum DataType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  INTEGER = 'INTEGER',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  URL = 'URL',
  JSON = 'JSON',
  ARRAY = 'ARRAY',
  DECIMAL = 'DECIMAL',
}

/**
 * Base validation rule interface
 */
export interface ValidationRule {
  field: string;
  type: ValidationRuleType;
  message?: string;
  severity?: ErrorSeverity;
}

/**
 * Required field validation rule
 */
export interface RequiredRule extends ValidationRule {
  type: ValidationRuleType.REQUIRED;
}

/**
 * Type validation rule
 */
export interface TypeRule extends ValidationRule {
  type: ValidationRuleType.TYPE;
  dataType: DataType;
  allowNull?: boolean;
}

/**
 * Format validation rule (email, phone, URL, etc.)
 */
export interface FormatRule extends ValidationRule {
  type: ValidationRuleType.FORMAT;
  format: DataType.EMAIL | DataType.PHONE | DataType.URL | DataType.DATE | DataType.DATETIME;
}

/**
 * Range validation rule (min/max for numbers)
 */
export interface RangeRule extends ValidationRule {
  type: ValidationRuleType.RANGE;
  min?: number;
  max?: number;
  minInclusive?: boolean;
  maxInclusive?: boolean;
}

/**
 * Length validation rule (for strings)
 */
export interface LengthRule extends ValidationRule {
  type: ValidationRuleType.LENGTH;
  minLength?: number;
  maxLength?: number;
}

/**
 * Unique constraint validation rule
 */
export interface UniqueRule extends ValidationRule {
  type: ValidationRuleType.UNIQUE;
  scope?: string[]; // Fields to consider together for uniqueness
  caseSensitive?: boolean;
}

/**
 * Foreign key validation rule
 */
export interface ForeignKeyRule extends ValidationRule {
  type: ValidationRuleType.FOREIGN_KEY;
  referencedEntity: string; // Entity name (e.g., 'User', 'Product')
  referencedField: string; // Field name in referenced entity (e.g., 'id', 'email')
  allowNull?: boolean;
}

/**
 * Enum validation rule
 */
export interface EnumRule extends ValidationRule {
  type: ValidationRuleType.ENUM;
  allowedValues: string[] | number[];
  caseSensitive?: boolean;
}

/**
 * Pattern (regex) validation rule
 */
export interface PatternRule extends ValidationRule {
  type: ValidationRuleType.PATTERN;
  pattern: string | RegExp;
  flags?: string;
}

/**
 * Custom validation rule with callback
 */
export interface CustomRule extends ValidationRule {
  type: ValidationRuleType.CUSTOM;
  validator: (value: any, record: Record<string, any>, context?: ValidationContext) => boolean | Promise<boolean>;
}

/**
 * Conditional validation rule (if field A has value X, then validate field B)
 */
export interface ConditionalRule extends ValidationRule {
  type: ValidationRuleType.CONDITIONAL;
  condition: (record: Record<string, any>) => boolean;
  rules: AnyValidationRule[];
}

/**
 * Union type of all validation rules
 */
export type AnyValidationRule =
  | RequiredRule
  | TypeRule
  | FormatRule
  | RangeRule
  | LengthRule
  | UniqueRule
  | ForeignKeyRule
  | EnumRule
  | PatternRule
  | CustomRule
  | ConditionalRule;

/**
 * Validation context (passed to validators)
 */
export interface ValidationContext {
  entityType: string;
  jobId?: string;
  batchIndex?: number;
  totalRecords?: number;
  existingData?: Map<string, Set<any>>; // For unique constraint checks
  cache?: Map<string, any>; // For caching foreign key lookups
}

/**
 * Validation error details
 */
export interface ValidationError {
  row: number; // 1-based row number (includes header)
  column?: string; // Column/field name
  field: string; // Internal field name
  type: ErrorType;
  severity: ErrorSeverity;
  code: string; // Error code (e.g., 'REQUIRED_FIELD', 'INVALID_EMAIL')
  message: string; // Human-readable error message
  suggestion?: string; // Suggestion to fix the error
  originalValue?: any; // Original value that failed validation
  expectedFormat?: string; // Expected format/type
  ruleType?: ValidationRuleType; // Validation rule that failed
}

/**
 * Validation result for a single record
 */
export interface RecordValidationResult {
  row: number;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  record: Record<string, any>;
}

/**
 * Validation result for a batch of records
 */
export interface BatchValidationResult {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  warningRecords: number;
  results: RecordValidationResult[];
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    errorsByType: Record<ErrorType, number>;
    errorsByField: Record<string, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
  };
}

/**
 * Validation options
 */
export interface ValidationOptions {
  skipInvalid?: boolean; // Skip invalid records instead of failing entire import
  stopOnFirstError?: boolean; // Stop validation after first error
  maxErrors?: number; // Maximum errors to collect before stopping
  validateUnique?: boolean; // Validate unique constraints (requires database queries)
  validateForeignKeys?: boolean; // Validate foreign keys (requires database queries)
  batchSize?: number; // Batch size for validation
  context?: ValidationContext; // Validation context
}

/**
 * Validation rule builder helper
 */
export class ValidationRuleBuilder {
  static required(field: string, message?: string): RequiredRule {
    return {
      field,
      type: ValidationRuleType.REQUIRED,
      message: message || `${field} is required`,
      severity: ErrorSeverity.ERROR,
    };
  }

  static type(field: string, dataType: DataType, allowNull = false): TypeRule {
    return {
      field,
      type: ValidationRuleType.TYPE,
      dataType,
      allowNull,
      message: `${field} must be of type ${dataType}`,
      severity: ErrorSeverity.ERROR,
    };
  }

  static email(field: string): FormatRule {
    return {
      field,
      type: ValidationRuleType.FORMAT,
      format: DataType.EMAIL,
      message: `${field} must be a valid email address`,
      severity: ErrorSeverity.ERROR,
    };
  }

  static phone(field: string): FormatRule {
    return {
      field,
      type: ValidationRuleType.FORMAT,
      format: DataType.PHONE,
      message: `${field} must be a valid phone number`,
      severity: ErrorSeverity.ERROR,
    };
  }

  static url(field: string): FormatRule {
    return {
      field,
      type: ValidationRuleType.FORMAT,
      format: DataType.URL,
      message: `${field} must be a valid URL`,
      severity: ErrorSeverity.ERROR,
    };
  }

  static range(field: string, min?: number, max?: number): RangeRule {
    return {
      field,
      type: ValidationRuleType.RANGE,
      min,
      max,
      minInclusive: true,
      maxInclusive: true,
      message: `${field} must be between ${min ?? '-∞'} and ${max ?? '∞'}`,
      severity: ErrorSeverity.ERROR,
    };
  }

  static stringLength(field: string, minLength?: number, maxLength?: number): LengthRule {
    return {
      field,
      type: ValidationRuleType.LENGTH,
      minLength,
      maxLength,
      message: `${field} length must be between ${minLength ?? 0} and ${maxLength ?? '∞'}`,
      severity: ErrorSeverity.ERROR,
    };
  }

  static unique(field: string, caseSensitive = true): UniqueRule {
    return {
      field,
      type: ValidationRuleType.UNIQUE,
      caseSensitive,
      message: `${field} must be unique`,
      severity: ErrorSeverity.ERROR,
    };
  }

  static foreignKey(
    field: string,
    referencedEntity: string,
    referencedField: string,
    allowNull = false,
  ): ForeignKeyRule {
    return {
      field,
      type: ValidationRuleType.FOREIGN_KEY,
      referencedEntity,
      referencedField,
      allowNull,
      message: `${field} must reference an existing ${referencedEntity}.${referencedField}`,
      severity: ErrorSeverity.ERROR,
    };
  }

  static enum(field: string, allowedValues: string[] | number[], caseSensitive = true): EnumRule {
    return {
      field,
      type: ValidationRuleType.ENUM,
      allowedValues,
      caseSensitive,
      message: `${field} must be one of: ${allowedValues.join(', ')}`,
      severity: ErrorSeverity.ERROR,
    };
  }

  static pattern(field: string, pattern: string | RegExp, flags?: string): PatternRule {
    return {
      field,
      type: ValidationRuleType.PATTERN,
      pattern,
      flags,
      message: `${field} format is invalid`,
      severity: ErrorSeverity.ERROR,
    };
  }

  static custom(
    field: string,
    validator: (value: any, record: Record<string, any>) => boolean | Promise<boolean>,
    message?: string,
  ): CustomRule {
    return {
      field,
      type: ValidationRuleType.CUSTOM,
      validator,
      message: message || `${field} validation failed`,
      severity: ErrorSeverity.ERROR,
    };
  }
}
