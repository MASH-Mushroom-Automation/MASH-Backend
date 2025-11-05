import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

/**
 * Reusable Swagger decorator for rate limit response headers
 *
 * Adds documentation for rate limiting headers that are returned by the API:
 * - X-RateLimit-Limit: Maximum requests allowed in time window
 * - X-RateLimit-Remaining: Remaining requests in current window
 * - X-RateLimit-Reset: Unix timestamp when rate limit resets
 *
 * @param limit - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 *
 * @example
 * ```typescript
 * @Get()
 * @ApiRateLimit(100, 60000) // 100 requests per minute
 * async findAll() {
 *   // Implementation
 * }
 * ```
 */
export function ApiRateLimit(limit: number, windowMs: number) {
  const windowSeconds = windowMs / 1000;
  const windowMinutes = windowSeconds / 60;
  const windowDisplay =
    windowMinutes >= 1 ? `${windowMinutes} minute(s)` : `${windowSeconds} second(s)`;

  return applyDecorators(
    ApiHeader({
      name: 'X-RateLimit-Limit',
      description: `Maximum ${limit} requests per ${windowDisplay}`,
      required: false,
      schema: {
        type: 'integer',
        example: limit,
      },
    }),
    ApiHeader({
      name: 'X-RateLimit-Remaining',
      description: 'Remaining requests in current time window',
      required: false,
      schema: {
        type: 'integer',
        example: Math.floor(limit / 2),
      },
    }),
    ApiHeader({
      name: 'X-RateLimit-Reset',
      description: 'Unix timestamp (seconds since epoch) when rate limit resets',
      required: false,
      schema: {
        type: 'integer',
        example: Math.floor(Date.now() / 1000) + Math.floor(windowSeconds),
      },
    }),
  );
}
