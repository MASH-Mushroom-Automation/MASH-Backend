import { Injectable, LoggerService } from '@nestjs/common';
import { Logger } from 'winston';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

/**
 * Custom Logger Utility
 *
 * Features:
 * - Extends NestJS LoggerService
 * - Adds context to all logs
 * - Supports correlation ID
 * - Performance logging
 * - Request/response logging
 * - Structured logging
 *
 * Note: Using default scope (SINGLETON) to allow app.get() in main.ts
 */

@Injectable()
export class CustomLogger implements LoggerService {
  private context?: string;

  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  /**
   * Set the logging context (e.g., class name)
   */
  setContext(context: string) {
    this.context = context;
  }

  /**
   * Log a message at 'log' level
   */
  log(message: string, context?: string) {
    this.logger.info(message, { context: context || this.context });
  }

  /**
   * Log an error message
   */
  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, {
      context: context || this.context,
      trace,
    });
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: string) {
    this.logger.warn(message, { context: context || this.context });
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: string) {
    this.logger.debug(message, { context: context || this.context });
  }

  /**
   * Log a verbose message
   */
  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context: context || this.context });
  }

  /**
   * Log HTTP request details
   */
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    correlationId?: string,
    userId?: string,
  ) {
    const message = `${method} ${url} ${statusCode} ${duration}ms`;
    this.logger.http(message, {
      context: 'HTTP',
      method,
      url,
      statusCode,
      duration,
      correlationId,
      userId,
    });
  }

  /**
   * Log HTTP response details
   */
  logResponse(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    correlationId?: string,
    userId?: string,
  ) {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const message = `${method} ${url} ${statusCode} ${duration}ms`;

    this.logger.log(level, message, {
      context: 'HTTP',
      method,
      url,
      statusCode,
      duration,
      correlationId,
      userId,
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, duration: number, metadata?: Record<string, any>) {
    const message = `Performance: ${operation} took ${duration}ms`;
    this.logger.info(message, {
      context: 'Performance',
      operation,
      duration,
      ...metadata,
    });
  }

  /**
   * Log database query
   */
  logQuery(query: string, duration: number, params?: any[]) {
    this.logger.debug('Database Query', {
      context: 'Database',
      query,
      duration,
      params,
    });
  }

  /**
   * Log external API call
   */
  logExternalCall(
    service: string,
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    correlationId?: string,
  ) {
    const message = `External API: ${service} ${method} ${url} ${statusCode} ${duration}ms`;
    this.logger.info(message, {
      context: 'ExternalAPI',
      service,
      method,
      url,
      statusCode,
      duration,
      correlationId,
    });
  }

  /**
   * Log authentication event
   */
  logAuth(
    event: 'login' | 'logout' | 'register' | 'token_refresh' | 'password_reset',
    userId?: string,
    email?: string,
    success: boolean = true,
    reason?: string,
  ) {
    const message = `Auth: ${event} ${success ? 'succeeded' : 'failed'}`;
    this.logger.info(message, {
      context: 'Authentication',
      event,
      userId,
      email,
      success,
      reason,
    });
  }

  /**
   * Log business event
   */
  logEvent(event: string, data?: Record<string, any>) {
    this.logger.info(`Event: ${event}`, {
      context: 'Event',
      event,
      ...data,
    });
  }

  /**
   * Log with custom metadata
   */
  logWithMetadata(
    level: 'error' | 'warn' | 'info' | 'debug',
    message: string,
    metadata: Record<string, any>,
  ) {
    this.logger.log(level, message, {
      context: this.context,
      ...metadata,
    });
  }
}

/**
 * Factory function to create logger instance
 */
export function createLogger(logger: Logger, context?: string): CustomLogger {
  const customLogger = new CustomLogger(logger);
  if (context) {
    customLogger.setContext(context);
  }
  return customLogger;
}
