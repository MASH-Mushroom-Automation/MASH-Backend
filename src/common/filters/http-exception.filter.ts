import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * HTTP Exception Filter
 * 
 * Catches all HttpException instances and formats them consistently
 * Features:
 * - Structured error response
 * - Correlation ID tracking
 * - Environment-aware error details
 * - Automatic logging
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Extract error message and details
    const errorResponse =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : (exceptionResponse as any);

    // Get correlation ID from request (set by middleware)
    const correlationId = request.headers['x-correlation-id'] as string;

    // Build structured error response
    const errorOutput = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      correlationId,
      error: {
        type: exception.name,
        message: errorResponse.message || exception.message,
        ...(errorResponse.error && { code: errorResponse.error }),
        ...(errorResponse.errors && { details: errorResponse.errors }),
      },
      // Include stack trace in development only
      ...(process.env.NODE_ENV === 'development' && {
        stack: exception.stack,
      }),
    };

    // Log the error
    this.logger.error(
      `HTTP ${status} Error: ${errorResponse.message || exception.message}`,
      {
        correlationId,
        path: request.url,
        method: request.method,
        statusCode: status,
        ...(process.env.NODE_ENV === 'development' && {
          stack: exception.stack,
        }),
      },
    );

    response.status(status).json(errorOutput);
  }
}
