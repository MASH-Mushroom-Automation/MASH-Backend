import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../services/session.service';

@Injectable()
export class SessionTrackerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SessionTrackerMiddleware.name);

  constructor(private sessionService: SessionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Only track if user is authenticated
      if (!req.user || !req.sessionId) {
        return next();
      }

      // Extract device and IP information
      const deviceInfo = this.extractDeviceInfo(req);

      // Update session activity
      await this.sessionService.updateSessionActivity(req.sessionId);

      // Track session in database (for Phase 2)
      // This will be fully implemented after RBAC migration
      this.logger.debug(
        `Session activity tracked: ${(req.user as any).email || (req.user as any).id} from ${deviceInfo.ipAddress}`,
      );

      next();
    } catch (error) {
      this.logger.error('Session tracking failed:', error);
      // Don't block request on tracking failure
      next();
    }
  }

  /**
   * Extract device and IP information from request
   */
  private extractDeviceInfo(req: Request) {
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '';

    // Parse device type from user agent
    let deviceType = 'desktop';
    if (/mobile/i.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/tablet/i.test(userAgent)) {
      deviceType = 'tablet';
    }

    // Extract browser and OS info
    const deviceName = this.parseDeviceName(userAgent);

    return {
      deviceType,
      deviceName,
      userAgent,
      ipAddress,
      location: undefined, // TODO: Add geolocation lookup in Phase 2
    };
  }

  /**
   * Parse device name from user agent string
   */
  private parseDeviceName(userAgent: string): string {
    if (!userAgent) return 'Unknown Device';

    // Browser detection
    let browser = 'Unknown Browser';
    if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) {
      browser = 'Chrome';
    } else if (/firefox/i.test(userAgent)) {
      browser = 'Firefox';
    } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
      browser = 'Safari';
    } else if (/edge/i.test(userAgent)) {
      browser = 'Edge';
    }

    // OS detection
    let os = 'Unknown OS';
    if (/windows/i.test(userAgent)) {
      os = 'Windows';
    } else if (/mac/i.test(userAgent)) {
      os = 'macOS';
    } else if (/linux/i.test(userAgent)) {
      os = 'Linux';
    } else if (/android/i.test(userAgent)) {
      os = 'Android';
    } else if (/ios|iphone|ipad/i.test(userAgent)) {
      os = 'iOS';
    }

    return `${browser} on ${os}`;
  }
}
