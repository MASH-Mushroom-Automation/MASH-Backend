/**
 * Rate Limit Override Factory
 *
 * Factory for creating test RateLimitOverride instances.
 */

import { faker } from '@faker-js/faker';
import { RateLimitStrategy } from '@prisma/client';

export interface RateLimitOverrideFactoryOptions {
  id?: string;
  userId?: string;
  endpoint?: string;
  strategy?: RateLimitStrategy;
  requestLimit?: number;
  timeWindowMs?: number;
  burstSize?: number;
  refillRate?: number;
  reason?: string;
  expiresAt?: Date;
  isActive?: boolean;
}

export class RateLimitOverrideFactory {
  /**
   * Create a single rate limit override with optional overrides
   */
  static create(overrides?: Partial<RateLimitOverrideFactoryOptions>) {
    const strategy = overrides?.strategy || RateLimitStrategy.TOKEN_BUCKET;

    return {
      id: overrides?.id || faker.string.uuid(),
      userId: overrides?.userId || faker.string.uuid(),
      endpoint:
        overrides?.endpoint ||
        `/api/v1/${faker.helpers.arrayElement(['products', 'orders', 'users'])}`,
      strategy,
      requestLimit: overrides?.requestLimit || faker.number.int({ min: 100, max: 1000 }),
      timeWindowMs: overrides?.timeWindowMs || 60000, // 1 minute
      burstSize: overrides?.burstSize || (strategy === RateLimitStrategy.TOKEN_BUCKET ? 50 : null),
      refillRate:
        overrides?.refillRate || (strategy === RateLimitStrategy.TOKEN_BUCKET ? 10 : null),
      reason:
        overrides?.reason ||
        faker.helpers.arrayElement([
          'VIP customer',
          'Partner integration',
          'Load testing',
          'Beta testing',
          'Premium subscription',
        ]),
      expiresAt: overrides?.expiresAt || faker.date.future({ years: 1 }),
      isActive: overrides?.isActive !== undefined ? overrides.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Create override for specific strategy
   */
  static createWithStrategy(
    strategy: RateLimitStrategy,
    overrides?: Partial<RateLimitOverrideFactoryOptions>,
  ) {
    return this.create({
      ...overrides,
      strategy,
      ...(strategy === RateLimitStrategy.TOKEN_BUCKET && {
        burstSize: 50,
        refillRate: 10,
      }),
      ...(strategy === RateLimitStrategy.LEAKY_BUCKET && {
        refillRate: 5,
      }),
      ...(strategy === RateLimitStrategy.SLIDING_WINDOW && {
        timeWindowMs: 60000,
      }),
    });
  }

  /**
   * Create expired override
   */
  static createExpired(overrides?: Partial<RateLimitOverrideFactoryOptions>) {
    return this.create({
      ...overrides,
      expiresAt: faker.date.past({ years: 1 }),
      isActive: false,
    });
  }

  /**
   * Create high-limit override (for VIP users)
   */
  static createHighLimit(overrides?: Partial<RateLimitOverrideFactoryOptions>) {
    return this.create({
      ...overrides,
      requestLimit: 10000,
      timeWindowMs: 60000,
      reason: 'VIP customer - High volume access',
    });
  }

  /**
   * Create low-limit override (for restricted users)
   */
  static createLowLimit(overrides?: Partial<RateLimitOverrideFactoryOptions>) {
    return this.create({
      ...overrides,
      requestLimit: 10,
      timeWindowMs: 60000,
      reason: 'Rate limit violation - Restricted access',
    });
  }

  /**
   * Create override for specific user and endpoint
   */
  static createForUserEndpoint(userId: string, endpoint: string) {
    return this.create({ userId, endpoint });
  }

  /**
   * Create multiple overrides
   */
  static createMany(count: number, overrides?: Partial<RateLimitOverrideFactoryOptions>) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create overrides for different strategies
   */
  static createStrategySet(userId?: string) {
    const commonOverrides = userId ? { userId } : {};

    return {
      tokenBucket: this.createWithStrategy(RateLimitStrategy.TOKEN_BUCKET, commonOverrides),
      leakyBucket: this.createWithStrategy(RateLimitStrategy.LEAKY_BUCKET, commonOverrides),
      slidingWindow: this.createWithStrategy(RateLimitStrategy.SLIDING_WINDOW, commonOverrides),
      fixedWindow: this.createWithStrategy(RateLimitStrategy.FIXED_WINDOW, commonOverrides),
      adaptive: this.createWithStrategy(RateLimitStrategy.ADAPTIVE, commonOverrides),
    };
  }
}
