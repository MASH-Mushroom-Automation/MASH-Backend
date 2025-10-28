import { Injectable } from '@nestjs/common';
import { trace, context, Span, SpanStatusCode } from '@opentelemetry/api';

/**
 * TracingService - Utility service for creating custom spans
 *
 * This service provides helper methods for creating custom spans
 * to trace business operations, database queries, cache operations, etc.
 *
 * Usage Example:
 * ```typescript
 * constructor(private readonly tracingService: TracingService) {}
 *
 * async createOrder(data: CreateOrderDto) {
 *   return this.tracingService.traceOperation('createOrder', async (span) => {
 *     span.setAttribute('order.items', data.items.length);
 *     span.setAttribute('order.total', data.total);
 *
 *     const order = await this.ordersRepository.create(data);
 *     span.setAttribute('order.id', order.id);
 *
 *     return order;
 *   });
 * }
 * ```
 */
@Injectable()
export class TracingService {
  private readonly tracer = trace.getTracer('mash-backend', '1.0.0');

  /**
   * Trace an operation with a custom span
   *
   * @param operationName - Name of the operation (e.g., 'createOrder', 'processPayment')
   * @param operation - Async function to execute within the span
   * @param attributes - Optional attributes to add to the span
   * @returns Result of the operation
   */
  async traceOperation<T>(
    operationName: string,
    operation: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>,
  ): Promise<T> {
    return this.tracer.startActiveSpan(operationName, async span => {
      try {
        // Add custom attributes
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            span.setAttribute(key, value);
          });
        }

        // Execute the operation
        const result = await operation(span);

        // Mark span as successful
        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        // Record the error
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      } finally {
        // End the span
        span.end();
      }
    });
  }

  /**
   * Trace a database operation
   *
   * @param operation - Operation name (e.g., 'findMany', 'create', 'update')
   * @param model - Prisma model name (e.g., 'User', 'Product', 'Order')
   * @param fn - Async function to execute
   * @returns Result of the operation
   */
  async traceDatabaseOperation<T>(
    operation: string,
    model: string,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    return this.traceOperation(`db.${model}.${operation}`, fn, {
      'db.system': 'postgresql',
      'db.operation': operation,
      'db.model': model,
    });
  }

  /**
   * Trace a cache operation
   *
   * @param operation - Operation name (e.g., 'get', 'set', 'del')
   * @param key - Cache key
   * @param fn - Async function to execute
   * @returns Result of the operation
   */
  async traceCacheOperation<T>(
    operation: string,
    key: string,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    return this.traceOperation(`cache.${operation}`, fn, {
      'cache.system': 'redis',
      'cache.operation': operation,
      'cache.key': key,
    });
  }

  /**
   * Trace an external HTTP request
   *
   * @param method - HTTP method
   * @param url - Request URL
   * @param fn - Async function to execute
   * @returns Result of the operation
   */
  async traceHttpRequest<T>(
    method: string,
    url: string,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    return this.traceOperation(`http.${method.toLowerCase()}`, fn, {
      'http.method': method,
      'http.url': url,
    });
  }

  /**
   * Add an event to the current active span
   *
   * @param name - Event name
   * @param attributes - Event attributes
   */
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Set attributes on the current active span
   *
   * @param attributes - Attributes to set
   */
  setAttributes(attributes: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
  }

  /**
   * Get the current trace context
   *
   * @returns Current context
   */
  getCurrentContext() {
    return context.active();
  }

  /**
   * Get the current active span
   *
   * @returns Current span or undefined
   */
  getCurrentSpan(): Span | undefined {
    return trace.getActiveSpan();
  }
}
