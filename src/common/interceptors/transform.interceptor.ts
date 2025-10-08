import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';

/**
 * Transform Interceptor
 *
 * Wraps all controller responses in a standard ApiResponse format
 *
 * Features:
 * - Consistent response structure
 * - Adds metadata (timestamp, statusCode, correlationId)
 * - Handles both single and paginated responses
 * - Preserves existing ApiResponse objects
 */

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse();

    const correlationId = request['correlationId'];
    const path = request.url;

    return next.handle().pipe(
      map((data) => {
        // If data is already an ApiResponse, return it as-is
        if (this.isApiResponse(data)) {
          return data;
        }

        // If data is a paginated response (has pagination property)
        if (this.isPaginatedResponse(data)) {
          return {
            success: true,
            statusCode: response.statusCode,
            data: data.data,
            timestamp: new Date().toISOString(),
            path,
            correlationId,
            pagination: data.pagination,
          };
        }

        // Standard response wrapping
        return {
          success: true,
          statusCode: response.statusCode,
          data,
          timestamp: new Date().toISOString(),
          path,
          correlationId,
        };
      }),
    );
  }

  /**
   * Check if data is already an ApiResponse
   */
  private isApiResponse(data: any): data is ApiResponse {
    return (
      data &&
      typeof data === 'object' &&
      'success' in data &&
      'statusCode' in data &&
      'timestamp' in data
    );
  }

  /**
   * Check if data is a paginated response
   */
  private isPaginatedResponse(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      'data' in data &&
      'pagination' in data &&
      Array.isArray(data.data)
    );
  }
}
