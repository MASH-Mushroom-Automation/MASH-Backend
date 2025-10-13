import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Audit Log Service
 *
 * Provides comprehensive audit logging for security events, user actions,
 * and sensitive operations. Logs are stored in both database and files
 * for redundancy and compliance requirements.
 *
 * Features:
 * - Database logging (Prisma AuditLog model)
 * - File logging (JSON format for backup/compliance)
 * - Automatic log rotation (daily)
 * - Change tracking (old values vs new values)
 * - User context tracking (userId, IP, user agent)
 * - Entity-based filtering (query by entity type/ID)
 * - Compliance support (GDPR, SOC2, HIPAA)
 *
 * Usage:
 * ```typescript
 * await auditLogService.log({
 *   userId: 'user_123',
 *   action: 'LOGIN',
 *   entity: 'User',
 *   entityId: 'user_123',
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...',
 * });
 * ```
 */

export enum AuditAction {
  // Authentication
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',

  // User Management
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_SUSPEND = 'USER_SUSPEND',
  USER_ACTIVATE = 'USER_ACTIVATE',

  // Role & Permission Management
  ROLE_ASSIGN = 'ROLE_ASSIGN',
  ROLE_REVOKE = 'ROLE_REVOKE',
  PERMISSION_GRANT = 'PERMISSION_GRANT',
  PERMISSION_REVOKE = 'PERMISSION_REVOKE',
  ROLE_CREATE = 'ROLE_CREATE',
  ROLE_UPDATE = 'ROLE_UPDATE',
  ROLE_DELETE = 'ROLE_DELETE',

  // Data Access
  DATA_VIEW = 'DATA_VIEW',
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_IMPORT = 'DATA_IMPORT',
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',

  // Configuration Changes
  CONFIG_UPDATE = 'CONFIG_UPDATE',
  SECURITY_SETTING_CHANGE = 'SECURITY_SETTING_CHANGE',

  // System Events
  SYSTEM_START = 'SYSTEM_START',
  SYSTEM_STOP = 'SYSTEM_STOP',
  SYSTEM_ERROR = 'SYSTEM_ERROR',

  // Security Events
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  IP_BLOCKED = 'IP_BLOCKED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
}

export interface AuditLogEntry {
  userId?: string;
  action: AuditAction | string;
  entity: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly logDirectory: string;

  constructor(private readonly prisma: PrismaService) {
    // Initialize log directory (logs/audit)
    this.logDirectory = path.join(process.cwd(), 'logs', 'audit');
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create log directory: ${error.message}`);
    }
  }

  /**
   * Log an audit event to both database and file
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Log to database
      await this.logToDatabase(entry);

      // Log to file (for backup and compliance)
      await this.logToFile(entry);
    } catch (error) {
      this.logger.error(
        `Failed to log audit event: ${error.message}`,
        error.stack,
      );
      // Don't throw - audit logging should never break the app
    }
  }

  /**
   * Log audit event to database
   */
  private async logToDatabase(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          oldValues: entry.oldValues
            ? (entry.oldValues as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          newValues: entry.newValues
            ? (entry.newValues as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log to database: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log audit event to file (JSON format)
   * Files are rotated daily (YYYY-MM-DD.json)
   */
  private async logToFile(entry: AuditLogEntry): Promise<void> {
    try {
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `${date}.json`;
      const filepath = path.join(this.logDirectory, filename);

      const logEntry = {
        timestamp: new Date().toISOString(),
        ...entry,
      };

      // Append to file (one JSON object per line)
      await fs.appendFile(filepath, JSON.stringify(logEntry) + '\n', 'utf-8');
    } catch (error) {
      this.logger.error(`Failed to log to file: ${error.message}`);
      // Don't throw - file logging is secondary
    }
  }

  /**
   * Query audit logs by user ID
   */
  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      actions?: string[];
    },
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        userId,
        timestamp: {
          gte: options?.startDate,
          lte: options?.endDate,
        },
        action: options?.actions ? { in: options.actions } : undefined,
      },
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 100,
    });
  }

  /**
   * Query audit logs by entity
   */
  async findByEntity(
    entity: string,
    entityId?: string,
    options?: {
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        entity,
        entityId,
        timestamp: {
          gte: options?.startDate,
          lte: options?.endDate,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 100,
    });
  }

  /**
   * Query audit logs by action
   */
  async findByAction(
    action: AuditAction | string,
    options?: {
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        action,
        timestamp: {
          gte: options?.startDate,
          lte: options?.endDate,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 100,
    });
  }

  /**
   * Query audit logs by IP address
   */
  async findByIpAddress(
    ipAddress: string,
    options?: {
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        ipAddress,
        timestamp: {
          gte: options?.startDate,
          lte: options?.endDate,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 100,
    });
  }

  /**
   * Get security events (failed logins, rate limits, suspicious activity)
   */
  async getSecurityEvents(options?: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const securityActions = [
      AuditAction.LOGIN_FAILED,
      AuditAction.RATE_LIMIT_EXCEEDED,
      AuditAction.IP_BLOCKED,
      AuditAction.SUSPICIOUS_ACTIVITY,
      AuditAction.UNAUTHORIZED_ACCESS,
    ];

    return this.prisma.auditLog.findMany({
      where: {
        action: { in: securityActions },
        timestamp: {
          gte: options?.startDate,
          lte: options?.endDate,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 100,
    });
  }

  /**
   * Get compliance report (all audit logs for a time period)
   * Used for GDPR, SOC2, HIPAA compliance
   */
  async getComplianceReport(startDate: Date, endDate: Date) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group by action for statistics
    const actionCounts = logs.reduce(
      (acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      period: { startDate, endDate },
      totalEvents: logs.length,
      actionCounts,
      logs,
    };
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const logs = await this.findByUserId(userId, {
      startDate,
      endDate,
      limit: 1000,
    });

    const actionCounts = logs.reduce(
      (acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      userId,
      period: { startDate, endDate },
      totalActions: logs.length,
      actionCounts,
      lastActivity: logs[0]?.timestamp,
      recentLogs: logs.slice(0, 10),
    };
  }

  /**
   * Clean up old audit logs (retention policy)
   * @param daysToKeep Number of days to keep logs (default: 90 days)
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(
      `Deleted ${result.count} audit logs older than ${daysToKeep} days`,
    );
    return result.count;
  }
}
