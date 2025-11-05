import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';

/**
 * Violation statistics interface
 */
interface ViolationStats {
  identifier: string;
  totalViolations: number;
  violationsLast24h: number;
  violationsLastHour: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  firstViolation: Date | null;
  lastViolation: Date | null;
}

/**
 * Top violator interface
 */
interface TopViolator {
  identifier: string;
  violationCount: number;
  lastViolationAt: Date;
  topEndpoint: string;
}

/**
 * Abuse pattern interface
 */
interface AbusePattern {
  identifier: string;
  violationCount: number;
  violationsInLast24h: number;
  violationsInLastHour: number;
  suspiciousPatterns: string[];
  riskScore: number; // 0-100
  recommendation: 'MONITOR' | 'WARN' | 'THROTTLE' | 'BLOCK';
}

/**
 * RateLimitAnalyticsService
 *
 * Tracks rate limit violations and abuse patterns using RateLimitLog table
 *
 * Features:
 * - Violation logging
 * - Violation statistics per identifier (userId, IP, API key)
 * - Top violators tracking
 * - Abuse pattern detection with risk scoring
 *
 * Risk Scoring (0-100):
 * - 0-30: Normal usage (MONITOR)
 * - 31-60: Suspicious behavior (WARN)
 * - 61-80: High risk (THROTTLE)
 * - 81-100: Critical risk (BLOCK)
 */
@Injectable()
export class RateLimitAnalyticsService {
  private readonly logger = new Logger(RateLimitAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log rate limit violation
   */
  async logViolation(
    identifier: string, // userId, IP, or API key
    endpoint: string,
    metadata: {
      count?: number;
      currentLimit?: number;
    },
  ): Promise<void> {
    try {
      const now = new Date();
      const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000); // Round to minute
      const windowEnd = new Date(windowStart.getTime() + 60000); // 1 minute window

      await this.prisma.rateLimitLog.create({
        data: {
          identifier,
          endpoint,
          count: metadata.count || 1,
          windowStart,
          windowEnd,
          blocked: true,
        },
      });

      this.logger.debug(`Logged violation for ${identifier} on ${endpoint}`);
    } catch (error) {
      this.logger.error('Failed to log rate limit violation', error);
    }
  }

