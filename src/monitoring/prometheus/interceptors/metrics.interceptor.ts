/**
 * MetricsInterceptor - Automatically track HTTP request metrics
 *
 * This interceptor:
 * - Records all HTTP requests to Prometheus
 * - Tracks request duration
 * - Tracks response status codes
 * - Tracks response sizes
 * - Tracks errors
 *
 * Applied globally to all HTTP endpoints
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PrometheusService } from '../prometheus.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  constructor(private readonly prometheusService: PrometheusService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    const method = request.method;
    const route = this.getRoute(request);

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        const responseSize = this.getResponseSize(data);

        // Record HTTP metrics
        this.prometheusService.recordHttpRequest(
          method,
          route,
          statusCode,
          duration,
          responseSize,
        );

        // Record API endpoint metrics
        const module = this.getModuleFromRoute(route);
        this.prometheusService.recordApiEndpoint(
          module,
          route,
          method,
          duration / 1000, // Convert to seconds
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Record error metrics
        this.prometheusService.recordHttpRequest(
          method,
          route,
          statusCode,
          duration,
        );

        // Record API endpoint error
        const module = this.getModuleFromRoute(route);
        this.prometheusService.recordApiEndpoint(
          module,
          route,
          method,
          duration / 1000,
          {
            type: error.name || 'UnknownError',
          },
        );

        return throwError(() => error);
      }),
    );
  }

  /**
   * Get normalized route path
   * Converts /api/v1/products/123 to /api/v1/products/:id
   */
  private getRoute(request: any): string {
    // Use route pattern if available (NestJS routes)
    if (request.route && request.route.path) {
      return request.route.path;
    }

    // Fallback to URL (may include params)
    return request.url.split('?')[0];
  }

  /**
   * Extract module name from route
   * /api/v1/products -> products
   * /api/v1/orders -> orders
   */
  private getModuleFromRoute(route: string): string {
    const parts = route.split('/').filter((p) => p);

    // Skip 'api' and version (v1, v2, etc.)
    const moduleIndex = parts.findIndex(
      (p) => !['api', 'v1', 'v2', 'v3'].includes(p.toLowerCase()),
    );

    return moduleIndex >= 0 ? parts[moduleIndex] : 'unknown';
  }

  /**
   * Calculate response size in bytes
   */
  private getResponseSize(data: any): number {
    if (!data) return 0;

    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
}
