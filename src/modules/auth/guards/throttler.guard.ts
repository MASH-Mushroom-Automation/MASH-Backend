import {
  Injectable,
  ExecutionContext,
  Logger,
  Inject,
} from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerException,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../database/prisma.service';

/**
 * CustomThrottlerGuard - Rate limiting with database logging
 *
 * Extends @nestjs/throttler's ThrottlerGuard to add:
 * - Database logging of rate limit violations
 * - IP address tracking
 * - User agent tracking
 * - Endpoint tracking
 *
 * Default Configuration (from AppModule):
 * - 100 requests per minute per IP
 * - Logs all violations to RateLimitLog table
 *
 * Usage:
 * Global guard applied in AppModule providers
 *
 * Custom rate limits per route:
 * ```typescript
 * @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
 * @Get('/sensitive-endpoint')
 * async getSensitiveData() {}
 * ```
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(CustomThrottlerGuard.name);

  constructor(
    @Inject('THROTTLER:MODULE_OPTIONS')
    protected readonly options: ThrottlerModuleOptions,
    @Inject(ThrottlerStorage) protected readonly storageService: ThrottlerStorage,
    protected readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Override canActivate to add custom logging on rate limit violations
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { ip, method, url, headers, user } = request;

    try {
      // Call parent implementation (performs rate limit check)
      return await super.canActivate(context);
    } catch (error) {
      // Rate limit exceeded - log to database
      if (error instanceof ThrottlerException) {
        await this.logRateLimitViolation(
          ip || 'unknown',
          method,
          url,
          headers['user-agent'] || 'unknown',
          user?.id,
        );

        this.logger.warn(
          `Rate limit exceeded: ${ip} - ${method} ${url} - User: ${user?.id || 'anonymous'}`,
        );
      }

      throw error;
    }
  }

  /**
   * Log rate limit violation to database
   */
  private async logRateLimitViolation(
    ipAddress: string,
    httpMethod: string,
    endpoint: string,
    userAgent: string,
    userId?: string,
  ): Promise<void> {
    try {
      const identifier = userId || ipAddress;
      const now = new Date();
      const windowStart = new Date(now.getTime() - 60000); // 1 minute ago
      const windowEnd = now;

      await this.prisma.rateLimitLog.upsert({
        where: {
          identifier_endpoint_windowStart: {
            identifier,
            endpoint: endpoint.substring(0, 255),
            windowStart,
          },
        },
        create: {
          identifier,
          endpoint: endpoint.substring(0, 255),
          count: 1,
          windowStart,
          windowEnd,
          blocked: true,
        },
        update: {
          count: { increment: 1 },
          windowEnd,
          blocked: true,
        },
      });

      this.logger.debug(
        `Logged rate limit violation - Identifier: ${identifier}, Endpoint: ${endpoint}`,
      );
    } catch (error) {
      this.logger.error('Failed to log rate limit violation:', error);
      // Don't throw - rate limiting should still work even if logging fails
    }
  }
}
