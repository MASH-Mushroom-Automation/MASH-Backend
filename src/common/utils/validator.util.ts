/**
 * Validator Utility
 * 
 * Provides custom validation functions
 */

/**
 * Check if value is a valid UUID
 * 
 * @param value - Value to check
 * @returns Boolean
 */
export function isUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Check if value is a valid email
 * 
 * @param value - Value to check
 * @returns Boolean
 */
export function isEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Check if value is a valid phone number
 * 
 * @param value - Value to check
 * @returns Boolean
 */
export function isPhoneNumber(value: string): boolean {
  const phoneRegex = /^\+?[\d\s\-()]+$/;
  return phoneRegex.test(value) && value.replace(/\D/g, '').length >= 10;
}

/**
 * Check if value is a valid URL
 * 
 * @param value - Value to check
 * @returns Boolean
 */
export function isURL(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if value is a strong password
 * (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)
 * 
 * @param value - Value to check
 * @returns Boolean
 */
export function isStrongPassword(value: string): boolean {
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongPasswordRegex.test(value);
}

/**
 * Check if value is a valid date string
 * 
 * @param value - Value to check
 * @returns Boolean
 */
export function isDateString(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Check if value is in the future
 * 
 * @param value - Date string or Date object
 * @returns Boolean
 */
export function isFutureDate(value: string | Date): boolean {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.getTime() > Date.now();
}

/**
 * Check if value is in the past
 * 
 * @param value - Date string or Date object
 * @returns Boolean
 */
export function isPastDate(value: string | Date): boolean {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.getTime() < Date.now();
}

/**
 * Check if value is a valid JSON string
 * 
 * @param value - Value to check
 * @returns Boolean
 */
export function isJSON(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if value is a valid MongoDB ObjectId
 * 
 * @param value - Value to check
 * @returns Boolean
 */
export function isObjectId(value: string): boolean {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(value);
}

/**
 * Check if string contains only alphanumeric characters
 * 
 * @param value - Value to check
 * @returns Boolean
 */
export function isAlphanumeric(value: string): boolean {
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  return alphanumericRegex.test(value);
}

/**
 * Check if value is within range
 * 
 * @param value - Number to check
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Boolean
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Check if array has minimum length
 * 
 * @param arr - Array to check
 * @param min - Minimum length
 * @returns Boolean
 */
export function hasMinLength<T>(arr: T[], min: number): boolean {
  return arr.length >= min;
}

/**
 * Check if array has maximum length
 * 
 * @param arr - Array to check
 * @param max - Maximum length
 * @returns Boolean
 */
export function hasMaxLength<T>(arr: T[], max: number): boolean {
  return arr.length <= max;
}

/**
 * Check if value is a valid credit card number (Luhn algorithm)
 * 
 * @param value - Credit card number
 * @returns Boolean
 */
export function isCreditCard(value: string): boolean {
  const sanitized = value.replace(/\D/g, '');
  
  if (sanitized.length < 13 || sanitized.length > 19) {
    return false;
  }
  
  let sum = 0;
  let isEven = false;
  
  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized.charAt(i), 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

/**
 * Check if value matches pattern
 * 
 * @param value - Value to check
 * @param pattern - Regex pattern
 * @returns Boolean
 */
export function matchesPattern(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}
