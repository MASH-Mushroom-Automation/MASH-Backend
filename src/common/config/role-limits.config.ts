/**
 * Role-Based Rate Limiting Configuration
 *
 * This file defines rate limit tiers based on user roles to provide differentiated
 * API access based on permission levels and subscription tiers.
 *
 * Architecture:
 * - SUPER_ADMIN: Highest limits for system administrators (10,000 req/min)
 * - ADMIN: High limits for organization administrators (1,000 req/min)
 * - USER: Standard limits for authenticated users (100 req/min)
 * - GUEST: Lowest limits for unauthenticated users (20 req/min)
 *
 * Benefits:
 * 1. **Fair Resource Allocation**: Power users get higher limits
 * 2. **Abuse Prevention**: Stricter limits for anonymous users
 * 3. **Operational Flexibility**: Admins can perform bulk operations
 * 4. **Security**: Limits brute force attacks on unauthenticated endpoints
 *
 * Usage Example:
 * ```typescript
 * const userRole = user?.role || 'GUEST';
 * const limits = getRoleLimits(userRole);
 * // limits = { limit: 100, ttl: 60000, description: '...' }
 * ```
 *
 * Integration:
 * - Used by CustomThrottlerGuard to select appropriate rate limit tier
 * - Combined with endpoint-specific limits (use minimum of both)
 * - Overrides default throttler configuration when role is detected
 */

import type { UserRole } from '@prisma/client';

export interface RoleLimit {
  role: string;
  limit: number; // Max requests in time window
  ttl: number; // Time window in milliseconds
  description: string;
}

/**
 * Role-based rate limit tiers
 *
 * Each role has:
 * - limit: Maximum number of requests allowed in the time window
 * - ttl: Time window duration in milliseconds
 * - description: Human-readable explanation of the limit
 *
 * Time windows:
 * - All roles use 1-minute windows for consistency
 * - Easier to reason about (requests per minute)
 * - Aligns with industry standards (many APIs use per-minute limits)
 */
export const ROLE_LIMITS: Record<string, RoleLimit> = {
  /**
   * SUPER_ADMIN - System administrators with full access
   * Use case: System maintenance, bulk operations, data migrations
   * Example: Running database scripts, bulk imports, system monitoring
   */
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    limit: 10000, // 10,000 requests per minute
    ttl: 60 * 1000, // 1 minute
    description: 'System administrator (10,000 req/min)',
  },

  /**
   * ADMIN - Organization administrators
   * Use case: User management, reports, analytics, bulk operations
   * Example: Generating monthly reports, managing users, exporting data
   */
  ADMIN: {
    role: 'ADMIN',
    limit: 1000, // 1,000 requests per minute
    ttl: 60 * 1000, // 1 minute
    description: 'Administrator (1,000 req/min)',
  },

  /**
   * GROWER - Growers with device management access
   * Use case: Managing devices, viewing sensor data, placing orders
   * Example: Monitoring farm sensors, configuring devices, ordering supplies
   */
  GROWER: {
    role: 'GROWER',
    limit: 200, // 200 requests per minute
    ttl: 60 * 1000, // 1 minute
    description: 'Grower (200 req/min)',
  },

  /**
   * BUYER - Buyers with marketplace access
   * Use case: Browsing products, placing orders, viewing order history
   * Example: Shopping for products, tracking orders, managing profile
   */
  BUYER: {
    role: 'BUYER',
    limit: 150, // 150 requests per minute
    ttl: 60 * 1000, // 1 minute
    description: 'Buyer (150 req/min)',
  },

  /**
   * USER - Standard authenticated users
   * Use case: Normal application usage, read/write operations
   * Example: Viewing profile, updating settings, browsing data
   */
  USER: {
    role: 'USER',
    limit: 100, // 100 requests per minute
    ttl: 60 * 1000, // 1 minute
    description: 'Authenticated user (100 req/min)',
  },

  /**
   * GUEST - Unauthenticated users
   * Use case: Public endpoints, login, registration, browsing
   * Example: Login page, public product catalog, documentation
   *
   * Security Note: Lower limits prevent brute force attacks and API abuse
   */
  GUEST: {
    role: 'GUEST',
    limit: 20, // 20 requests per minute
    ttl: 60 * 1000, // 1 minute
    description: 'Unauthenticated user (20 req/min)',
  },
} as const;

/**
 * Get rate limits for a specific role
 *
 * @param role - User role from JWT token or 'GUEST' for unauthenticated
 * @returns RoleLimit configuration for the role
 *
 * @example
 * ```typescript
 * const limits = getRoleLimits('ADMIN');
 * // { role: 'ADMIN', limit: 1000, ttl: 60000, description: '...' }
 *
 * const guestLimits = getRoleLimits('GUEST');
 * // { role: 'GUEST', limit: 20, ttl: 60000, description: '...' }
 * ```
 */
export function getRoleLimits(role?: UserRole | 'GUEST'): RoleLimit {
  // Default to GUEST if role is undefined or not found
  const roleKey = role || 'GUEST';

  return ROLE_LIMITS[roleKey] || ROLE_LIMITS.GUEST;
}

/**
 * Get human-readable rate limit description
 *
 * @param role - User role
 * @returns Formatted string describing the rate limit
 *
 * @example
 * ```typescript
 * getRoleLimitDescription('ADMIN');
 * // "Administrator (1,000 req/min)"
 * ```
 */
export function getRoleLimitDescription(role?: UserRole | 'GUEST'): string {
  const limits = getRoleLimits(role);
  return limits.description;
}

/**
 * Check if a role exists in the configuration
 *
 * @param role - Role to check
 * @returns True if role has defined limits
 */
export function hasRoleLimits(role: string): boolean {
  return role in ROLE_LIMITS;
}

/**
 * Get all configured roles (for documentation/testing)
 *
 * @returns Array of all role names with limits
 */
export function getAllRoles(): string[] {
  return Object.keys(ROLE_LIMITS);
}

/**
 * Calculate requests per second for a role (for monitoring)
 *
 * @param role - User role
 * @returns Requests per second (rounded to 2 decimals)
 *
 * @example
 * ```typescript
 * getRequestsPerSecond('ADMIN');
 * // 16.67 (1000 req/min ÷ 60 sec)
 * ```
 */
export function getRequestsPerSecond(role?: UserRole | 'GUEST'): number {
  const limits = getRoleLimits(role);
  const rps = limits.limit / (limits.ttl / 1000);
  return Math.round(rps * 100) / 100; // Round to 2 decimals
}

/**
 * Format rate limit for logging
 *
 * @param role - User role
 * @returns Formatted string for logs
 *
 * @example
 * ```typescript
 * formatRateLimitForLog('ADMIN');
 * // "ADMIN: 1000 req/min (16.67 req/s)"
 * ```
 */
export function formatRateLimitForLog(role?: UserRole | 'GUEST'): string {
  const limits = getRoleLimits(role);
  const rps = getRequestsPerSecond(role);
  return `${limits.role}: ${limits.limit} req/min (${rps} req/s)`;
}
