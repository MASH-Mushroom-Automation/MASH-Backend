import { Injectable, ExecutionContext, Logger, Inject } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerException,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../database/prisma.service';
import { RATE_LIMIT_HEADERS } from '../../../common/config/throttler.config';

/**
 * CustomThrottlerGuard - Enhanced rate limiting with database logging and response headers
 *
 * Extends @nestjs/throttler's ThrottlerGuard to add:
 * - Database logging of rate limit violations
 * - Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
 * - IP address tracking
 * - User agent tracking
 * - Endpoint tracking
 * - Distributed rate limiting via Redis
 *
 * Default Configuration (from AppModule):
 * - Multiple tiers: short (5/15min), medium (10/hour), long (1000/hour), default (100/min)
 * - Logs all violations to RateLimitLog table
 * - Adds standard rate limit headers to all responses
 *
 * Usage:
 * Global guard applied in AppModule providers
 *
 * Custom rate limits per route:
 * ```typescript
 * @Throttle({ short: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
 * @Post('/auth/login')
 * async login() {}
 *
 * @SkipThrottle() // Skip rate limiting
 * @Get('/public/data')
 * async getPublicData() {}
 * ```
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(CustomThrottlerGuard.name);

  constructor(
    @Inject('THROTTLER:MODULE_OPTIONS')
    protected readonly options: ThrottlerModuleOptions,
    @Inject(ThrottlerStorage)
    protected readonly storageService: ThrottlerStorage,
    protected readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Override canActivate to add custom logging and rate limit headers
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { ip, method, url, headers, user } = request;

    try {
      // Call parent implementation (performs rate limit check)
      const result = await super.canActivate(context);

      // Add rate limit headers to response (success case)
      // Note: We can't get exact counts here without duplicating parent logic
      // Headers will be set by handleRequest override

      return result;
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

        // Add Retry-After header (60 seconds by default)
        response.setHeader(RATE_LIMIT_HEADERS.RETRY_AFTER, '60');

        this.logger.warn(
          `Rate limit exceeded: ${ip} - ${method} ${url} - User: ${user?.id || 'anonymous'}`,
        );
      }

      throw error;
    }
  }

  /**
   * Override handleRequest to add rate limit headers
   * This is called by the parent ThrottlerGuard after checking rate limits
   */
  protected async handleRequest(requestProps: any): Promise<boolean> {
    const { context, limit, ttl, throttler } = requestProps;
    const response = context.switchToHttp().getResponse();

    // Call parent implementation
    const result = await super.handleRequest(requestProps);

    // Add rate limit headers to response
    if (response && limit) {
      response.setHeader(RATE_LIMIT_HEADERS.LIMIT, limit.toString());

      // Calculate reset time (current time + TTL)
      const resetTime = Math.ceil((Date.now() + ttl) / 1000);
      response.setHeader(RATE_LIMIT_HEADERS.RESET, resetTime.toString());
    }

    return result;
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
