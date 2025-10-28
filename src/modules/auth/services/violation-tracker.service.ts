import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../database/redis.service';

/**
 * ViolationTrackerService - Progressive Backoff for Rate Limit Violations
 *
 * Tracks rate limit violations per user and calculates progressive backoff penalties.
 * Discourages repeated violations with escalating wait times.
 *
 * Features:
 * - Track violation count per user
 * - Progressive backoff (60s → 600s)
 * - Auto-expire after 1 hour of good behavior
 * - Violation history for admin review
 *
 * Backoff Schedule:
 * - 1st violation: 60 seconds
 * - 2nd violation: 120 seconds
 * - 3rd violation: 300 seconds
 * - 4th+ violations: 600 seconds (10 minutes)
 *
 * Redis Storage:
 * - Key: violations:{userId}
 * - Value: { count, timestamps[], lastViolation }
 * - TTL: 3600s (1 hour) - reset after good behavior
 *
 * Usage:
 * ```typescript
 * // Record violation
 * await violationTracker.recordViolation(userId);
 *
 * // Get backoff time
 * const backoffSeconds = await violationTracker.getBackoffTime(userId);
 * response.setHeader('Retry-After', backoffSeconds);
 *
 * // Check if user is in backoff period
 * const inBackoff = await violationTracker.isInBackoff(userId);
 * ```
 */
@Injectable()
export class ViolationTrackerService {
  private readonly logger = new Logger(ViolationTrackerService.name);

  // Progressive backoff schedule (in seconds)
  private readonly BACKOFF_SCHEDULE = {
    1: 60, // 1st violation: 1 minute
    2: 120, // 2nd violation: 2 minutes
    3: 300, // 3rd violation: 5 minutes
    4: 600, // 4th+ violations: 10 minutes
  };

  // Time window for violation tracking (1 hour)
  private readonly VIOLATION_TTL = 3600; // 1 hour

  // Maximum violations to track
  private readonly MAX_VIOLATIONS = 10;

  constructor(private readonly redisService: RedisService) {}

  /**
   * Record a rate limit violation for a user
   *
   * @param userId - User ID
   * @param identifier - Additional identifier (IP, endpoint)
   * @returns Updated violation count
   */
  async recordViolation(userId: string, identifier?: string): Promise<number> {
    const key = this.getViolationKey(userId);

    // Get existing violations
    const violations = await this.getViolations(userId);

    // Add new violation
    const now = Date.now();
    violations.count += 1;
    violations.timestamps.push(now);
    violations.lastViolation = now;

    // Limit stored timestamps to prevent memory bloat
    if (violations.timestamps.length > this.MAX_VIOLATIONS) {
      violations.timestamps = violations.timestamps.slice(-this.MAX_VIOLATIONS);
    }

    // Store updated violations
    await this.redisService.set(key, violations, this.VIOLATION_TTL);

    this.logger.warn(
      `Rate limit violation recorded for user ${userId} ` +
        `(count: ${violations.count}, backoff: ${this.calculateBackoff(violations.count)}s)` +
        (identifier ? ` - ${identifier}` : ''),
    );

    return violations.count;
  }

  /**
   * Get backoff time in seconds for a user
   *
   * @param userId - User ID
   * @returns Backoff time in seconds
   */
  async getBackoffTime(userId: string): Promise<number> {
    const violations = await this.getViolations(userId);
    return this.calculateBackoff(violations.count);
  }

  /**
   * Check if user is currently in backoff period
   *
   * @param userId - User ID
   * @returns true if in backoff, false otherwise
   */
  async isInBackoff(userId: string): Promise<boolean> {
    const violations = await this.getViolations(userId);

    if (violations.count === 0) {
      return false;
    }

    const backoffSeconds = this.calculateBackoff(violations.count);
    const backoffMs = backoffSeconds * 1000;
    const timeSinceViolation = Date.now() - violations.lastViolation;

    return timeSinceViolation < backoffMs;
  }

  /**
   * Get remaining backoff time in seconds
   *
   * @param userId - User ID
   * @returns Remaining backoff time in seconds (0 if not in backoff)
   */
  async getRemainingBackoff(userId: string): Promise<number> {
    const violations = await this.getViolations(userId);

    if (violations.count === 0) {
      return 0;
    }

    const backoffSeconds = this.calculateBackoff(violations.count);
    const backoffMs = backoffSeconds * 1000;
    const timeSinceViolation = Date.now() - violations.lastViolation;
    const remainingMs = backoffMs - timeSinceViolation;

    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }

  /**
   * Get violation details for a user
   *
   * @param userId - User ID
   * @returns Violation details
   */
  async getViolations(userId: string): Promise<ViolationInfo> {
    const key = this.getViolationKey(userId);
    const data = await this.redisService.get<ViolationInfo>(key);

    return (
      data || {
        count: 0,
        timestamps: [],
        lastViolation: 0,
      }
    );
  }

  /**
   * Clear violations for a user (admin function)
   *
   * @param userId - User ID
   */
  async clearViolations(userId: string): Promise<void> {
    const key = this.getViolationKey(userId);
    await this.redisService.delete(key);
    this.logger.log(`Cleared violations for user ${userId}`);
  }

  /**
   * Calculate backoff time based on violation count
   *
   * @param count - Violation count
   * @returns Backoff time in seconds
   */
  private calculateBackoff(count: number): number {
    if (count === 0) {
      return 0;
    }

    // Use backoff schedule or max for high counts
    const scheduleKey = Math.min(count, 4);
    return this.BACKOFF_SCHEDULE[scheduleKey as keyof typeof this.BACKOFF_SCHEDULE];
  }

  /**
   * Get Redis key for violations
   *
   * @param userId - User ID
   * @returns Redis key
   */
  private getViolationKey(userId: string): string {
    return `violations:${userId}`;
  }
}

/**
 * Violation information stored in Redis
 */
interface ViolationInfo {
  /**
   * Total violation count
   */
  count: number;

  /**
   * Timestamps of recent violations (Unix time in ms)
   */
  timestamps: number[];

  /**
   * Timestamp of last violation (Unix time in ms)
   */
  lastViolation: number;
}
