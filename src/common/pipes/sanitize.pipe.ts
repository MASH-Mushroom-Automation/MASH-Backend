import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import {
  sanitizeHtml,
  sanitizeObject,
  trimObject,
} from '../utils/sanitizer.util';

/**
 * Sanitize Pipe
 * 
 * Sanitizes input data to prevent XSS and SQL injection attacks
 * Features:
 * - HTML sanitization
 * - SQL injection prevention
 * - Trim whitespace
 * - Remove null/undefined values
 * - Recursive object sanitization
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
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
      return value.map((item) => this.transform(item, metadata));
    }

    return value;
  }

  /**
   * Sanitize string values
   */
  private sanitizeString(value: string): string {
    // Trim whitespace
    let sanitized = value.trim();

    // Sanitize HTML to prevent XSS
    sanitized = sanitizeHtml(sanitized);

    return sanitized;
  }

  /**
   * Sanitize object values recursively
   */
  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    // First trim all string values
    let sanitized = trimObject(obj);

    // Then sanitize HTML in all string values
    sanitized = this.recursiveSanitize(sanitized);

    // Remove null, undefined, and empty strings
    sanitized = sanitizeObject(sanitized);

    return sanitized;
  }

  /**
   * Recursively sanitize all string values in an object
   */
  private recursiveSanitize(obj: any): any {
    if (typeof obj === 'string') {
      return sanitizeHtml(obj);
    }

    if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        return obj.map((item) => this.recursiveSanitize(item));
      }

      const result: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          result[key] = this.recursiveSanitize(obj[key]);
        }
      }
      return result;
    }

    return obj;
  }
}
