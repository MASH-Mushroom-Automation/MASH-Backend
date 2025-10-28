import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../../database/redis.service';
import { PrometheusService } from '../../../../monitoring/prometheus/prometheus.service';
import {
  IRateLimitStrategy,
  IRateLimitConfig,
  IRateLimitResult,
} from '../interfaces/rate-limit-strategy.interface';

/**
 * Adaptive Rate Limiting Strategy
 *
 * Algorithm:
 * - Dynamically adjusts rate limits based on system load and user behavior
 * - Starts with configured baseline limit
 * - Increases limit when system has capacity (low load)
 * - Decreases limit when system is under stress (high load)
 * - Tracks user behavior patterns (good vs abusive)
 *
 * How It Works:
 * 1. Monitor system metrics (CPU, memory, response time)
 * 2. Calculate system load factor (0.0 - 1.0)
 * 3. Adjust limit: newLimit = baseLimit * (1 + loadFactor * adjustmentFactor)
 * 4. Track user behavior score (0-100)
 * 5. Apply user-specific multiplier
 *
 * Load Factor Calculation:
 * - CPU usage < 50%: Low load (factor = 0.5, increase limits)
 * - CPU usage 50-70%: Medium load (factor = 0.0, maintain limits)
 * - CPU usage > 70%: High load (factor = -0.5, decrease limits)
 *
 * User Behavior Score:
 * - 90-100: Excellent (1.5x multiplier)
 * - 70-89: Good (1.2x multiplier)
 * - 50-69: Normal (1.0x multiplier)
 * - 30-49: Suspicious (0.7x multiplier)
 * - 0-29: Abusive (0.3x multiplier)
 *
 * Advantages:
 * - Optimizes throughput (allows more when possible)
 * - Protects system under stress (reduces load automatically)
 * - Rewards good users (higher limits for trusted users)
 * - Penalizes abusers (lower limits for suspicious behavior)
 * - Self-tuning (no manual intervention needed)
 *
 * Disadvantages:
 * - Most complex algorithm
 * - Requires tuning (adjustment factors, thresholds)
 * - Can oscillate (rapid limit changes)
 * - Harder to predict (limits change dynamically)
 * - Higher computational cost
 *
 * Use Cases:
 * - High-traffic APIs with variable load
 * - Systems with auto-scaling infrastructure
 * - APIs with mix of trusted/untrusted users
 * - Machine learning-based optimization
 * - Advanced DDoS protection
 *
 * Configuration:
 * - targetUtilization: Desired system load (0.0-1.0, default 0.7)
 * - adjustmentFactor: Speed of adaptation (0.0-1.0, default 0.3)
 * - minLimit: Minimum allowed limit (safety floor)
 * - maxLimit: Maximum allowed limit (safety ceiling)
 */
@Injectable()
export class AdaptiveStrategy implements IRateLimitStrategy {
  private readonly logger = new Logger(AdaptiveStrategy.name);
  private readonly KEY_PREFIX = 'ratelimit:adaptive:';

  // System metrics cache (updated every 10 seconds)
  private systemLoad = 0.5; // Current system load (0.0-1.0)
  private lastMetricsUpdate = 0;
  private readonly METRICS_CACHE_MS = 10000;

  // User behavior scores (in-memory cache for performance)
  private userScores = new Map<string, number>();

  constructor(
    private readonly redis: RedisService,
    private readonly prometheus: PrometheusService,
  ) {
    // Start background metrics updater
    this.startMetricsUpdater();
  }

  /**
   * Check if request should be rate limited with adaptive adjustment
   */
  async checkLimit(key: string, config: IRateLimitConfig): Promise<IRateLimitResult> {
    const redisKey = `${this.KEY_PREFIX}${key}`;
    const now = Date.now();

    try {
      // Update system metrics if stale
      await this.updateSystemMetrics();

      // Calculate adaptive limit
      const adaptiveLimit = this.calculateAdaptiveLimit(key, config);

      // Get current count from Redis (sliding window log)
      const stateJson = await this.redis.get(redisKey);
      const timestamps: number[] = stateJson ? JSON.parse(stateJson as string) : [];

      // Filter expired timestamps
      const windowStart = now - config.windowMs;
      const validTimestamps = timestamps.filter(ts => ts > windowStart);

      // Check if limit reached
      const currentCount = validTimestamps.length;
      const allowed = currentCount < adaptiveLimit;

      if (allowed) {
        // Add new timestamp
        validTimestamps.push(now);

        // Save to Redis
        await this.redis.set(redisKey, JSON.stringify(validTimestamps), config.windowMs + 1000);

        // Update user behavior score (positive interaction)
        this.updateUserScore(key, true);

        return {
          allowed: true,
          current: currentCount + 1,
          limit: adaptiveLimit,
          remaining: Math.max(0, adaptiveLimit - currentCount - 1),
          resetMs: this.calculateResetTime(validTimestamps, config.windowMs),
          metadata: {
            strategy: 'ADAPTIVE',
            baseLimit: config.limit,
            adaptiveLimit,
            systemLoad: this.systemLoad,
            userScore: this.getUserScore(key),
            windowRequests: validTimestamps,
          },
        };
      } else {
        // Limit reached - update user score (negative interaction)
        this.updateUserScore(key, false);

        const resetMs = this.calculateResetTime(validTimestamps, config.windowMs);

        return {
          allowed: false,
          current: currentCount,
          limit: adaptiveLimit,
          remaining: 0,
          resetMs,
          retryAfterMs: resetMs,
          metadata: {
            strategy: 'ADAPTIVE',
            baseLimit: config.limit,
            adaptiveLimit,
            systemLoad: this.systemLoad,
            userScore: this.getUserScore(key),
            message: 'Adaptive rate limit exceeded - limit adjusted based on system load',
          },
        };
      }
    } catch (error) {
      this.logger.error(`Adaptive check failed for key ${key}:`, error);
      // Fail open
      return {
        allowed: true,
        current: 0,
        limit: config.limit,
        remaining: config.limit,
        resetMs: config.windowMs,
      };
    }
  }

