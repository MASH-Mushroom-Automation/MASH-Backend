/**
 * Error Response Interface
 * 
 * Standard error response structure for all API errors
 */
export interface ErrorResponse {
  /**
   * Always false for error responses
   */
  success: false;

  /**
   * HTTP status code
   */
  statusCode: number;

  /**
   * Timestamp of the error
   */
  timestamp: string;

  /**
   * Request path where error occurred
   */
  path: string;

  /**
   * HTTP method
   */
  method: string;

  /**
   * Correlation ID for tracking
   */
  correlationId?: string;

  /**
   * Error details
   */
  error: {
    /**
     * Error type/category
     */
    type: string;

    /**
     * Human-readable error message
     */
    message: string;

    /**
     * Error code for client-side handling
     */
    code?: string;

    /**
     * Additional error details (e.g., validation errors)
     */
    details?: any;

    /**
     * Stack trace (only in development)
     */
    stack?: string;
  };
}

/**
 * Validation Error Details
 * Structure for class-validator errors
 */
export interface ValidationErrorDetails {
  [field: string]: {
    value?: any;
    constraints: {
      [constraintName: string]: string;
    };
    messages: string[];
    children?: ValidationErrorDetails;
  };
}

/**
 * Helper function to create an error response
 */
export function createErrorResponse(
  statusCode: number,
  message: string,
  type: string,
  path: string,
  method: string,
  code?: string,
  details?: any,
  stack?: string,
  correlationId?: string,
): ErrorResponse {
  return {
    success: false,
    statusCode,
    timestamp: new Date().toISOString(),
    path,
    method,
    correlationId,
    error: {
      type,
      message,
      code,
      details,
      stack: process.env.NODE_ENV === 'development' ? stack : undefined,
    },
  };
}
