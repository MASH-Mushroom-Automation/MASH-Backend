import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../database/redis.service';
import { QuotaInfo, QuotaPeriod, getRoleQuota } from '../interfaces/quota.interface';

/**
 * QuotaService - Daily/Monthly Usage Tracking
 *
 * Implements long-term API usage quotas beyond per-minute rate limits.
 * Provides billing-friendly quota tracking with automatic reset at midnight/month-end.
 *
 * Features:
 * - Daily quotas (resets at midnight UTC)
 * - Monthly quotas (resets on 1st of month)
 * - Role-based quota limits
 * - Redis-backed with automatic TTL
 * - Quota headers in responses
 *
 * Redis Keys:
 * - quota:daily:{userId}:{YYYY-MM-DD} (24-hour TTL)
 * - quota:monthly:{userId}:{YYYY-MM} (30-day TTL)
 *
 * Usage:
 * ```typescript
 * // Check quota before processing request
 * const quotaOk = await quotaService.checkQuota(userId, role);
 * if (!quotaOk) throw new ThrottlerException('Daily quota exceeded');
 *
 * // Get remaining quota for headers
 * const quota = await quotaService.getQuotaInfo(userId, role);
 * response.setHeader('X-RateLimit-Quota-Daily-Remaining', quota.daily.remaining);
 * ```
 */
@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Check if user has quota available for a request
   *
   * @param userId - User ID
   * @param role - User role
   * @param cost - Request cost (default: 1)
   * @returns true if quota available, false if exceeded
   */
  async checkQuota(userId: string, role: string, cost: number = 1): Promise<boolean> {
    const config = getRoleQuota(role);

    // Check daily quota
    const dailyOk = await this.checkDailyQuota(userId, config.dailyLimit, cost);
    if (!dailyOk) {
      this.logger.warn(
        `Daily quota exceeded for user ${userId} (${role}): ${config.dailyLimit} req/day`,
      );
      return false;
    }

    // Check monthly quota
    const monthlyOk = await this.checkMonthlyQuota(userId, config.monthlyLimit, cost);
    if (!monthlyOk) {
      this.logger.warn(
        `Monthly quota exceeded for user ${userId} (${role}): ${config.monthlyLimit} req/month`,
      );
      return false;
    }

    return true;
  }

  /**
   * Get quota information for a user
   *
   * @param userId - User ID
   * @param role - User role
   * @returns Quota information with daily/monthly limits
   */
  async getQuotaInfo(userId: string, role: string): Promise<QuotaInfo> {
    const config = getRoleQuota(role);

    // Get current usage
    const [dailyUsed, monthlyUsed] = await Promise.all([
      this.getDailyUsage(userId),
      this.getMonthlyUsage(userId),
    ]);

    // Calculate reset times
    const now = new Date();
    const dailyResetAt = this.getNextMidnight(now);
    const monthlyResetAt = this.getNextMonthStart(now);

    // Build quota info
    const quotaInfo: QuotaInfo = {
      userId,
      daily: {
        limit: config.dailyLimit,
        used: dailyUsed,
        remaining: Math.max(0, config.dailyLimit - dailyUsed),
        resetAt: Math.floor(dailyResetAt.getTime() / 1000),
        exceeded: dailyUsed >= config.dailyLimit,
      },
      monthly: {
        limit: config.monthlyLimit,
        used: monthlyUsed,
        remaining: Math.max(0, config.monthlyLimit - monthlyUsed),
        resetAt: Math.floor(monthlyResetAt.getTime() / 1000),
        exceeded: monthlyUsed >= config.monthlyLimit,
      },
    };

    return quotaInfo;
  }

  /**
   * Check daily quota
   */
  private async checkDailyQuota(userId: string, limit: number, cost: number): Promise<boolean> {
    const key = this.getDailyKey(userId);
    const current = await this.incrementQuota(key, cost);

    // Set TTL to expire at midnight (24 hours max)
    const ttl = this.getSecondsUntilMidnight();
    await this.redisService.setExpiration(key, ttl);

    return current <= limit;
  }

  /**
   * Check monthly quota
   */
  private async checkMonthlyQuota(userId: string, limit: number, cost: number): Promise<boolean> {
    const key = this.getMonthlyKey(userId);
    const current = await this.incrementQuota(key, cost);

    // Set TTL to expire at end of month (30 days max)
    const ttl = this.getSecondsUntilMonthEnd();
    await this.redisService.setExpiration(key, ttl);

    return current <= limit;
  }

  /**
   * Get daily usage
   */
  private async getDailyUsage(userId: string): Promise<number> {
    const key = this.getDailyKey(userId);
    const value = await this.redisService.get<string>(key);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Get monthly usage
   */
  private async getMonthlyUsage(userId: string): Promise<number> {
    const key = this.getMonthlyKey(userId);
    const value = await this.redisService.get<string>(key);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Increment quota counter atomically
   */
  private async incrementQuota(key: string, cost: number): Promise<number> {
    // Use INCRBY for atomic increment
    if (cost === 1) {
      return await this.redisService.increment(key);
    } else {
      return await this.redisService.incrementBy(key, cost);
    }
  }

  /**
   * Get Redis key for daily quota
   * Format: quota:daily:{userId}:{YYYY-MM-DD}
   */
  private getDailyKey(userId: string): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `quota:daily:${userId}:${date}`;
  }

  /**
   * Get Redis key for monthly quota
   * Format: quota:monthly:{userId}:{YYYY-MM}
   */
  private getMonthlyKey(userId: string): string {
    const yearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    return `quota:monthly:${userId}:${yearMonth}`;
  }

  /**
   * Get next midnight (for daily reset)
   */
  private getNextMidnight(now: Date): Date {
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Get next month start (for monthly reset)
   */
  private getNextMonthStart(now: Date): Date {
    const nextMonth = new Date(now);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    nextMonth.setUTCDate(1);
    nextMonth.setUTCHours(0, 0, 0, 0);
    return nextMonth;
  }

  /**
   * Get seconds until midnight (for TTL)
   */
  private getSecondsUntilMidnight(): number {
    const now = new Date();
    const midnight = this.getNextMidnight(now);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }

  /**
   * Get seconds until month end (for TTL)
   */
  private getSecondsUntilMonthEnd(): number {
    const now = new Date();
    const monthEnd = this.getNextMonthStart(now);
    return Math.floor((monthEnd.getTime() - now.getTime()) / 1000);
  }

  /**
   * Reset quota for a user (admin function)
   */
  async resetQuota(userId: string, period: QuotaPeriod): Promise<void> {
    if (period === QuotaPeriod.DAILY) {
      const key = this.getDailyKey(userId);
      await this.redisService.delete(key);
      this.logger.log(`Reset daily quota for user ${userId}`);
    } else {
      const key = this.getMonthlyKey(userId);
      await this.redisService.delete(key);
      this.logger.log(`Reset monthly quota for user ${userId}`);
    }
  }
}
