/**
 * Standard API Response Interface
 * 
 * All API responses should follow this structure for consistency
 * 
 * @template T - The type of data being returned
 */
export interface ApiResponse<T = any> {
  /**
   * Indicates if the request was successful
   */
  success: boolean;

  /**
   * HTTP status code
   */
  statusCode: number;

  /**
   * Response data (null if error or no content)
   */
  data: T | null;

  /**
   * Timestamp of the response
   */
  timestamp: string;

  /**
   * Request path
   */
  path?: string;

  /**
   * Correlation ID for request tracking
   */
  correlationId?: string;

  /**
   * Error details (only present if success is false)
   */
  error?: ErrorDetails;

  /**
   * Pagination metadata (only present for paginated responses)
   */
  pagination?: PaginationMetadata;
}

/**
 * Error details structure
 */
export interface ErrorDetails {
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
   * Additional error details
   */
  details?: any;

  /**
   * Stack trace (only in development)
   */
  stack?: string;
}

/**
 * Pagination metadata structure
 */
export interface PaginationMetadata {
  /**
   * Current page number
   */
  page: number;

  /**
   * Number of items per page
   */
  limit: number;

  /**
   * Total number of items
   */
  total: number;

  /**
   * Total number of pages
   */
  totalPages: number;

  /**
   * Whether there is a next page
   */
  hasNext: boolean;

  /**
   * Whether there is a previous page
   */
  hasPrevious: boolean;
}
