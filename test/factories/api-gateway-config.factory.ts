/**
 * API Gateway Config Factory
 *
 * Factory for creating test ApiGatewayConfig instances.
 */

import { faker } from '@faker-js/faker';
import { LoadBalancingStrategy, CircuitBreakerState } from '@prisma/client';

export interface ApiGatewayConfigFactoryOptions {
  id?: string;
  name?: string;
  path?: string;
  targetUrl?: string;
  method?: string;
  isActive?: boolean;
  timeout?: number;
  retries?: number;
  cacheEnabled?: boolean;
  cacheTtl?: number;
  loadBalancing?: LoadBalancingStrategy;
  healthCheck?: any;
  rateLimit?: any;
  authentication?: any;
  transformation?: any;
  circuitBreaker?: any;
}

export class ApiGatewayConfigFactory {
  /**
   * Create a single API gateway config with optional overrides
   */
  static create(overrides?: Partial<ApiGatewayConfigFactoryOptions>) {
    return {
      id: overrides?.id || faker.string.uuid(),
      name:
        overrides?.name ||
        `${faker.helpers.arrayElement(['Product', 'Order', 'User', 'Auth'])} API`,
      path:
        overrides?.path || `/api/v1/${faker.helpers.arrayElement(['products', 'orders', 'users'])}`,
      targetUrl:
        overrides?.targetUrl ||
        `http://internal-service-${faker.number.int({ min: 1, max: 5 })}.local:3000`,
      method: overrides?.method || faker.helpers.arrayElement(['GET', 'POST', 'PUT', 'DELETE']),
      isActive: overrides?.isActive !== undefined ? overrides.isActive : true,
      timeout: overrides?.timeout || 5000,
      retries: overrides?.retries || 3,
      cacheEnabled:
        overrides?.cacheEnabled !== undefined ? overrides.cacheEnabled : faker.datatype.boolean(),
      cacheTtl: overrides?.cacheTtl || 300,
      loadBalancing: overrides?.loadBalancing || LoadBalancingStrategy.ROUND_ROBIN,
      healthCheck: overrides?.healthCheck || {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        unhealthyThreshold: 3,
        healthyThreshold: 2,
      },
      rateLimit: overrides?.rateLimit || {
        enabled: true,
        requestsPerMinute: 100,
        burstSize: 20,
      },
      authentication: overrides?.authentication || {
        required: true,
        type: 'JWT',
        allowApiKey: true,
      },
      transformation: overrides?.transformation || {},
      circuitBreaker: overrides?.circuitBreaker || {
        enabled: true,
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
        state: CircuitBreakerState.CLOSED,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Create config for different load balancing strategies
   */
  static createWithLoadBalancing(strategy: LoadBalancingStrategy) {
    return this.create({ loadBalancing: strategy });
  }

  /**
   * Create inactive config
   */
  static createInactive(overrides?: Partial<ApiGatewayConfigFactoryOptions>) {
    return this.create({
      ...overrides,
      isActive: false,
    });
  }

  /**
   * Create config with caching enabled
   */
  static createWithCache(ttl: number = 300) {
    return this.create({
      cacheEnabled: true,
      cacheTtl: ttl,
    });
  }

  /**
   * Create multiple configs
   */
  static createMany(count: number, overrides?: Partial<ApiGatewayConfigFactoryOptions>) {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}