  /**
   * Get violation statistics for identifier
   */
  async getViolationStats(
    identifier: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ViolationStats> {
    const where: any = { identifier };
    if (startDate || endDate) {
      where.windowStart = {};
      if (startDate) where.windowStart.gte = startDate;
      if (endDate) where.windowStart.lte = endDate;
    }

    const violations = await this.prisma.rateLimitLog.findMany({
      where,
      orderBy: { windowStart: 'asc' },
    });

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const endpointCounts = new Map<string, number>();
    violations.forEach(v => {
      const count = endpointCounts.get(v.endpoint) || 0;
      endpointCounts.set(v.endpoint, count + v.count);
    });

    return {
      identifier,
      totalViolations: violations.length,
      violationsLast24h: violations.filter(v => v.windowStart >= oneDayAgo).length,
      violationsLastHour: violations.filter(v => v.windowStart >= oneHourAgo).length,
      topEndpoints: Array.from(endpointCounts.entries())
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      firstViolation: violations.length > 0 ? violations[0].windowStart : null,
      lastViolation: violations.length > 0 ? violations[violations.length - 1].windowStart : null,
    };
  }

  /**
   * Get recent violations
   */
  async getViolations(identifier?: string, endpoint?: string, limit = 100) {
    const where: any = {};
    if (identifier) where.identifier = identifier;
    if (endpoint) where.endpoint = endpoint;

    return this.prisma.rateLimitLog.findMany({
      where,
      orderBy: { windowStart: 'desc' },
      take: limit,
    });
  }

  /**
   * Get top violators
   */
  async getTopViolators(limit = 20, startDate?: Date, endDate?: Date): Promise<TopViolator[]> {
    const where: any = {};
    if (startDate || endDate) {
      where.windowStart = {};
      if (startDate) where.windowStart.gte = startDate;
      if (endDate) where.windowStart.lte = endDate;
    }

    const violations = await this.prisma.rateLimitLog.findMany({ where });

    // Group by identifier
    const violatorMap = new Map<
      string,
      { count: number; lastDate: Date; endpoints: Map<string, number> }
    >();

    violations.forEach(v => {
      if (!violatorMap.has(v.identifier)) {
        violatorMap.set(v.identifier, {
          count: 0,
          lastDate: v.windowStart,
          endpoints: new Map(),
        });
      }

      const violator = violatorMap.get(v.identifier);
      violator.count += 1;
      if (v.windowStart > violator.lastDate) violator.lastDate = v.windowStart;

      const endpointCount = violator.endpoints.get(v.endpoint) || 0;
      violator.endpoints.set(v.endpoint, endpointCount + 1);
    });

    // Convert to array and sort
    const topViolators = Array.from(violatorMap.entries())
      .map(([identifier, data]) => {
        const topEndpoint = Array.from(data.endpoints.entries()).sort((a, b) => b[1] - a[1])[0][0];
        return {
          identifier,
          violationCount: data.count,
          lastViolationAt: data.lastDate,
          topEndpoint,
        };
      })
      .sort((a, b) => b.violationCount - a.violationCount)
      .slice(0, limit);

    return topViolators;
  }

  /**
   * Detect abuse patterns for identifier
   */
  async detectAbusePattern(identifier: string): Promise<AbusePattern | null> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get violations
    const [totalViolations, violations24h, violationsHour] = await Promise.all([
      this.prisma.rateLimitLog.count({ where: { identifier } }),
      this.prisma.rateLimitLog.count({
        where: { identifier, windowStart: { gte: oneDayAgo } },
      }),
      this.prisma.rateLimitLog.count({
        where: { identifier, windowStart: { gte: oneHourAgo } },
      }),
    ]);

    // No abuse if no violations
    if (totalViolations === 0) return null;

    const suspiciousPatterns: string[] = [];
    let riskScore = 0;

    // High violation rate (>100 in 24h)
    if (violations24h > 100) {
      suspiciousPatterns.push('HIGH_VIOLATION_RATE');
      riskScore += 40;
    } else if (violations24h > 50) {
      suspiciousPatterns.push('ELEVATED_VIOLATION_RATE');
      riskScore += 20;
    }

    // Rapid violations in last hour (>20)
    if (violationsHour > 20) {
      suspiciousPatterns.push('RAPID_VIOLATIONS');
      riskScore += 30;
    } else if (violationsHour > 10) {
      suspiciousPatterns.push('FREQUENT_VIOLATIONS');
      riskScore += 15;
    }

    // Get recent violations for pattern analysis
    const recentViolations = await this.prisma.rateLimitLog.findMany({
      where: { identifier, windowStart: { gte: oneHourAgo } },
      orderBy: { windowStart: 'asc' },
      take: 100,
    });

    // Check for many different endpoints (scraping behavior)
    const uniqueEndpoints = new Set(recentViolations.map(v => v.endpoint)).size;
    if (uniqueEndpoints > 20) {
      suspiciousPatterns.push('API_SCRAPING');
      riskScore += 20;
    }

    // Check for consistent blocking (persistent attacker)
    const blockedRate =
      recentViolations.length > 0
        ? recentViolations.filter(v => v.blocked).length / recentViolations.length
        : 0;
    if (blockedRate > 0.8 && recentViolations.length > 10) {
      suspiciousPatterns.push('PERSISTENT_ATTACKER');
      riskScore += 10;
    }

    // Determine recommendation
    let recommendation: AbusePattern['recommendation'];
    if (riskScore >= 81) recommendation = 'BLOCK';
    else if (riskScore >= 61) recommendation = 'THROTTLE';
    else if (riskScore >= 31) recommendation = 'WARN';
    else recommendation = 'MONITOR';

    return {
      identifier,
      violationCount: totalViolations,
      violationsInLast24h: violations24h,
      violationsInLastHour: violationsHour,
      suspiciousPatterns,
      riskScore: Math.min(100, riskScore),
      recommendation,
    };
  }

  /**
   * Clean up old violation logs (for cron job)
   */
  async cleanupOldViolations(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.rateLimitLog.deleteMany({
      where: {
        windowStart: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(
      `Cleaned up ${result.count} rate limit violation logs older than ${daysToKeep} days`,
    );

    return result.count;
  }
}
