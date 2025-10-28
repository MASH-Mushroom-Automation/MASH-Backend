/**
 * Gateway Route Interface
 * Defines the structure of a route in the API Gateway
 */

import { LoadBalancingStrategy } from '@prisma/client';

export interface IGatewayRoute {
  id: string;
  serviceName: string;
  basePath: string;
  targetUrl: string;
  healthCheckUrl?: string;
  timeout: number;
  retryAttempts: number;
  circuitBreaker: boolean;
  loadBalancing: LoadBalancingStrategy;
  isActive: boolean;
  priority: number;
  metadata?: Record<string, any>;
}

export interface IServiceInstance {
  url: string;
  healthy: boolean;
  lastChecked: Date;
  responseTime: number;
  activeConnections: number;
  weight?: number;
}

export interface IRouteMatch {
  route: IGatewayRoute;
  params: Record<string, string>;
  queryParams: Record<string, string | string[]>;
}
