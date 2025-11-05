/**
 * Sanitizer Utility
 *
 * Provides functions for sanitizing user inputs
 */

/**
 * Sanitize HTML to prevent XSS attacks
 *
 * @param input - HTML string
 * @returns Sanitized HTML
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize SQL input to prevent SQL injection
 *
 * @param input - SQL string
 * @returns Sanitized SQL
 */
export function sanitizeSql(input: string): string {
  if (!input) return '';

  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}

/**
 * Sanitize object by removing null, undefined, and empty strings
 *
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const sanitized: Partial<T> = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      // Skip null, undefined, and empty strings
      if (value !== null && value !== undefined && value !== '') {
        // Recursively sanitize nested objects
        if (typeof value === 'object' && !Array.isArray(value)) {
          sanitized[key] = sanitizeObject(value) as T[Extract<keyof T, string>];
        } else {
          sanitized[key] = value;
        }
      }
    }
  }

  return sanitized;
}

/**
 * Remove HTML tags from string
 *
 * @param input - String with HTML tags
 * @returns String without HTML tags
 */
export function stripHtmlTags(input: string): string {
  if (!input) return '';

  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize email address
 *
 * @param email - Email address
 * @returns Sanitized email
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';

  return email.trim().toLowerCase();
}

/**
 * Sanitize phone number (remove non-numeric characters)
 *
 * @param phone - Phone number
 * @returns Sanitized phone number
 */
export function sanitizePhone(phone: string): string {
  if (!phone) return '';

  return phone.replace(/\D/g, '');
}

/**
 * Sanitize URL
 *
 * @param url - URL string
 * @returns Sanitized URL
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Trim whitespace from all string properties in an object
 *
 * @param obj - Object to trim
 * @returns Object with trimmed strings
 */
export function trimObject<T extends Record<string, any>>(obj: T): T {
  const trimmed: any = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      if (typeof value === 'string') {
        trimmed[key] = value.trim();
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        trimmed[key] = trimObject(value);
      } else {
        trimmed[key] = value;
      }
    }
  }

  return trimmed as T;
}

/**
 * Escape special characters for regex
 *
 * @param input - String to escape
 * @returns Escaped string
 */
export function escapeRegex(input: string): string {
  if (!input) return '';

  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitize filename
 *
 * @param filename - Filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return '';

  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}
