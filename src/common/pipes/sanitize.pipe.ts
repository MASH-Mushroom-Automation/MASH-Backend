import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { SanitizationService } from '../services/sanitization.service';

/**
 * Sanitize Pipe (Enhanced)
 *
 * Sanitizes input data to prevent XSS and SQL injection attacks
 * Now uses SanitizationService for enterprise-grade security
 *
 * Features:
 * - HTML sanitization (XSS prevention)
 * - SQL injection prevention
 * - Control character removal
 * - Trim whitespace
 * - Recursive object sanitization
 * - Configurable sanitization levels
 *
 * Part of Issue #23 - Enterprise Security & Input Validation System
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  constructor(private readonly sanitizationService: SanitizationService) {}

  transform(value: any, metadata: ArgumentMetadata) {
    // Only sanitize body and query parameters
    if (metadata.type !== 'body' && metadata.type !== 'query') {
      return value;
    }

    // Skip if value is null or undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Sanitize based on value type
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return this.sanitizeObject(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.transform(item, metadata));
    }

    return value;
  }

  /**
   * Sanitize string values
   * Uses SanitizationService for comprehensive cleaning
   */
  private sanitizeString(value: string): string {
    // Trim whitespace
    let sanitized = value.trim();

    // Remove control characters
    sanitized = this.sanitizationService.removeControlCharacters(sanitized);

    // Sanitize HTML to prevent XSS (strict mode for safety)
    sanitized = this.sanitizationService.sanitizeHtml(sanitized, 'strict');

    return sanitized;
  }

  /**
   * Sanitize object values recursively
   * Uses SanitizationService for enterprise-grade security
   */
  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    // Use SanitizationService's sanitizeObject method
    // This handles nested objects, arrays, and all string values
    return this.sanitizationService.sanitizeObject(obj, 'strict');
  }
}
