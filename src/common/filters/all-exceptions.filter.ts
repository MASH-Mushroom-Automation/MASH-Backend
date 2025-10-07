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
 * All Exceptions Filter
 * 
 * Catch-all filter for any unhandled exceptions
 * Features:
 * - Catches all unexpected errors
 * - Prevents application crashes
 * - Logs full error details
 * - Returns safe error response to client
 * - Hides sensitive information in production
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Get correlation ID from request
    const correlationId = request.headers['x-correlation-id'] as string;

    // Determine status code
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorType = 'UnknownError';

    // If it's an HttpException, extract status and message
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message;
      errorType = exception.name;
    } else if (exception instanceof Error) {
      message = exception.message;
      errorType = exception.name;
    }

    // Build error response
    const errorOutput = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      correlationId,
      error: {
        type: errorType,
        code: 'INTERNAL_SERVER_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : message,
      },
      // Include stack trace in development only
      ...(process.env.NODE_ENV === 'development' &&
        exception instanceof Error && {
          stack: exception.stack,
          details: {
            name: exception.name,
            message: exception.message,
          },
        }),
    };

    // Log the full error details
    this.logger.error(
      `Unhandled Exception: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
      {
        correlationId,
        path: request.url,
        method: request.method,
        statusCode: status,
        errorType,
        // Log full error object in non-production
        ...(process.env.NODE_ENV !== 'production' && {
          exception: JSON.stringify(exception, null, 2),
        }),
      },
    );

    response.status(status).json(errorOutput);
  }
}
