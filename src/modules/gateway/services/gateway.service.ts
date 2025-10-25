import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import { PrometheusService } from '../../../monitoring/prometheus/prometheus.service';
import {
  IGatewayRoute,
  IRouteMatch,
} from '../interfaces/gateway-route.interface';
import { LoadBalancingStrategy } from '@prisma/client';

/**
 * GatewayService - Core routing and request handling
 *
 * Responsibilities:
 * - Route incoming requests to appropriate backend services
 * - Manage service registry (fetch routes from database)
 * - Cache routes in Redis for performance
 * - Track request metrics
 * - Handle route matching and parameter extraction
 */
@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);
  private readonly ROUTES_CACHE_KEY = 'gateway:routes:all';
  private readonly ROUTES_CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly prometheus: PrometheusService,
  ) {}

  /**
   * Get all active gateway routes
   * Uses Redis cache for performance
   */
  async getRoutes(): Promise<IGatewayRoute[]> {
    try {
      // Try to get from cache first
      const cached = await this.redis.get(this.ROUTES_CACHE_KEY);
      if (cached) {
        this.logger.debug('Routes loaded from cache');
        return JSON.parse(cached as string) as IGatewayRoute[];
      }

      // Fetch from database if not in cache
      const dbRoutes = await this.prisma.apiGatewayConfig.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' }, // Higher priority first
      });

      // Map to interface type
      const routes: IGatewayRoute[] = dbRoutes.map((route) => ({
        ...route,
        metadata: route.metadata as Record<string, any> | undefined,
        healthCheckUrl: route.healthCheckUrl ?? undefined,
      }));

      // Cache the routes
      await this.redis.set(
        this.ROUTES_CACHE_KEY,
        JSON.stringify(routes),
        this.ROUTES_CACHE_TTL,
      );

      this.logger.log(`Loaded ${routes.length} active routes from database`);
      return routes;
    } catch (error) {
      this.logger.error('Failed to get routes', error.stack);
      throw new HttpException(
        'Failed to load gateway routes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Find matching route for incoming request path
   * Returns route and extracted parameters
   */
  async matchRoute(
    method: string,
    path: string,
    queryString?: string,
  ): Promise<IRouteMatch | null> {
    const routes = await this.getRoutes();

    for (const route of routes) {
      const match = this.testRoute(route, path);
      if (match) {
        const queryParams = this.parseQueryString(queryString);

        this.logger.debug(
          `Route matched: ${method} ${path} -> ${route.serviceName}`,
        );

        // Record route usage metric
        this.prometheus.apiEndpointRequests.inc({
          endpoint: route.basePath,
          method,
          service: route.serviceName,
        });

        return {
          route,
          params: match.params,
          queryParams,
        };
      }
    }

    this.logger.warn(`No route found for: ${method} ${path}`);
    return null;
  }

  /**
   * Test if a route matches the given path
   * Extracts path parameters if match found
   */
  private testRoute(
    route: IGatewayRoute,
    path: string,
  ): { params: Record<string, string> } | null {
    const routePattern = route.basePath;

    // Simple exact match
    if (routePattern === path) {
      return { params: {} };
    }

    // Pattern matching with parameters (e.g., /orders/:id)
    const routeParts = routePattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (routeParts.length !== pathParts.length) {
      return null;
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const pathPart = pathParts[i];

      if (routePart.startsWith(':')) {
        // This is a parameter
        const paramName = routePart.slice(1);
        params[paramName] = pathPart;
      } else if (routePart !== pathPart) {
        // No match
        return null;
      }
    }

    return { params };
  }

  /**
   * Parse query string into object
   */
  private parseQueryString(
    queryString?: string,
  ): Record<string, string | string[]> {
    if (!queryString) {
      return {};
    }

    const params: Record<string, string | string[]> = {};
    const pairs = queryString.split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        const decodedKey = decodeURIComponent(key);
        const decodedValue = value ? decodeURIComponent(value) : '';

        // Handle multiple values for same key
        if (params[decodedKey]) {
          if (Array.isArray(params[decodedKey])) {
            (params[decodedKey] as string[]).push(decodedValue);
          } else {
            params[decodedKey] = [params[decodedKey] as string, decodedValue];
          }
        } else {
          params[decodedKey] = decodedValue;
        }
      }
    }

    return params;
  }

  /**
   * Invalidate routes cache
   * Call this when routes are updated
   */
  async invalidateCache(): Promise<void> {
    await this.redis.delete(this.ROUTES_CACHE_KEY);
    this.logger.log('Routes cache invalidated');
  }

  /**
   * Get gateway statistics
   */
  async getStatistics() {
    const routes = await this.getRoutes();
    const activeServices = routes.map((r) => r.serviceName);

    return {
      totalRoutes: routes.length,
      activeServices: [...new Set(activeServices)].length,
      loadBalancingStrategies: this.getStrategyDistribution(routes),
      circuitBreakerEnabled: routes.filter((r) => r.circuitBreaker).length,
    };
  }

  /**
   * Get distribution of load balancing strategies
   */
  private getStrategyDistribution(
    routes: IGatewayRoute[],
  ): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const route of routes) {
      const strategy = route.loadBalancing;
      distribution[strategy] = (distribution[strategy] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Build target URL for proxying request
   */
  buildTargetUrl(match: IRouteMatch, originalPath: string): string {
    const { route, params, queryParams } = match;
    let targetPath = originalPath.replace(route.basePath, '');

    // Replace path parameters
    for (const [key, value] of Object.entries(params)) {
      targetPath = targetPath.replace(`:${key}`, value);
    }

    // Add query parameters
    const queryString = Object.entries(queryParams)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return value
            .map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
            .join('&');
        }
        return `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`;
      })
      .join('&');

    const targetUrl = `${route.targetUrl}${targetPath}`;
    return queryString ? `${targetUrl}?${queryString}` : targetUrl;
  }
}
