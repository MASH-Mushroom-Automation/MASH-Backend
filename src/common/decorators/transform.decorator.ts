import { Transform as ClassTransformTransform } from 'class-transformer';

/**
 * Transform Decorator
 *
 * Alias for class-transformer's Transform decorator
 * Makes it easier to import and use
 *
 * Usage:
 * @Transform(({ value }) => value.trim())
 * @IsString()
 * name: string;
 *
 * Or with custom function:
 * @Transform(({ value }) => value.toLowerCase())
 * @IsEmail()
 * email: string;
 */
export const Transform = ClassTransformTransform;

/**
 * Common transform functions
 */

/**
 * Trim whitespace from string
 */
export const Trim = () =>
  ClassTransformTransform(({ value }) => {
    return typeof value === 'string' ? value.trim() : value;
  });

/**
 * Convert to lowercase
 */
export const ToLowerCase = () =>
  ClassTransformTransform(({ value }) => {
    return typeof value === 'string' ? value.toLowerCase() : value;
  });

/**
 * Convert to uppercase
 */
export const ToUpperCase = () =>
  ClassTransformTransform(({ value }) => {
    return typeof value === 'string' ? value.toUpperCase() : value;
  });

/**
 * Convert to number
 */
export const ToNumber = () =>
  ClassTransformTransform(({ value }) => {
    return value !== undefined && value !== null ? Number(value) : value;
  });

/**
 * Convert to boolean
 */
export const ToBoolean = () =>
  ClassTransformTransform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return Boolean(value);
  });

/**
 * Convert to Date
 */
export const ToDate = () =>
  ClassTransformTransform(({ value }) => {
    return value ? new Date(value) : value;
  });

/**
 * Parse JSON string
 */
export const ParseJson = () =>
  ClassTransformTransform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  });
