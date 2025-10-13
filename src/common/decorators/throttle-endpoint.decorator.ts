/**
 * Endpoint-Specific Rate Limiting Decorator
 *
 * This decorator allows fine-grained rate limiting based on endpoint categories,
 * providing different limits for expensive vs cheap operations.
 *
 * Categories:
 * - EXPENSIVE: Computationally expensive operations (10 req/min)
 *   Examples: Analytics, reports, aggregations, complex queries
 *
 * - STANDARD: Regular CRUD operations (100 req/min)
 *   Examples: List endpoints, single item lookups, updates
 *
 * - CHEAP: Lightweight operations (1000 req/min)
 *   Examples: Health checks, ping, configuration lookups
 *
 * - UNRESTRICTED: No endpoint-specific limit (inherits role limit only)
 *   Examples: Public static assets, documentation
 *
 * How It Works:
 * 1. Decorator sets metadata on the controller/method
 * 2. CustomThrottlerGuard reads this metadata via Reflector
 * 3. Guard combines endpoint limit with role limit (uses minimum of both)
 * 4. Separate Redis counters track each category independently
 *
 * Usage Examples:
 * ```typescript
 * // Expensive analytics endpoint - 10 req/min max
 * @ThrottleEndpoint('EXPENSIVE')
 * @Get('/analytics/dashboard')
 * async getDashboardStats() {}
 *
 * // Standard CRUD operation - 100 req/min max
 * @ThrottleEndpoint('STANDARD')
 * @Get('/products')
 * async getProducts() {}
 *
 * // Cheap health check - 1000 req/min max
 * @ThrottleEndpoint('CHEAP')
 * @Get('/health')
 * async healthCheck() {}
 *
 * // No decorator = inherits default role limit
 * @Get('/users')
 * async getUsers() {} // Uses role limit only
 * ```
 *
 * Combined Limits Example:
 * - ADMIN user (1000 req/min) calls EXPENSIVE endpoint (10 req/min)
 * - Effective limit: min(1000, 10) = 10 req/min ✅
 * - GUEST user (20 req/min) calls CHEAP endpoint (1000 req/min)
 * - Effective limit: min(20, 1000) = 20 req/min ✅
 *
 * Benefits:
 * 1. **Resource Protection**: Expensive operations get strict limits
 * 2. **User Experience**: Cheap operations have generous limits
 * 3. **Flexibility**: Combine with role-based limits for granular control
 * 4. **Monitoring**: Track usage by endpoint category
 */

import { SetMetadata } from '@nestjs/common';

/**
 * Endpoint category enum
 */
export enum EndpointCategory {
  EXPENSIVE = 'EXPENSIVE', // 10 req/min - Analytics, reports, aggregations
  STANDARD = 'STANDARD', // 100 req/min - Regular CRUD operations
  CHEAP = 'CHEAP', // 1000 req/min - Health checks, lightweight operations
  UNRESTRICTED = 'UNRESTRICTED', // No endpoint limit (role limit only)
}

/**
 * Endpoint limit configuration
 */
export interface EndpointLimit {
  category: EndpointCategory;
  limit: number; // Max requests in time window
  ttl: number; // Time window in milliseconds
  description: string;
}

/**
 * Endpoint category limits
 *
 * All categories use 1-minute windows for consistency with role-based limits.
 */
export const ENDPOINT_LIMITS: Record<EndpointCategory, EndpointLimit> = {
  /**
   * EXPENSIVE - Computationally expensive operations
   * Use case: Analytics dashboards, complex reports, data aggregations
   * Examples:
   * - GET /api/analytics/dashboard (6+ database queries)
   * - GET /api/analytics/revenue-reports (aggregation over time series)
   * - GET /api/reports/user-engagement (complex joins)
   */
  [EndpointCategory.EXPENSIVE]: {
    category: EndpointCategory.EXPENSIVE,
    limit: 10, // 10 requests per minute
    ttl: 60 * 1000, // 1 minute
    description: 'Expensive operation (10 req/min)',
  },

  /**
   * STANDARD - Regular CRUD operations
   * Use case: Standard REST API operations (list, get, create, update, delete)
   * Examples:
   * - GET /api/products (paginated list)
   * - GET /api/orders/:id (single item lookup)
   * - POST /api/products (create operation)
   */
  [EndpointCategory.STANDARD]: {
    category: EndpointCategory.STANDARD,
    limit: 100, // 100 requests per minute
    ttl: 60 * 1000, // 1 minute
    description: 'Standard operation (100 req/min)',
  },

  /**
   * CHEAP - Lightweight operations
   * Use case: Health checks, status endpoints, configuration lookups
   * Examples:
   * - GET /api/health (simple database ping)
   * - GET /api/health/ready (readiness check)
   * - GET /api/system/config (cached configuration)
   */
  [EndpointCategory.CHEAP]: {
    category: EndpointCategory.CHEAP,
    limit: 1000, // 1000 requests per minute
    ttl: 60 * 1000, // 1 minute
    description: 'Lightweight operation (1000 req/min)',
  },

  /**
   * UNRESTRICTED - No endpoint-specific limit
   * Use case: Public static assets, documentation, unrestricted endpoints
   * Note: Role-based limits still apply
   */
  [EndpointCategory.UNRESTRICTED]: {
    category: EndpointCategory.UNRESTRICTED,
    limit: Number.MAX_SAFE_INTEGER, // No endpoint limit
    ttl: 60 * 1000, // 1 minute
    description: 'No endpoint limit (role limit only)',
  },
};

/**
 * Metadata key for storing endpoint category
 */
export const THROTTLE_ENDPOINT_KEY = 'throttle:endpoint';

/**
 * Get endpoint limit configuration by category
 *
 * @param category - Endpoint category (EXPENSIVE, STANDARD, CHEAP, UNRESTRICTED)
 * @returns Endpoint limit configuration
 */
export function getEndpointLimit(category: EndpointCategory): EndpointLimit {
  return ENDPOINT_LIMITS[category];
}

/**
 * Format endpoint limit for logging
 *
 * @param category - Endpoint category
 * @returns Human-readable limit string
 */
export function formatEndpointLimitForLog(category: EndpointCategory): string {
  const limit = ENDPOINT_LIMITS[category];
  return `${limit.description}`;
}

/**
 * ThrottleEndpoint Decorator
 *
 * Apply endpoint-specific rate limiting to a controller method or entire controller.
 *
 * @param category - Endpoint category (EXPENSIVE, STANDARD, CHEAP, UNRESTRICTED)
 *
 * @example
 * ```typescript
 * // Apply to specific method
 * @Controller('analytics')
 * export class AnalyticsController {
 *   @ThrottleEndpoint('EXPENSIVE')
 *   @Get('/dashboard')
 *   async getDashboard() {
 *     // Limited to 10 req/min (or role limit if lower)
 *   }
 * }
 *
 * // Apply to entire controller
 * @ThrottleEndpoint('STANDARD')
 * @Controller('products')
 * export class ProductsController {
 *   // All methods inherit STANDARD limit (100 req/min)
 * }
 * ```
 */
export const ThrottleEndpoint = (
  category: EndpointCategory | keyof typeof EndpointCategory,
) =>
  SetMetadata(
    THROTTLE_ENDPOINT_KEY,
    typeof category === 'string' ? EndpointCategory[category] : category,
  );
