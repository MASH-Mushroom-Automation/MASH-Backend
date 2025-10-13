import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Prisma Exception Filter
 *
 * Catches Prisma database errors and converts them to user-friendly HTTP responses
 * Features:
 * - Maps Prisma error codes to HTTP status codes
 * - Hides internal database details
 * - Provides helpful error messages
 * - Handles all Prisma error types
 *
 * Common Prisma Error Codes:
 * - P2002: Unique constraint violation
 * - P2025: Record not found
 * - P2003: Foreign key constraint violation
 * - P2016: Query interpretation error
 * - P1001: Connection error
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientInitializationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Get correlation ID from request
    const correlationId = request.headers['x-correlation-id'] as string;

    // Determine status code and message based on Prisma error
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'DATABASE_ERROR';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const result = this.handleKnownRequestError(exception);
      status = result.status;
      message = result.message;
      code = result.code;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
      code = 'VALIDATION_ERROR';
    } else if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Database query failed';
      code = 'UNKNOWN_DATABASE_ERROR';
    } else if (exception instanceof Prisma.PrismaClientRustPanicError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Database engine error';
      code = 'DATABASE_ENGINE_ERROR';
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database connection failed';
      code = 'DATABASE_CONNECTION_ERROR';
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
        type: 'DatabaseError',
        code,
        message,
        // Include Prisma error code in development
        ...(process.env.NODE_ENV === 'development' && {
          prismaCode: (exception as any).code,
        }),
      },
      // Include full error details in development only
      ...(process.env.NODE_ENV === 'development' && {
        details: exception.message,
      }),
    };

    // Log the error
    this.logger.error(`Prisma Error: ${message}`, {
      correlationId,
      path: request.url,
      method: request.method,
      prismaCode: (exception as any).code,
      error: exception.message,
    });

    response.status(status).json(errorOutput);
  }

  /**
   * Handle Prisma known request errors with specific error codes
   */
  private handleKnownRequestError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): {
    status: HttpStatus;
    message: string;
    code: string;
  } {
    switch (exception.code) {
      // Unique constraint violation
      case 'P2002': {
        const target = (exception.meta?.target as string[]) || [];
        const field = target[0] || 'field';
        return {
          status: HttpStatus.CONFLICT,
          message: `A record with this ${field} already exists`,
          code: 'DUPLICATE_ENTRY',
        };
      }

      // Record not found
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          code: 'NOT_FOUND',
        };

      // Foreign key constraint violation
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Related record does not exist',
          code: 'FOREIGN_KEY_VIOLATION',
        };

      // Query interpretation error
      case 'P2016':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid query parameters',
          code: 'INVALID_QUERY',
        };

      // Record required but not found
      case 'P2018':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Required record not found',
          code: 'REQUIRED_RECORD_NOT_FOUND',
        };

      // Input value too long
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Input value too long for field',
          code: 'VALUE_TOO_LONG',
        };

      // Null constraint violation
      case 'P2011':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Required field is missing',
          code: 'NULL_CONSTRAINT_VIOLATION',
        };

      // Missing required value
      case 'P2012':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Missing required value',
          code: 'MISSING_REQUIRED_VALUE',
        };

      // Connection timeout
      case 'P1001':
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Database connection timeout',
          code: 'CONNECTION_TIMEOUT',
        };

      // Connection refused
      case 'P1002':
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Cannot connect to database',
          code: 'CONNECTION_REFUSED',
        };

      // Database not found
      case 'P1003':
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Database not found',
          code: 'DATABASE_NOT_FOUND',
        };

      // Operations timed out
      case 'P1008':
        return {
          status: HttpStatus.REQUEST_TIMEOUT,
          message: 'Database operation timed out',
          code: 'OPERATION_TIMEOUT',
        };

      // Transaction failed
      case 'P2034':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Transaction conflict detected',
          code: 'TRANSACTION_CONFLICT',
        };

      // Default case for unknown Prisma errors
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database operation failed',
          code: 'DATABASE_ERROR',
        };
    }
  }
}
