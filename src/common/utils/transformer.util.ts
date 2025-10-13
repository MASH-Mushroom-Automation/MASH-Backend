/**
 * Transformer Utility
 *
 * Provides functions for transforming data between formats
 */

import {
  ClassConstructor,
  plainToClass,
  classToPlain,
} from 'class-transformer';

/**
 * Transform plain object to DTO class instance
 *
 * @param cls - DTO class
 * @param plain - Plain object
 * @returns DTO instance
 */
export function toDto<T, V>(cls: ClassConstructor<T>, plain: V): T {
  return plainToClass(cls, plain, { excludeExtraneousValues: true });
}

/**
 * Transform array of plain objects to DTO class instances
 *
 * @param cls - DTO class
 * @param plain - Array of plain objects
 * @returns Array of DTO instances
 */
export function toDtoArray<T, V>(cls: ClassConstructor<T>, plain: V[]): T[] {
  return plain.map((item) => toDto(cls, item));
}

/**
 * Transform DTO instance to plain object
 *
 * @param dto - DTO instance
 * @returns Plain object
 */
export function toPlain<T>(dto: T): Record<string, any> {
  return classToPlain(dto);
}

/**
 * Exclude specific properties from object
 *
 * @param obj - Object
 * @param keys - Keys to exclude
 * @returns Object without excluded keys
 */
export function exclude<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };

  keys.forEach((key) => {
    delete result[key];
  });

  return result;
}

/**
 * Pick specific properties from object
 *
 * @param obj - Object
 * @param keys - Keys to pick
 * @returns Object with only picked keys
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result: any = {};

  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });

  return result;
}

/**
 * Transform camelCase to snake_case
 *
 * @param str - camelCase string
 * @returns snake_case string
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Transform snake_case to camelCase
 *
 * @param str - snake_case string
 * @returns camelCase string
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Transform object keys to camelCase
 *
 * @param obj - Object with snake_case keys
 * @returns Object with camelCase keys
 */
export function keysToCamel<T extends Record<string, any>>(obj: T): any {
  const result: any = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const camelKey = snakeToCamel(key);
      const value = obj[key];

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        result[camelKey] = keysToCamel(value);
      } else if (Array.isArray(value)) {
        result[camelKey] = value.map((item) =>
          typeof item === 'object' && item !== null ? keysToCamel(item) : item,
        );
      } else {
        result[camelKey] = value;
      }
    }
  }

  return result;
}

/**
 * Transform object keys to snake_case
 *
 * @param obj - Object with camelCase keys
 * @returns Object with snake_case keys
 */
export function keysToSnake<T extends Record<string, any>>(obj: T): any {
  const result: any = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const snakeKey = camelToSnake(key);
      const value = obj[key];

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        result[snakeKey] = keysToSnake(value);
      } else if (Array.isArray(value)) {
        result[snakeKey] = value.map((item) =>
          typeof item === 'object' && item !== null ? keysToSnake(item) : item,
        );
      } else {
        result[snakeKey] = value;
      }
    }
  }

  return result;
}

/**
 * Deep clone an object
 *
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge two objects
 *
 * @param target - Target object
 * @param source - Source object
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}
