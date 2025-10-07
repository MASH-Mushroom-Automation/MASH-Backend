import { ApiResponse, PaginationMetadata } from './api-response.interface';

/**
 * Paginated Response Interface
 * 
 * Extends ApiResponse with pagination-specific properties
 * 
 * @template T - The type of items in the data array
 */
export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  /**
   * Array of items for the current page
   */
  data: T[];

  /**
   * Pagination metadata (required for paginated responses)
   */
  pagination: PaginationMetadata;
}

/**
 * Helper function to create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  statusCode: number = 200,
  correlationId?: string,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    statusCode,
    data,
    timestamp: new Date().toISOString(),
    correlationId,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}
