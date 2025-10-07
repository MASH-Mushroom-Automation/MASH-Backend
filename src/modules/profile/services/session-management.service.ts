import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SessionStatus } from '@prisma/client';

@Injectable()
export class SessionManagementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        status: SessionStatus.ACTIVE,
        expiresAt: {
          gte: new Date(), // Only return non-expired sessions
        },
      },
      select: {
        id: true,
        clerkSessionId: true,
        token: true,
        deviceInfo: true,
        ipAddress: true,
        userAgent: true,
        lastActivity: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: {
        lastActivity: 'desc',
      },
    });

    // Mask session tokens (show last 8 characters only)
    return sessions.map((session) => ({
      ...session,
      token: this.maskToken(session.token),
      isCurrent: false, // Will be set by controller based on current session
    }));
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionId?: string,
    reason?: string,
  ) {
    // Find the session
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, status: true },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    // Verify ownership
    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to revoke this session',
      );
    }

    // Prevent revoking current session
    if (currentSessionId && sessionId === currentSessionId) {
      throw new BadRequestException(
        'Cannot revoke current session. Use logout endpoint instead',
      );
    }

    // Check if already revoked
    if (session.status === SessionStatus.REVOKED) {
      throw new BadRequestException('Session is already revoked');
    }

    // Revoke the session
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: reason || 'Revoked by user',
      },
    });

    return {
      message: 'Session revoked successfully',
      sessionId,
    };
  }

  /**
   * Revoke all sessions except the current one
   */
  async revokeAllSessions(userId: string, currentSessionId?: string) {
    // Build where clause
    const whereClause: any = {
      userId,
      status: SessionStatus.ACTIVE,
    };

    // Exclude current session if provided
    if (currentSessionId) {
      whereClause.id = {
        not: currentSessionId,
      };
    }

    // Count sessions to be revoked
    const sessionsToRevoke = await this.prisma.session.count({
      where: whereClause,
    });

    if (sessionsToRevoke === 0) {
      return {
        message: 'No active sessions to revoke',
        count: 0,
      };
    }

    // Revoke all sessions except current
    await this.prisma.session.updateMany({
      where: whereClause,
      data: {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: 'Logged out from all devices by user',
      },
    });

    return {
      message: `Logged out from ${sessionsToRevoke} device(s)`,
      count: sessionsToRevoke,
    };
  }

  /**
   * Get session count statistics
   */
  async getSessionStats(userId: string) {
    const [activeCount, totalCount, revokedCount] = await Promise.all([
      this.prisma.session.count({
        where: {
          userId,
          status: SessionStatus.ACTIVE,
          expiresAt: { gte: new Date() },
        },
      }),
      this.prisma.session.count({
        where: { userId },
      }),
      this.prisma.session.count({
        where: {
          userId,
          status: SessionStatus.REVOKED,
        },
      }),
    ]);

    return {
      active: activeCount,
      total: totalCount,
      revoked: revokedCount,
      expired: totalCount - activeCount - revokedCount,
    };
  }

  /**
   * Find current session by token or Clerk session ID
   */
  async findSessionByToken(token: string) {
    return this.prisma.session.findUnique({
      where: { token },
      select: { id: true, userId: true, status: true },
    });
  }

  async findSessionByClerkId(clerkSessionId: string) {
    return this.prisma.session.findUnique({
      where: { clerkSessionId },
      select: { id: true, userId: true, status: true },
    });
  }

  /**
   * Mask session token (show last 8 characters)
   */
  private maskToken(token: string): string {
    if (token.length <= 8) return '***';
    return `***${token.slice(-8)}`;
  }

  /**
   * Parse device info from JSON
   */
  parseDeviceInfo(deviceInfo: any): {
    browser?: string;
    os?: string;
    deviceType?: string;
  } {
    if (!deviceInfo) return {};

    try {
      const info = typeof deviceInfo === 'string' ? JSON.parse(deviceInfo) : deviceInfo;
      return {
        browser: info.browser || 'Unknown',
        os: info.os || 'Unknown',
        deviceType: info.deviceType || 'Unknown',
      };
    } catch {
      return {};
    }
  }
}
