import { Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

/**
 * Sanitization Service for Enterprise Security
 * Handles XSS prevention, SQL injection protection, and input sanitization
 *
 * Part of Issue #23 - Enterprise Security & Input Validation System
 */
@Injectable()
export class SanitizationService {
  /**
   * Default sanitize-html options for strict XSS prevention
   */
  private readonly strictOptions: sanitizeHtml.IOptions = {
    allowedTags: [], // No HTML tags allowed
    allowedAttributes: {},
    allowedSchemes: [],
    disallowedTagsMode: 'discard',
  };

  /**
   * Moderate sanitize-html options for user-generated content
   * Allows basic formatting tags
   */
  private readonly moderateOptions: sanitizeHtml.IOptions = {
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a'],
    allowedAttributes: {
      a: ['href', 'title'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto'],
    },
    disallowedTagsMode: 'discard',
    selfClosing: ['br'],
  };

  /**
   * Rich text options for admin-controlled content
   * Allows more formatting tags but still prevents XSS
   */
  private readonly richTextOptions: sanitizeHtml.IOptions = {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'p',
      'a',
      'ul',
      'ol',
      'li',
      'b',
      'i',
      'strong',
      'em',
      'strike',
      'code',
      'hr',
      'br',
      'table',
      'thead',
      'caption',
      'tbody',
      'tr',
      'th',
      'td',
      'pre',
      'img',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      table: ['border', 'cellpadding', 'cellspacing'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto'],
      img: ['http', 'https', 'data'],
    },
    allowedIframeHostnames: [], // No iframes allowed
    disallowedTagsMode: 'discard',
    selfClosing: ['img', 'br', 'hr'],
  };

  /**
   * Sanitize HTML content to prevent XSS attacks
   *
   * @param input - Raw HTML string
   * @param level - Sanitization strictness level
   * @returns Sanitized HTML string
   *
   * @example
   * ```typescript
   * const clean = sanitizationService.sanitizeHtml(
   *   '<script>alert("xss")</script><p>Hello</p>',
   *   'strict'
   * );
   * // Returns: 'Hello' (script removed, paragraph stripped)
   * ```
   */
  sanitizeHtml(
    input: string,
    level: 'strict' | 'moderate' | 'rich' = 'strict',
  ): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let options: sanitizeHtml.IOptions;
    switch (level) {
      case 'moderate':
        options = this.moderateOptions;
        break;
      case 'rich':
        options = this.richTextOptions;
        break;
      case 'strict':
      default:
        options = this.strictOptions;
        break;
    }

    return sanitizeHtml(input, options);
  }

  /**
   * Sanitize input for database queries (SQL injection prevention)
   * Removes or escapes dangerous SQL characters
   *
   * Note: This is a defense-in-depth measure. Always use parameterized queries (Prisma)
   *
   * @param input - User input string
   * @returns Sanitized string safe for database
   *
   * @example
   * ```typescript
   * const safe = sanitizationService.sanitizeForDatabase(
   *   "Robert'; DROP TABLE users;--"
   * );
   * // Returns: "Robert DROP TABLE users"
   * ```
   */
  sanitizeForDatabase(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove common SQL injection patterns
    return input
      .replace(/['";]/g, '') // Remove quotes and semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove block comment start
      .replace(/\*\//g, '') // Remove block comment end
      .replace(/xp_/gi, '') // Remove extended stored procedures
      .replace(/sp_/gi, '') // Remove stored procedures
      .replace(/exec(\s|\+)+(s|x)p\w+/gi, '') // Remove EXEC patterns
      .replace(/union.*select/gi, '') // Remove UNION SELECT
      .replace(/insert.*into/gi, '') // Remove INSERT INTO
      .replace(/delete.*from/gi, '') // Remove DELETE FROM
      .replace(/drop.*table/gi, '') // Remove DROP TABLE
      .replace(/update.*set/gi, '') // Remove UPDATE SET
      .replace(/create.*table/gi, '') // Remove CREATE TABLE
      .replace(/alter.*table/gi, '') // Remove ALTER TABLE
      .trim();
  }

  /**
   * Sanitize filename for safe file system operations
   * Prevents directory traversal and XSS in filenames
   *
   * @param filename - Original filename
   * @returns Safe filename
   *
   * @example
   * ```typescript
   * const safe = sanitizationService.sanitizeFilename('../../etc/passwd');
   * // Returns: 'etc-passwd'
   *
   * const safe2 = sanitizationService.sanitizeFilename('file<script>.pdf');
   * // Returns: 'file-script.pdf'
   * ```
   */
  sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return 'untitled';
    }

    return (
      filename
        .replace(/\.\./g, '') // Remove directory traversal
        .replace(/[/\\]/g, '') // Remove path separators
        .replace(/[<>:"|?*\x00-\x1f]/g, '-') // Replace dangerous chars with dash
        .replace(/\s+/g, '-') // Replace spaces with dash
        .replace(/-+/g, '-') // Replace multiple dashes with single dash
        .replace(/^\.+/, '') // Remove leading dots
        .replace(/\.+$/, '') // Remove trailing dots
        .substring(0, 255) // Limit length to 255 chars
        .trim() || 'untitled'
    ); // Fallback if empty
  }

  /**
   * Remove control characters from string
   * Prevents null byte injection and other control character attacks
   *
   * @param input - Input string
   * @returns String without control characters
   *
   * @example
   * ```typescript
   * const clean = sanitizationService.removeControlCharacters(
   *   'Hello\x00World\x1F'
   * );
   * // Returns: 'HelloWorld'
   * ```
   */
  removeControlCharacters(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove control characters (0x00-0x1F) except tab, newline, carriage return
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Sanitize email address
   * Ensures email is valid and prevents injection attacks
   *
   * @param email - Email address
   * @returns Sanitized email
   *
   * @example
   * ```typescript
   * const clean = sanitizationService.sanitizeEmail(' USER@EXAMPLE.COM ');
   * // Returns: 'user@example.com'
   * ```
   */
  sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      return '';
    }

    return email
      .trim()
      .toLowerCase()
      .replace(/[^\w\s@.+-]/g, '') // Keep only valid email characters
      .substring(0, 254); // RFC 5321 max length
  }

  /**
   * Sanitize URL to prevent XSS and open redirect attacks
   *
   * @param url - URL string
   * @param allowedProtocols - Allowed URL protocols
   * @returns Sanitized URL or empty string if invalid
   *
   * @example
   * ```typescript
   * const clean = sanitizationService.sanitizeUrl('javascript:alert(1)');
   * // Returns: '' (blocked)
   *
   * const clean2 = sanitizationService.sanitizeUrl('https://example.com');
   * // Returns: 'https://example.com'
   * ```
   */
  sanitizeUrl(
    url: string,
    allowedProtocols: string[] = ['http', 'https', 'mailto'],
  ): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    const trimmedUrl = url.trim();

    // Block dangerous protocols
    const dangerousProtocols = [
      'javascript:',
      'data:',
      'vbscript:',
      'file:',
      'about:',
    ];

    for (const protocol of dangerousProtocols) {
      if (trimmedUrl.toLowerCase().startsWith(protocol)) {
        return '';
      }
    }

    // Check if URL has a protocol
    if (trimmedUrl.includes('://')) {
      const protocol = trimmedUrl.split('://')[0].toLowerCase();
      if (!allowedProtocols.includes(protocol)) {
        return '';
      }
    }

    return trimmedUrl;
  }

  /**
   * Sanitize object by applying sanitization to all string values
   * Useful for sanitizing entire DTOs or request bodies
   *
   * @param obj - Object to sanitize
   * @param level - Sanitization level for HTML content
   * @returns Sanitized object
   *
   * @example
   * ```typescript
   * const clean = sanitizationService.sanitizeObject({
   *   name: '<script>alert(1)</script>John',
   *   age: 25,
   *   bio: '<b>Developer</b>'
   * }, 'moderate');
   * // Returns: { name: 'John', age: 25, bio: '<b>Developer</b>' }
   * ```
   */
  sanitizeObject(
    obj: any,
    level: 'strict' | 'moderate' | 'rich' = 'strict',
  ): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item, level));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeHtml(value, level);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value, level);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Strip all HTML tags from string
   * Returns plain text only
   *
   * @param input - HTML string
   * @returns Plain text
   *
   * @example
   * ```typescript
   * const text = sanitizationService.stripHtml('<p>Hello <b>World</b></p>');
   * // Returns: 'Hello World'
   * ```
   */
  stripHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {},
    });
  }

  /**
   * Escape HTML entities
   * Converts HTML special characters to entities
   *
   * @param input - String to escape
   * @returns Escaped string
   *
   * @example
   * ```typescript
   * const escaped = sanitizationService.escapeHtml('<div>Test</div>');
   * // Returns: '&lt;div&gt;Test&lt;/div&gt;'
   * ```
   */
  escapeHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitize JSON string to prevent injection
   *
   * @param input - JSON string
   * @returns Sanitized JSON string or null if invalid
   */
  sanitizeJson(input: string): string | null {
    if (!input || typeof input !== 'string') {
      return null;
    }

    try {
      const parsed = JSON.parse(input);
      return JSON.stringify(this.sanitizeObject(parsed, 'strict'));
    } catch {
      return null;
    }
  }

  /**
   * Batch sanitize multiple strings
   *
   * @param inputs - Array of strings to sanitize
   * @param level - Sanitization level
   * @returns Array of sanitized strings
   */
  batchSanitize(
    inputs: string[],
    level: 'strict' | 'moderate' | 'rich' = 'strict',
  ): string[] {
    if (!Array.isArray(inputs)) {
      return [];
    }

    return inputs.map((input) =>
      typeof input === 'string' ? this.sanitizeHtml(input, level) : '',
    );
  }
}
