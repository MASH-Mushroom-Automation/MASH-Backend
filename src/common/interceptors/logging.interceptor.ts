import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Logging Interceptor
 *
 * Features:
 * - Logs all incoming requests
 * - Logs all outgoing responses
 * - Measures request duration
 * - Includes correlation ID
 * - Includes user information
 * - Sanitizes sensitive data
 */

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const { method, url, body, query, params, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'Unknown';
    const correlationId = request['correlationId'] || 'N/A';
    const userId = request['user']?.id || 'Anonymous';

    // Start timer
    const startTime = Date.now();

    // Log incoming request
    this.logger.log(
      `Incoming Request: ${method} ${url} [${correlationId}] [User: ${userId}]`,
    );

    // Log request details in debug mode
    if (process.env.LOG_LEVEL === 'debug') {
      this.logger.debug('Request Details:', {
        method,
        url,
        body: this.sanitizeBody(body),
        query,
        params,
        ip,
        userAgent,
        correlationId,
        userId,
      });
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          // Log successful response
          this.logger.log(
            `Outgoing Response: ${method} ${url} ${statusCode} ${duration}ms [${correlationId}]`,
          );

          // Log response details in debug mode
          if (process.env.LOG_LEVEL === 'debug') {
            this.logger.debug('Response Details:', {
              method,
              url,
              statusCode,
              duration,
              correlationId,
              userId,
              responseSize: JSON.stringify(data || {}).length,
            });
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          // Log error response
          this.logger.error(
            `Error Response: ${method} ${url} ${statusCode} ${duration}ms [${correlationId}]`,
            error.stack,
          );

          // Log error details
          this.logger.error('Error Details:', {
            method,
            url,
            statusCode,
            duration,
            correlationId,
            userId,
            errorName: error.name,
            errorMessage: error.message,
          });
        },
      }),
    );
  }

  /**
   * Sanitize request body to remove sensitive data
   */
  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'accessToken',
      'refreshToken',
    ];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}
