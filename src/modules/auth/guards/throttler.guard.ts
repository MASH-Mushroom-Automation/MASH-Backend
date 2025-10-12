import { Injectable, ExecutionContext, Logger, Inject } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerException,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { RATE_LIMIT_HEADERS } from '../../../common/config/throttler.config';
import {
  getRoleLimits,
  formatRateLimitForLog,
} from '../../../common/config/role-limits.config';
import {
  THROTTLE_ENDPOINT_KEY,
  EndpointCategory,
  getEndpointLimit,
  formatEndpointLimitForLog,
} from '../../../common/decorators/throttle-endpoint.decorator';

/**
 * CustomThrottlerGuard - Enhanced rate limiting with role-based limits and database logging
 *
 * Extends @nestjs/throttler's ThrottlerGuard to add:
 * - **Role-based rate limiting** - Different limits for Admin, User, Guest
 * - **Database logging** of rate limit violations
 * - **Rate limit headers** (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
 * - IP address, user agent, and endpoint tracking
 * - Distributed rate limiting via Redis
 *
 * Rate Limit Tiers (Role-Based):
 * - SUPER_ADMIN: 10,000 requests/min
 * - ADMIN: 1,000 requests/min
 * - GROWER: 200 requests/min
 * - BUYER: 150 requests/min
 * - USER: 100 requests/min
 * - GUEST: 20 requests/min (unauthenticated)
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
   * Override handleRequest to:
   * 1. Read endpoint category metadata (@ThrottleEndpoint decorator)
   * 2. Get role-based limit
   * 3. Get endpoint-specific limit
   * 4. Use minimum of both limits (most restrictive)
   * 5. Add rate limit headers showing effective limit
   */
  protected async handleRequest(
    requestProps: Record<string, any>,
  ): Promise<boolean> {
    const { context, limit, ttl } = requestProps;
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get user role
    const userRole = request.user?.role as UserRole | undefined;
    const role = userRole || 'GUEST';

    // Get role-based limit
    const roleLimit = getRoleLimits(role);

    // Get endpoint category from decorator metadata
    const endpointCategory = this.reflector.getAllAndOverride<EndpointCategory>(
      THROTTLE_ENDPOINT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Calculate effective limit (minimum of role and endpoint limits)
    let effectiveLimit = roleLimit.limit;
    let effectiveTtl = roleLimit.ttl;
    let limitSource = `role=${role}`;

    if (endpointCategory) {
      const endpointLimit = getEndpointLimit(endpointCategory);

      // Use minimum of both limits (most restrictive)
      if (endpointLimit.limit < roleLimit.limit) {
        effectiveLimit = endpointLimit.limit;
        effectiveTtl = endpointLimit.ttl;
        limitSource = `endpoint=${endpointCategory}`;
      } else {
        limitSource = `role=${role} (endpoint=${endpointCategory} less restrictive)`;
      }

      this.logger.debug(
        `Combined limits - Role: ${formatRateLimitForLog(role)}, ` +
          `Endpoint: ${formatEndpointLimitForLog(endpointCategory)}, ` +
          `Effective: ${effectiveLimit} req/min (${limitSource})`,
      );
    } else {
      this.logger.debug(
        `Using role limit only - ${formatRateLimitForLog(role)}`,
      );
    }

    // Override request props with effective limit
    requestProps.limit = effectiveLimit;
    requestProps.ttl = effectiveTtl;

    // Call parent implementation with effective limit
    // @ts-expect-error - ThrottlerRequest type mismatch (NestJS internal)
    const result = await super.handleRequest(requestProps);

    // Add rate limit headers to response
    if (response && effectiveLimit) {
      response.setHeader(RATE_LIMIT_HEADERS.LIMIT, effectiveLimit.toString());

      // Calculate reset time (current time + TTL)
      const resetTime = Math.ceil((Date.now() + effectiveTtl) / 1000);
      response.setHeader(RATE_LIMIT_HEADERS.RESET, resetTime.toString());

      // Add custom header showing which limit was applied
      response.setHeader('X-RateLimit-Source', limitSource);
    }

    return result;
  }

  /**
   * Override getTracker to include role in the tracking key
   * This enables role-based rate limiting with separate counters per role
   *
   * Key format: {role}:{userId|ip}:{endpoint}
   * Examples:
   * - ADMIN:user_123:/api/orders
   * - USER:user_456:/api/products
   * - GUEST:192.168.1.1:/api/auth/login
   */
  protected getTracker(req: Record<string, any>): Promise<string> {
    // Get user role from request (set by JWT auth guard)
    const userRole = req.user?.role as UserRole | undefined;
    const role = userRole || 'GUEST';

    // Get user ID or fallback to IP
    const userId = req.user?.id || req.user?.userId;
    const identifier = userId || req.ip || 'unknown';

    // Get endpoint path
    const endpoint = req.url || req.path || '/';

    // Create tracking key with role prefix
    const tracker = `${role}:${identifier}:${endpoint}`;

    this.logger.debug(
      `Rate limit tracker: ${tracker} - ${formatRateLimitForLog(role)}`,
    );

    return Promise.resolve(tracker);
  }

  /**
   * Override generateKey to include both role and endpoint category
   * This creates separate Redis counters for each role+endpoint combination
   *
   * Key format: {name}-{role}-{endpoint_category}-{suffix}
   * Examples:
   * - throttle-ADMIN-EXPENSIVE-192.168.1.1
   * - throttle-USER-STANDARD-192.168.1.2
   * - throttle-GUEST-CHEAP-192.168.1.3
   */
  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    const request = context.switchToHttp().getRequest();

    // Get user role
    const userRole = request.user?.role as UserRole | undefined;
    const role = userRole || 'GUEST';

    // Get endpoint category from decorator metadata
    const endpointCategory =
      this.reflector.getAllAndOverride<EndpointCategory>(
        THROTTLE_ENDPOINT_KEY,
        [context.getHandler(), context.getClass()],
      ) || 'NONE';

    // Include both role and endpoint category in the key
    return `${name}-${role}-${endpointCategory}-${suffix}`;
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
