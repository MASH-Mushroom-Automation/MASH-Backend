import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Validation Exception Filter
 *
 * Catches validation errors from class-validator and formats them consistently
 * Features:
 * - Structured validation error messages
 * - Field-level error details
 * - User-friendly error messages
 * - Automatic logging
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Get correlation ID from request
    const correlationId = request.headers['x-correlation-id'] as string;

    // Extract validation errors
    const exceptionResponse: any = exception.getResponse();
    const validationErrors = this.formatValidationErrors(exceptionResponse);

    // Build structured error response
    const errorOutput = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      correlationId,
      error: {
        type: 'ValidationError',
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: validationErrors,
      },
    };

    // Log validation errors
    this.logger.warn('Validation failed', {
      correlationId,
      path: request.url,
      method: request.method,
      errors: validationErrors,
    });

    response.status(status).json(errorOutput);
  }

  /**
   * Format validation errors from class-validator
   */
  private formatValidationErrors(response: any): any {
    // If response has a 'message' array (class-validator format)
    if (response.message && Array.isArray(response.message)) {
      // Check if messages are validation error objects
      if (
        response.message.length > 0 &&
        typeof response.message[0] === 'object'
      ) {
        return this.transformValidationErrors(response.message);
      }

      // If messages are simple strings
      return {
        fields: response.message,
      };
    }

    // If response is already formatted
    if (response.errors) {
      return response.errors;
    }

    // Default format
    return {
      message: response.message || 'Validation failed',
    };
  }

  /**
   * Transform class-validator error objects to user-friendly format
   */
  private transformValidationErrors(errors: any[]): Record<string, any> {
    const formattedErrors: Record<string, any> = {};

    errors.forEach((error) => {
      if (error.property) {
        formattedErrors[error.property] = {
          value: error.value,
          constraints: error.constraints || {},
          messages: Object.values(error.constraints || {}),
        };

        // Handle nested validation errors
        if (error.children && error.children.length > 0) {
          formattedErrors[error.property].children =
            this.transformValidationErrors(error.children);
        }
      }
    });

    return formattedErrors;
  }
}
