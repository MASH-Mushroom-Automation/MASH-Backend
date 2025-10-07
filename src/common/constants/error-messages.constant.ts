/**
 * Error Message Constants
 * 
 * Centralized error message templates for consistency
 */

export const ERROR_MESSAGES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'You are not authorized to access this resource',
  FORBIDDEN: 'You do not have permission to perform this action',
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Your session has expired. Please login again',
  TOKEN_INVALID: 'Invalid authentication token',
  TOKEN_MISSING: 'Authentication token is required',
  SESSION_EXPIRED: 'Your session has expired. Please login again',

  // Validation
  VALIDATION_FAILED: 'Validation failed for the provided data',
  REQUIRED_FIELD: 'This field is required',
  INVALID_FORMAT: 'Invalid format for this field',
  INVALID_EMAIL: 'Invalid email address',
  INVALID_PASSWORD: 'Password does not meet requirements',
  PASSWORDS_DONT_MATCH: 'Passwords do not match',
  INVALID_PHONE: 'Invalid phone number',
  INVALID_DATE: 'Invalid date format',
  INVALID_UUID: 'Invalid UUID format',

  // Resources
  NOT_FOUND: 'The requested resource was not found',
  USER_NOT_FOUND: 'User not found',
  DEVICE_NOT_FOUND: 'Device not found',
  PRODUCT_NOT_FOUND: 'Product not found',
  ORDER_NOT_FOUND: 'Order not found',
  CATEGORY_NOT_FOUND: 'Category not found',

  // Conflicts
  ALREADY_EXISTS: 'This resource already exists',
  EMAIL_ALREADY_EXISTS: 'This email is already registered',
  USERNAME_ALREADY_EXISTS: 'This username is already taken',
  DUPLICATE_ENTRY: 'Duplicate entry detected',

  // Database
  DATABASE_ERROR: 'A database error occurred',
  CONNECTION_FAILED: 'Failed to connect to database',
  TRANSACTION_FAILED: 'Transaction failed',
  CONSTRAINT_VIOLATION: 'Database constraint violation',

  // Server
  INTERNAL_ERROR: 'An internal server error occurred',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  TIMEOUT: 'Request timeout',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later',

  // Operations
  CREATE_FAILED: 'Failed to create resource',
  UPDATE_FAILED: 'Failed to update resource',
  DELETE_FAILED: 'Failed to delete resource',
  OPERATION_FAILED: 'Operation failed',

  // File Upload
  FILE_TOO_LARGE: 'File size exceeds maximum limit',
  INVALID_FILE_TYPE: 'Invalid file type',
  UPLOAD_FAILED: 'File upload failed',

  // Business Logic
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  INVALID_OPERATION: 'Invalid operation',
  OPERATION_NOT_ALLOWED: 'This operation is not allowed',
  RESOURCE_LOCKED: 'Resource is currently locked',
} as const;

/**
 * Error Code Constants
 * Machine-readable error codes for client-side handling
 */
export const ERROR_CODES = {
  // Authentication & Authorization (1xxx)
  UNAUTHORIZED: 'ERR_1000',
  FORBIDDEN: 'ERR_1001',
  INVALID_CREDENTIALS: 'ERR_1002',
  TOKEN_EXPIRED: 'ERR_1003',
  TOKEN_INVALID: 'ERR_1004',
  TOKEN_MISSING: 'ERR_1005',
  SESSION_EXPIRED: 'ERR_1006',

  // Validation (2xxx)
  VALIDATION_FAILED: 'ERR_2000',
  REQUIRED_FIELD: 'ERR_2001',
  INVALID_FORMAT: 'ERR_2002',
  INVALID_EMAIL: 'ERR_2003',
  INVALID_PASSWORD: 'ERR_2004',
  PASSWORDS_DONT_MATCH: 'ERR_2005',

  // Resources (3xxx)
  NOT_FOUND: 'ERR_3000',
  USER_NOT_FOUND: 'ERR_3001',
  DEVICE_NOT_FOUND: 'ERR_3002',
  PRODUCT_NOT_FOUND: 'ERR_3003',
  ORDER_NOT_FOUND: 'ERR_3004',

  // Conflicts (4xxx)
  ALREADY_EXISTS: 'ERR_4000',
  EMAIL_ALREADY_EXISTS: 'ERR_4001',
  USERNAME_ALREADY_EXISTS: 'ERR_4002',
  DUPLICATE_ENTRY: 'ERR_4003',

  // Database (5xxx)
  DATABASE_ERROR: 'ERR_5000',
  CONNECTION_FAILED: 'ERR_5001',
  TRANSACTION_FAILED: 'ERR_5002',
  CONSTRAINT_VIOLATION: 'ERR_5003',

  // Server (6xxx)
  INTERNAL_ERROR: 'ERR_6000',
  SERVICE_UNAVAILABLE: 'ERR_6001',
  TIMEOUT: 'ERR_6002',
  TOO_MANY_REQUESTS: 'ERR_6003',

  // Operations (7xxx)
  CREATE_FAILED: 'ERR_7000',
  UPDATE_FAILED: 'ERR_7001',
  DELETE_FAILED: 'ERR_7002',
  OPERATION_FAILED: 'ERR_7003',
} as const;

/**
 * Helper function to get error message by code
 */
export function getErrorMessage(code: keyof typeof ERROR_CODES): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.INTERNAL_ERROR;
}
