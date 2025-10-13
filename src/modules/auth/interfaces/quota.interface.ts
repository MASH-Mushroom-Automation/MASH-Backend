/**
 * Quota Interfaces for Daily/Monthly Usage Tracking
 *
 * Provides type-safe interfaces for tracking and managing user API quotas
 * beyond per-minute rate limits.
 */

/**
 * Quota period type
 */
export enum QuotaPeriod {
  DAILY = 'daily',
  MONTHLY = 'monthly',
}

/**
 * Quota information for a user
 */
export interface QuotaInfo {
  /**
   * User ID
   */
  userId: string;

  /**
   * Daily quota information
   */
  daily: {
    /**
     * Maximum requests allowed per day
     */
    limit: number;

    /**
     * Requests used today
     */
    used: number;

    /**
     * Requests remaining today
     */
    remaining: number;

    /**
     * Unix timestamp when daily quota resets (midnight UTC)
     */
    resetAt: number;

    /**
     * Whether daily quota is exceeded
     */
    exceeded: boolean;
  };

  /**
   * Monthly quota information
   */
  monthly: {
    /**
     * Maximum requests allowed per month
     */
    limit: number;

    /**
     * Requests used this month
     */
    used: number;

    /**
     * Requests remaining this month
     */
    remaining: number;

    /**
     * Unix timestamp when monthly quota resets (1st of next month)
     */
    resetAt: number;

    /**
     * Whether monthly quota is exceeded
     */
    exceeded: boolean;
  };
}

/**
 * Quota configuration per role
 */
export interface QuotaConfig {
  /**
   * Daily request limit
   */
  dailyLimit: number;

  /**
   * Monthly request limit
   */
  monthlyLimit: number;
}

/**
 * Role-based quota configuration
 */
export const ROLE_QUOTAS: Record<string, QuotaConfig> = {
  SUPER_ADMIN: {
    dailyLimit: 1_000_000, // 1M requests/day (essentially unlimited)
    monthlyLimit: 30_000_000, // 30M requests/month
  },
  ADMIN: {
    dailyLimit: 100_000, // 100K requests/day
    monthlyLimit: 3_000_000, // 3M requests/month
  },
  GROWER: {
    dailyLimit: 20_000, // 20K requests/day
    monthlyLimit: 600_000, // 600K requests/month
  },
  BUYER: {
    dailyLimit: 15_000, // 15K requests/day
    monthlyLimit: 450_000, // 450K requests/month
  },
  USER: {
    dailyLimit: 10_000, // 10K requests/day
    monthlyLimit: 300_000, // 300K requests/month
  },
  GUEST: {
    dailyLimit: 1_000, // 1K requests/day
    monthlyLimit: 30_000, // 30K requests/month
  },
};

/**
 * Get quota configuration for a role
 */
export function getRoleQuota(role: string): QuotaConfig {
  return (
    ROLE_QUOTAS[role] || ROLE_QUOTAS['GUEST'] // Default to GUEST if role not found
  );
}

/**
 * Format quota for logging
 */
export function formatQuotaForLog(quota: QuotaInfo): string {
  return `Daily: ${quota.daily.used}/${quota.daily.limit} (${quota.daily.remaining} remaining), Monthly: ${quota.monthly.used}/${quota.monthly.limit} (${quota.monthly.remaining} remaining)`;
}
