import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

/**
 * SecurityLogService
 * 
 * Manages security event logging and audit trail.
 * Provides methods to log security events and query security history.
 */
@Injectable()
export class SecurityLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get security log for a user with filters
   * @param userId User ID to get logs for
   * @param filters Optional filters (action, dateFrom, dateTo, severity, page, limit)
   * @returns Paginated security log entries
   */
  async getSecurityLog(userId: string, filters?: {
    action?: string;
    dateFrom?: Date;
    dateTo?: Date;
    severity?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      userId,
    };

    // Filter by action (event name)
    if (filters?.action) {
      where.event = {
        contains: filters.action,
        mode: 'insensitive',
      };
    }

    // Filter by severity
    if (filters?.severity) {
      where.severity = filters.severity;
    }

    // Filter by date range
    if (filters?.dateFrom || filters?.dateTo) {
      where.timestamp = {};
      if (filters.dateFrom) {
        where.timestamp.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.timestamp.lte = filters.dateTo;
      }
    }

    // Execute parallel queries for logs and total count
    const [logs, total] = await Promise.all([
      this.prisma.securityLog.findMany({
        where,
        orderBy: {
          timestamp: 'desc',
        },
        skip,
        take: limit,
        select: {
          id: true,
          event: true,
          severity: true,
          ipAddress: true,
          userAgent: true,
          metadata: true,
          timestamp: true,
        },
      }),
      this.prisma.securityLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Log a security event
   * @param userId User ID (null for system events)
   * @param event Event name (e.g., "LOGIN", "PROFILE_UPDATED")
   * @param severity Severity level (INFO, WARNING, ERROR, CRITICAL)
   * @param metadata Additional event data
   * @param ipAddress Client IP address
   * @param userAgent Client user agent
   */
  async logSecurityEvent(
    userId: string | null,
    event: string,
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL',
    metadata?: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.prisma.securityLog.create({
      data: {
        userId,
        event,
        severity,
        metadata: metadata || {},
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * Get security event statistics for a user
   * @param userId User ID
   * @returns Statistics (total, by severity)
   */
  async getSecurityStats(userId: string) {
    const [total, info, warning, error, critical] = await Promise.all([
      this.prisma.securityLog.count({ where: { userId } }),
      this.prisma.securityLog.count({ where: { userId, severity: 'INFO' } }),
      this.prisma.securityLog.count({ where: { userId, severity: 'WARNING' } }),
      this.prisma.securityLog.count({ where: { userId, severity: 'ERROR' } }),
      this.prisma.securityLog.count({ where: { userId, severity: 'CRITICAL' } }),
    ]);

    return {
      total,
      info,
      warning,
      error,
      critical,
    };
  }

  /**
   * Get recent security events for a user
   * @param userId User ID
   * @param limit Number of events to retrieve (default: 10)
   * @returns Recent security log entries
   */
  async getRecentEvents(userId: string, limit = 10) {
    return this.prisma.securityLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        id: true,
        event: true,
        severity: true,
        timestamp: true,
      },
    });
  }

  /**
   * Delete old security logs (cleanup/retention policy)
   * @param daysToKeep Number of days to keep logs (default: 90)
   * @returns Number of deleted logs
   */
  async cleanupOldLogs(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.securityLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}
