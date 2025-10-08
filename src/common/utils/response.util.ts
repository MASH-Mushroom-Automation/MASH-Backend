/**
 * Response Utility
 *
 * Provides standardized response formatting
 */

/**
 * Success response format
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * Error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  path?: string;
}

/**
 * Paginated response format
 */
export interface PaginatedResponse<T = any> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
}

/**
 * Create a success response
 *
 * @param data - Response data
 * @param message - Optional success message
 * @returns Success response
 */
export function success<T>(data: T, message?: string): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an error response
 *
 * @param code - Error code
 * @param message - Error message
 * @param details - Additional error details
 * @param path - Request path
 * @returns Error response
 */
export function error(
  code: string,
  message: string,
  details?: any,
  path?: string,
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
    path,
  };
}

/**
 * Create a paginated response
 *
 * @param data - Response data array
 * @param pagination - Pagination metadata
 * @returns Paginated response
 */
export function paginated<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a no content response
 *
 * @param message - Optional message
 * @returns Success response with null data
 */
export function noContent(message?: string): SuccessResponse<null> {
  return {
    success: true,
    data: null,
    message: message || 'Operation completed successfully',
    timestamp: new Date().toISOString(),
  };
}