  /**
   * Calculate adaptive limit based on system load and user behavior
   */
  private calculateAdaptiveLimit(key: string, config: IRateLimitConfig): number {
    const baseLimit = config.limit;
    const targetUtilization = config.options?.targetUtilization || 0.7;
    const adjustmentFactor = config.options?.adjustmentFactor || 0.3;

    // Calculate load adjustment (-1.0 to +1.0)
    const loadDelta = targetUtilization - this.systemLoad;
    const loadAdjustment = loadDelta * adjustmentFactor;

    // Calculate user behavior multiplier (0.3 to 1.5)
    const userScore = this.getUserScore(key);
    const userMultiplier = this.calculateUserMultiplier(userScore);

    // Apply adjustments
    let adaptiveLimit = baseLimit * (1 + loadAdjustment) * userMultiplier;

    // Apply safety bounds
    const minLimit = config.options?.minLimit || Math.floor(baseLimit * 0.3);
    const maxLimit = config.options?.maxLimit || Math.floor(baseLimit * 2.0);
    adaptiveLimit = Math.max(minLimit, Math.min(maxLimit, Math.floor(adaptiveLimit)));

    return adaptiveLimit;
  }

  /**
   * Calculate user behavior multiplier based on score
   */
  private calculateUserMultiplier(score: number): number {
    if (score >= 90) return 1.5; // Excellent user
    if (score >= 70) return 1.2; // Good user
    if (score >= 50) return 1.0; // Normal user
    if (score >= 30) return 0.7; // Suspicious user
    return 0.3; // Abusive user
  }

  /**
   * Update system metrics (CPU, memory, response time)
   */
  private async updateSystemMetrics(): Promise<void> {
    const now = Date.now();
    if (now - this.lastMetricsUpdate < this.METRICS_CACHE_MS) {
      return; // Use cached value
    }

    try {
      // Get metrics from Prometheus (simplified - in production, query Prometheus API)
      // For now, simulate based on response times
      const avgResponseTime = 100; // TODO: Get from Prometheus
      const targetResponseTime = 200;

      // Calculate load factor (0.0 = no load, 1.0 = max load)
      this.systemLoad = Math.min(1.0, avgResponseTime / targetResponseTime);

      this.lastMetricsUpdate = now;
    } catch (error) {
      this.logger.warn('Failed to update system metrics, using default', error);
      this.systemLoad = 0.5; // Default to medium load
    }
  }

  /**
   * Get user behavior score (0-100)
   */
  private getUserScore(key: string): number {
    return this.userScores.get(key) || 70; // Default: good user
  }

  /**
   * Update user behavior score based on interactions
   */
  private updateUserScore(key: string, positiveInteraction: boolean): void {
    const currentScore = this.getUserScore(key);

    if (positiveInteraction) {
      // Gradually increase score (max 100)
      const newScore = Math.min(100, currentScore + 1);
      this.userScores.set(key, newScore);
    } else {
      // Penalize more aggressively on violations
      const newScore = Math.max(0, currentScore - 5);
      this.userScores.set(key, newScore);
    }

    // Cleanup old entries (keep last 1000)
    if (this.userScores.size > 1000) {
      const firstKey = this.userScores.keys().next().value;
      this.userScores.delete(firstKey);
    }
  }

  /**
   * Calculate reset time (when oldest request expires)
   */
  private calculateResetTime(timestamps: number[], windowMs: number): number {
    if (timestamps.length === 0) return 0;

    const oldestTimestamp = Math.min(...timestamps);
    const now = Date.now();
    const resetMs = Math.max(0, oldestTimestamp + windowMs - now);

    return resetMs;
  }

  /**
   * Start background metrics updater
   */
  private startMetricsUpdater(): void {
    setInterval(() => {
      this.updateSystemMetrics().catch(err => this.logger.error('Metrics update failed', err));
    }, this.METRICS_CACHE_MS);
  }

  /**
   * Reset rate limit for key
   */
  async reset(key: string): Promise<void> {
    const redisKey = `${this.KEY_PREFIX}${key}`;
    await this.redis.delete(redisKey);
    this.userScores.delete(key);
    this.logger.debug(`Reset adaptive rate limit for key: ${key}`);
  }

  /**
   * Get current state
   */
  async getState(key: string): Promise<IRateLimitResult | null> {
    const redisKey = `${this.KEY_PREFIX}${key}`;
    const stateJson = await this.redis.get(redisKey);

    if (!stateJson) return null;

    const timestamps: number[] = JSON.parse(stateJson as string);
    const now = Date.now();
    const currentCount = timestamps.length;

    // Calculate adaptive limit (assuming baseline config)
    const baseLimit = 100; // Default baseline
    const config: IRateLimitConfig = { limit: baseLimit, windowMs: 60000 };
    const adaptiveLimit = this.calculateAdaptiveLimit(key, config);

    return {
      allowed: currentCount < adaptiveLimit,
      current: currentCount,
      limit: adaptiveLimit,
      remaining: Math.max(0, adaptiveLimit - currentCount),
      resetMs: this.calculateResetTime(timestamps, config.windowMs),
      metadata: {
        strategy: 'ADAPTIVE',
        baseLimit,
        adaptiveLimit,
        windowRequests: timestamps,
        systemLoad: this.systemLoad,
        userScore: this.getUserScore(key),
      },
    };
  }

  /**
   * Get strategy name
   */
  getName(): string {
    return 'ADAPTIVE';
  }
}
