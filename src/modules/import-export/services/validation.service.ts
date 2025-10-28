/**
 * Validation Service
 *
 * Core validation engine for import/export operations.
 * Provides rule-based validation with support for multiple validation types,
 * error collection, and batch processing.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ErrorSeverity, ErrorType } from '@prisma/client';
import {
  AnyValidationRule,
  ValidationRuleType,
  DataType,
  ValidationError,
  RecordValidationResult,
  BatchValidationResult,
  ValidationOptions,
  ValidationContext,
  TypeRule,
  FormatRule,
  RangeRule,
  LengthRule,
  UniqueRule,
  ForeignKeyRule,
  EnumRule,
  PatternRule,
  CustomRule,
  ConditionalRule,
} from '../validators/validation.types';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate a batch of records
   */
  async validateBatch(
    records: Record<string, any>[],
    rules: AnyValidationRule[],
    options: ValidationOptions = {},
  ): Promise<BatchValidationResult> {
    const startTime = Date.now();
    const results: RecordValidationResult[] = [];
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationError[] = [];

    this.logger.log(`Validating batch of ${records.length} records with ${rules.length} rules`);

    // Initialize validation context
    const context: ValidationContext = {
      ...options.context,
      totalRecords: records.length,
      existingData: new Map(),
      cache: new Map(),
    };

    // Pre-load unique constraint data if needed
    if (options.validateUnique) {
      await this.preloadUniqueConstraints(records, rules, context);
    }

    // Validate each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // +2 for 1-based index and header row

      const result = await this.validateRecord(record, rowNumber, rules, context, options);
      results.push(result);

      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);

      // Stop on first error if requested
      if (options.stopOnFirstError && result.errors.length > 0) {
        this.logger.warn(`Stopping validation at row ${rowNumber} due to stopOnFirstError option`);
        break;
      }

      // Stop if max errors reached
      if (options.maxErrors && allErrors.length >= options.maxErrors) {
        this.logger.warn(
          `Stopping validation at row ${rowNumber} - max errors (${options.maxErrors}) reached`,
        );
        break;
      }
    }

    const validRecords = results.filter(r => r.isValid).length;
    const invalidRecords = results.filter(r => !r.isValid).length;
    const warningRecords = results.filter(r => r.warnings.length > 0).length;

    const summary = this.generateSummary(allErrors, allWarnings);

    const duration = Date.now() - startTime;
    this.logger.log(
      `Batch validation completed in ${duration}ms: ${validRecords} valid, ${invalidRecords} invalid, ${warningRecords} with warnings`,
    );

    return {
      totalRecords: records.length,
      validRecords,
      invalidRecords,
      warningRecords,
      results,
      errors: allErrors,
      warnings: allWarnings,
      summary,
    };
  }

  /**
   * Validate a single record
   */
  async validateRecord(
    record: Record<string, any>,
    row: number,
    rules: AnyValidationRule[],
    context: ValidationContext,
    options: ValidationOptions = {},
  ): Promise<RecordValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    for (const rule of rules) {
      const ruleErrors = await this.validateRule(record, row, rule, context, options);

      for (const error of ruleErrors) {
        if (error.severity === ErrorSeverity.ERROR) {
          errors.push(error);
        } else if (error.severity === ErrorSeverity.WARNING) {
          warnings.push(error);
        }
      }

      // Stop if max errors reached for this record
      if (options.maxErrors && errors.length >= options.maxErrors) {
        break;
      }
    }

    return {
      row,
      isValid: errors.length === 0,
      errors,
      warnings,
      record,
    };
  }

  /**
   * Validate a single rule against a record
   */
  private async validateRule(
    record: Record<string, any>,
    row: number,
    rule: AnyValidationRule,
    context: ValidationContext,
    options: ValidationOptions,
  ): Promise<ValidationError[]> {
    const value = record[rule.field];

    switch (rule.type) {
      case ValidationRuleType.REQUIRED:
        return this.validateRequired(record, row, rule, value);

      case ValidationRuleType.TYPE:
        return this.validateType(record, row, rule, value);

      case ValidationRuleType.FORMAT:
        return this.validateFormat(record, row, rule, value);

      case ValidationRuleType.RANGE:
        return this.validateRange(record, row, rule, value);

      case ValidationRuleType.LENGTH:
        return this.validateLength(record, row, rule, value);

      case ValidationRuleType.UNIQUE:
        return this.validateUnique(record, row, rule, value, context, options);

      case ValidationRuleType.FOREIGN_KEY:
        return await this.validateForeignKey(record, row, rule, value, context, options);

      case ValidationRuleType.ENUM:
        return this.validateEnum(record, row, rule, value);

      case ValidationRuleType.PATTERN:
        return this.validatePattern(record, row, rule, value);

      case ValidationRuleType.CUSTOM:
        return await this.validateCustom(record, row, rule, value, context);

      case ValidationRuleType.CONDITIONAL:
        return await this.validateConditional(record, row, rule, context, options);

      default:
        this.logger.warn(`Unknown validation rule type: ${(rule as any).type}`);
        return [];
    }
  }

  /**
   * Validate required field
   */
  private validateRequired(
    record: Record<string, any>,
    row: number,
    rule: AnyValidationRule,
    value: any,
  ): ValidationError[] {
    if (value === undefined || value === null || value === '') {
      return [
        {
          row,
          column: rule.field,
          field: rule.field,
          type: ErrorType.VALIDATION,
          severity: rule.severity || ErrorSeverity.ERROR,
          code: 'REQUIRED_FIELD',
          message: rule.message || `${rule.field} is required`,
          suggestion: 'Provide a non-empty value for this field',
          originalValue: value,
          ruleType: ValidationRuleType.REQUIRED,
        },
      ];
    }
    return [];
  }

  /**
   * Validate data type
   */
  private validateType(
    record: Record<string, any>,
    row: number,
    rule: TypeRule,
    value: any,
  ): ValidationError[] {
    // Allow null if specified
    if ((value === null || value === undefined) && rule.allowNull) {
      return [];
    }

    // Null check
    if (value === null || value === undefined) {
      return [
        this.createError(
          row,
          rule.field,
          'TYPE_MISMATCH',
          rule.message || `${rule.field} cannot be null`,
          rule.severity,
          value,
          `Non-null ${rule.dataType}`,
        ),
      ];
    }

    let isValid = false;

    switch (rule.dataType) {
      case DataType.STRING:
        isValid = typeof value === 'string';
        break;

      case DataType.NUMBER:
      case DataType.DECIMAL:
        isValid = !isNaN(parseFloat(value)) && isFinite(value);
        break;

      case DataType.INTEGER:
        isValid = Number.isInteger(Number(value));
        break;

      case DataType.BOOLEAN:
        isValid =
          typeof value === 'boolean' ||
          value === 'true' ||
          value === 'false' ||
          value === '1' ||
          value === '0' ||
          value === 1 ||
          value === 0;
        break;

      case DataType.DATE:
      case DataType.DATETIME:
        isValid = !isNaN(Date.parse(value));
        break;

      case DataType.ARRAY:
        isValid = Array.isArray(value) || (typeof value === 'string' && value.startsWith('['));
        break;

      case DataType.JSON:
        if (typeof value === 'object') {
          isValid = true;
        } else if (typeof value === 'string') {
          try {
            JSON.parse(value);
            isValid = true;
          } catch {
            isValid = false;
          }
        }
        break;

      default:
        isValid = true;
    }

    if (!isValid) {
      return [
        this.createError(
          row,
          rule.field,
          'TYPE_MISMATCH',
          rule.message || `${rule.field} must be of type ${rule.dataType}`,
          rule.severity,
          value,
          rule.dataType,
        ),
      ];
    }

    return [];
  }

  /**
   * Validate format (email, phone, URL, date)
   */
  private validateFormat(
    record: Record<string, any>,
    row: number,
    rule: FormatRule,
    value: any,
  ): ValidationError[] {
    if (value === null || value === undefined || value === '') {
      return [];
    }

    let isValid = false;
    let expectedFormat = '';

    switch (rule.format) {
      case DataType.EMAIL:
        isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        expectedFormat = 'user@example.com';
        break;

      case DataType.PHONE:
        isValid = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/.test(value);
        expectedFormat = '+1234567890 or (123) 456-7890';
        break;

      case DataType.URL:
        try {
          new URL(value);
          isValid = true;
        } catch {
          isValid = false;
        }
        expectedFormat = 'https://example.com';
        break;

      case DataType.DATE:
        isValid = !isNaN(Date.parse(value));
        expectedFormat = 'YYYY-MM-DD';
        break;

      case DataType.DATETIME:
        isValid = !isNaN(Date.parse(value));
        expectedFormat = 'YYYY-MM-DD HH:mm:ss';
        break;
    }

    if (!isValid) {
      return [
        this.createError(
          row,
          rule.field,
          'INVALID_FORMAT',
          rule.message || `${rule.field} has invalid ${rule.format} format`,
          rule.severity,
          value,
          expectedFormat,
        ),
      ];
    }

    return [];
  }

  /**
   * Validate range (min/max)
   */
  private validateRange(
    record: Record<string, any>,
    row: number,
    rule: RangeRule,
    value: any,
  ): ValidationError[] {
    if (value === null || value === undefined || value === '') {
      return [];
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      return [
        this.createError(
          row,
          rule.field,
          'INVALID_NUMBER',
          `${rule.field} must be a number`,
          rule.severity,
          value,
          'Number',
        ),
      ];
    }

    const errors: ValidationError[] = [];

    if (rule.min !== undefined) {
      const minValid = rule.minInclusive ? numValue >= rule.min : numValue > rule.min;
      if (!minValid) {
        errors.push(
          this.createError(
            row,
            rule.field,
            'VALUE_TOO_SMALL',
            rule.message || `${rule.field} must be ${rule.minInclusive ? '>=' : '>'} ${rule.min}`,
            rule.severity,
            value,
            `${rule.minInclusive ? '>=' : '>'} ${rule.min}`,
          ),
        );
      }
    }

    if (rule.max !== undefined) {
      const maxValid = rule.maxInclusive ? numValue <= rule.max : numValue < rule.max;
      if (!maxValid) {
        errors.push(
          this.createError(
            row,
            rule.field,
            'VALUE_TOO_LARGE',
            rule.message || `${rule.field} must be ${rule.maxInclusive ? '<=' : '<'} ${rule.max}`,
            rule.severity,
            value,
            `${rule.maxInclusive ? '<=' : '<'} ${rule.max}`,
          ),
        );
      }
    }

    return errors;
  }

  /**
   * Validate string length
   */
  private validateLength(
    record: Record<string, any>,
    row: number,
    rule: LengthRule,
    value: any,
  ): ValidationError[] {
    if (value === null || value === undefined) {
      return [];
    }

    const strValue = String(value);
    const errors: ValidationError[] = [];

    if (rule.minLength !== undefined && strValue.length < rule.minLength) {
      errors.push(
        this.createError(
          row,
          rule.field,
          'STRING_TOO_SHORT',
          rule.message || `${rule.field} must be at least ${rule.minLength} characters`,
          rule.severity,
          value,
          `>= ${rule.minLength} characters`,
        ),
      );
    }

    if (rule.maxLength !== undefined && strValue.length > rule.maxLength) {
      errors.push(
        this.createError(
          row,
          rule.field,
          'STRING_TOO_LONG',
          rule.message || `${rule.field} must be at most ${rule.maxLength} characters`,
          rule.severity,
          value,
          `<= ${rule.maxLength} characters`,
        ),
      );
    }

    return errors;
  }

  /**
   * Validate unique constraint
   */
  private validateUnique(
    record: Record<string, any>,
    row: number,
    rule: UniqueRule,
    value: any,
    context: ValidationContext,
    options: ValidationOptions,
  ): ValidationError[] {
    if (!options.validateUnique) {
      return [];
    }

    if (value === null || value === undefined || value === '') {
      return [];
    }

    const key = rule.field;
    const compareValue = rule.caseSensitive ? value : String(value).toLowerCase();

    // Check in current batch
    if (!context.existingData.has(key)) {
      context.existingData.set(key, new Set());
    }

    const existingValues = context.existingData.get(key);
    if (existingValues.has(compareValue)) {
      return [
        this.createError(
          row,
          rule.field,
          'DUPLICATE_VALUE',
          rule.message || `${rule.field} must be unique. Value "${value}" already exists`,
          rule.severity,
          value,
          'Unique value',
        ),
      ];
    }

    existingValues.add(compareValue);
    return [];
  }

  /**
   * Validate foreign key constraint
   */
  private async validateForeignKey(
    record: Record<string, any>,
    row: number,
    rule: ForeignKeyRule,
    value: any,
    context: ValidationContext,
    options: ValidationOptions,
  ): Promise<ValidationError[]> {
    if (!options.validateForeignKeys) {
      return [];
    }

    if ((value === null || value === undefined || value === '') && rule.allowNull) {
      return [];
    }

    if (value === null || value === undefined || value === '') {
      return [
        this.createError(
          row,
          rule.field,
          'FOREIGN_KEY_NULL',
          `${rule.field} cannot be null`,
          rule.severity,
          value,
          `Valid ${rule.referencedEntity} ${rule.referencedField}`,
        ),
      ];
    }

    // Check cache first
    const cacheKey = `${rule.referencedEntity}:${rule.referencedField}:${value}`;
    if (context.cache?.has(cacheKey)) {
      const exists = context.cache.get(cacheKey);
      if (exists) {
        return [];
      }
    }

    // Query database
    try {
      const entityModel = this.getEntityModel(rule.referencedEntity);
      const exists = await entityModel.findUnique({
        where: { [rule.referencedField]: value },
        select: { id: true },
      });

      // Cache result
      context.cache?.set(cacheKey, !!exists);

      if (!exists) {
        return [
          this.createError(
            row,
            rule.field,
            'FOREIGN_KEY_NOT_FOUND',
            rule.message ||
              `${rule.field} references non-existent ${rule.referencedEntity}.${rule.referencedField} "${value}"`,
            rule.severity,
            value,
            `Valid ${rule.referencedEntity} ${rule.referencedField}`,
          ),
        ];
      }
    } catch (error) {
      this.logger.error(`Foreign key validation failed for ${rule.field}:`, error);
      return [
        this.createError(
          row,
          rule.field,
          'FOREIGN_KEY_ERROR',
          `Failed to validate ${rule.field}: ${error.message}`,
          ErrorSeverity.WARNING,
          value,
        ),
      ];
    }

    return [];
  }

  /**
   * Validate enum values
   */
  private validateEnum(
    record: Record<string, any>,
    row: number,
    rule: EnumRule,
    value: any,
  ): ValidationError[] {
    if (value === null || value === undefined || value === '') {
      return [];
    }

    const compareValue = rule.caseSensitive ? value : String(value).toLowerCase();
    const allowedValues: any[] = rule.caseSensitive
      ? rule.allowedValues
      : rule.allowedValues.map(v => String(v).toLowerCase());

    if (!allowedValues.includes(compareValue)) {
      return [
        this.createError(
          row,
          rule.field,
          'INVALID_ENUM_VALUE',
          rule.message || `${rule.field} must be one of: ${rule.allowedValues.join(', ')}`,
          rule.severity,
          value,
          rule.allowedValues.join(', '),
        ),
      ];
    }

    return [];
  }

  /**
   * Validate regex pattern
   */
  private validatePattern(
    record: Record<string, any>,
    row: number,
    rule: PatternRule,
    value: any,
  ): ValidationError[] {
    if (value === null || value === undefined || value === '') {
      return [];
    }

    const pattern =
      typeof rule.pattern === 'string' ? new RegExp(rule.pattern, rule.flags) : rule.pattern;

    if (!pattern.test(String(value))) {
      return [
        this.createError(
          row,
          rule.field,
          'PATTERN_MISMATCH',
          rule.message || `${rule.field} format is invalid`,
          rule.severity,
          value,
          `Pattern: ${pattern.source}`,
        ),
      ];
    }

    return [];
  }

  /**
   * Validate custom rule
   */
  private async validateCustom(
    record: Record<string, any>,
    row: number,
    rule: CustomRule,
    value: any,
    context: ValidationContext,
  ): Promise<ValidationError[]> {
    try {
      const isValid = await rule.validator(value, record, context);
      if (!isValid) {
        return [
          this.createError(
            row,
            rule.field,
            'CUSTOM_VALIDATION_FAILED',
            rule.message || `${rule.field} validation failed`,
            rule.severity,
            value,
          ),
        ];
      }
    } catch (error) {
      this.logger.error(`Custom validation failed for ${rule.field}:`, error);
      return [
        this.createError(
          row,
          rule.field,
          'CUSTOM_VALIDATION_ERROR',
          `Validation error: ${error.message}`,
          ErrorSeverity.WARNING,
          value,
        ),
      ];
    }

    return [];
  }

  /**
   * Validate conditional rule
   */
  private async validateConditional(
    record: Record<string, any>,
    row: number,
    rule: ConditionalRule,
    context: ValidationContext,
    options: ValidationOptions,
  ): Promise<ValidationError[]> {
    try {
      if (rule.condition(record)) {
        const errors: ValidationError[] = [];
        for (const subRule of rule.rules) {
          const subErrors = await this.validateRule(record, row, subRule, context, options);
          errors.push(...subErrors);
        }
        return errors;
      }
    } catch (error) {
      this.logger.error(`Conditional validation failed:`, error);
      return [
        this.createError(
          row,
          rule.field,
          'CONDITIONAL_VALIDATION_ERROR',
          `Conditional validation error: ${error.message}`,
          ErrorSeverity.WARNING,
        ),
      ];
    }

    return [];
  }

  /**
   * Pre-load unique constraint data for batch validation
   */
  private async preloadUniqueConstraints(
    records: Record<string, any>[],
    rules: AnyValidationRule[],
    context: ValidationContext,
  ): Promise<void> {
    const uniqueRules = rules.filter(r => r.type === ValidationRuleType.UNIQUE);

    for (const rule of uniqueRules) {
      const values = records
        .map(r => r[rule.field])
        .filter(v => v !== null && v !== undefined && v !== '');

      if (values.length === 0) continue;

      const key = rule.field;
      context.existingData.set(key, new Set());
    }
  }

  /**
   * Get Prisma entity model by name
   */
  private getEntityModel(entityName: string): any {
    const modelName = entityName.toLowerCase();
    return this.prisma[modelName];
  }

  /**
   * Create validation error
   */
  private createError(
    row: number,
    field: string,
    code: string,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    originalValue?: any,
    expectedFormat?: string,
  ): ValidationError {
    return {
      row,
      column: field,
      field,
      type: ErrorType.VALIDATION,
      severity,
      code,
      message,
      suggestion: this.getSuggestion(code),
      originalValue,
      expectedFormat,
    };
  }

  /**
   * Get suggestion for error code
   */
  private getSuggestion(code: string): string {
    const suggestions: Record<string, string> = {
      REQUIRED_FIELD: 'Provide a non-empty value',
      TYPE_MISMATCH: 'Ensure the value matches the expected data type',
      INVALID_FORMAT: 'Check the format of the value',
      VALUE_TOO_SMALL: 'Increase the value',
      VALUE_TOO_LARGE: 'Decrease the value',
      STRING_TOO_SHORT: 'Add more characters',
      STRING_TOO_LONG: 'Remove some characters',
      DUPLICATE_VALUE: 'Use a unique value',
      FOREIGN_KEY_NOT_FOUND: 'Ensure the referenced record exists',
      INVALID_ENUM_VALUE: 'Use one of the allowed values',
      PATTERN_MISMATCH: 'Check the format requirements',
    };

    return suggestions[code] || 'Review the value and try again';
  }

  /**
   * Generate validation summary
   */
  private generateSummary(
    errors: ValidationError[],
    warnings: ValidationError[],
  ): {
    errorsByType: Record<ErrorType, number>;
    errorsByField: Record<string, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
  } {
    const allIssues = [...errors, ...warnings];

    const errorsByType: Record<ErrorType, number> = {
      VALIDATION: 0,
      CONSTRAINT: 0,
      FORMAT: 0,
      BUSINESS_RULE: 0,
    };

    const errorsByField: Record<string, number> = {};

    const errorsBySeverity: Record<ErrorSeverity, number> = {
      ERROR: 0,
      WARNING: 0,
    };

    for (const issue of allIssues) {
      errorsByType[issue.type] = (errorsByType[issue.type] || 0) + 1;
      errorsByField[issue.field] = (errorsByField[issue.field] || 0) + 1;
      errorsBySeverity[issue.severity] = (errorsBySeverity[issue.severity] || 0) + 1;
    }

    return { errorsByType, errorsByField, errorsBySeverity };
  }
}
