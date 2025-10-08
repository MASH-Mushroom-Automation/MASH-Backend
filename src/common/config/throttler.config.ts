/**
 * Throttler Configuration - Rate Limiting Tiers
 *
 * Defines multiple rate limiting tiers for different use cases:
 *
 * 1. **SHORT (Aggressive)** - Login/OTP endpoints (brute force prevention)
 *    - 5 requests per 15 minutes
 *    - Use case: Login, OTP verification, password reset
 *
 * 2. **MEDIUM (Moderate)** - Upload/Mutation endpoints (resource protection)
 *    - 10 requests per hour
 *    - Use case: File uploads, data creation, profile updates
 *
 * 3. **LONG (Lenient)** - General API endpoints (DDoS protection)
 *    - 1000 requests per hour
 *    - Use case: Read operations, listings, queries
 *
 * 4. **DEFAULT (Balanced)** - Fallback for unspecified endpoints
 *    - 100 requests per minute
 *    - Use case: All other endpoints
 *
 * Architecture:
 * - Redis-backed distributed rate limiting (works across multiple instances)
 * - Per-IP tracking (can be extended to per-user tracking)
 * - Automatic expiration (TTL-based cleanup)
 * - Graceful degradation (fallback to in-memory if Redis unavailable)
 *
 * Usage:
 * ```typescript
 * // Apply custom tier to specific endpoint
 * @Throttle({ short: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
 * @Post('/auth/login')
 * async login() {}
 *
 * // Apply multiple tiers (most restrictive wins)
 * @Throttle({ short: true, medium: true })
 * @Post('/auth/verify-otp')
 * async verifyOtp() {}
 *
 * // Skip throttling for specific endpoint
 * @SkipThrottle()
 * @Get('/public/data')
 * async getPublicData() {}
 * ```
 *
 * Security Benefits:
 * - **Brute Force Prevention**: Short tier protects login/auth endpoints
 * - **Resource Protection**: Medium tier prevents abuse of expensive operations
 * - **DDoS Mitigation**: Long tier prevents API flooding
 * - **Fair Usage**: Default tier ensures equitable API access
 */

export interface ThrottlerTier {
  name: string;
  ttl: number; // Time window in milliseconds
  limit: number; // Max requests in time window
  description: string;
}

export const THROTTLER_TIERS = {
  /**
   * SHORT - Aggressive rate limiting for authentication endpoints
   * Prevents brute force attacks on login, OTP, password reset
   */
  SHORT: {
    name: 'short',
    ttl: 15 * 60 * 1000, // 15 minutes
    limit: 5,
    description: 'Brute force prevention (5 req / 15 min)',
  } as ThrottlerTier,

  /**
   * MEDIUM - Moderate rate limiting for resource-intensive operations
   * Prevents abuse of file uploads, data mutations, profile updates
   */
  MEDIUM: {
    name: 'medium',
    ttl: 60 * 60 * 1000, // 1 hour
    limit: 10,
    description: 'Resource protection (10 req / hour)',
  } as ThrottlerTier,

  /**
   * LONG - Lenient rate limiting for general API usage
   * Prevents DDoS attacks while allowing normal application usage
   */
  LONG: {
    name: 'long',
    ttl: 60 * 60 * 1000, // 1 hour
    limit: 1000,
    description: 'DDoS protection (1000 req / hour)',
  } as ThrottlerTier,

  /**
   * DEFAULT - Balanced rate limiting for unspecified endpoints
   * Fallback tier when no specific tier is applied
   */
  DEFAULT: {
    name: 'default',
    ttl: 60 * 1000, // 1 minute
    limit: 100,
    description: 'Default rate limit (100 req / min)',
  } as ThrottlerTier,
} as const;

/**
 * Convert throttler tiers to ThrottlerModuleOptions format
 */
export const getThrottlerConfig = () => {
  return [
    {
      name: THROTTLER_TIERS.SHORT.name,
      ttl: THROTTLER_TIERS.SHORT.ttl,
      limit: THROTTLER_TIERS.SHORT.limit,
    },
    {
      name: THROTTLER_TIERS.MEDIUM.name,
      ttl: THROTTLER_TIERS.MEDIUM.ttl,
      limit: THROTTLER_TIERS.MEDIUM.limit,
    },
    {
      name: THROTTLER_TIERS.LONG.name,
      ttl: THROTTLER_TIERS.LONG.ttl,
      limit: THROTTLER_TIERS.LONG.limit,
    },
    {
      name: THROTTLER_TIERS.DEFAULT.name,
      ttl: THROTTLER_TIERS.DEFAULT.ttl,
      limit: THROTTLER_TIERS.DEFAULT.limit,
    },
  ];
};

/**
 * Rate limit headers configuration
 * X-RateLimit-Limit: Maximum number of requests
 * X-RateLimit-Remaining: Number of requests remaining
 * X-RateLimit-Reset: Time when the limit resets (Unix timestamp)
 * Retry-After: Seconds to wait before retrying (on 429)
 */
export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After',
} as const;
