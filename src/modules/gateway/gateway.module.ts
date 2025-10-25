import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PrometheusModule } from '../../monitoring/prometheus/prometheus.module';
import { GatewayService } from './services/gateway.service';
import { LoadBalancerService } from './services/load-balancer.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { GatewayController } from './controllers/gateway.controller';

// Rate Limiting Strategies
import { TokenBucketStrategy } from './rate-limiting/strategies/token-bucket.strategy';
import { LeakyBucketStrategy } from './rate-limiting/strategies/leaky-bucket.strategy';
import { SlidingWindowStrategy } from './rate-limiting/strategies/sliding-window.strategy';
import { FixedWindowStrategy } from './rate-limiting/strategies/fixed-window.strategy';
import { AdaptiveStrategy } from './rate-limiting/strategies/adaptive.strategy';

// Rate Limiting Services
import { DynamicRateLimitService } from './rate-limiting/services/dynamic-rate-limit.service';
import { RateLimitAnalyticsService } from './rate-limiting/services/rate-limit-analytics.service';

// Rate Limiting Controller
import { RateLimitController } from './rate-limiting/controllers/rate-limit.controller';

/**
 * GatewayModule - API Gateway functionality
 *
 * Features:
 * - Request routing and forwarding
 * - Load balancing across service instances
 * - Circuit breaker pattern for fault tolerance
 * - Service health monitoring
 * - Route configuration management
 * - Advanced rate limiting with multiple strategies
 * - Rate limit analytics and abuse detection
 *
 * This module provides the core infrastructure for the API Gateway
 * that sits in front of all backend services.
 */
@Module({
  imports: [DatabaseModule, PrometheusModule],
  controllers: [GatewayController, RateLimitController],
  providers: [
    // Core Gateway Services
    GatewayService,
    LoadBalancerService,
    CircuitBreakerService,

    // Rate Limiting Strategies
    TokenBucketStrategy,
    LeakyBucketStrategy,
    SlidingWindowStrategy,
    FixedWindowStrategy,
    AdaptiveStrategy,

    // Rate Limiting Services
    DynamicRateLimitService,
    RateLimitAnalyticsService,
  ],
  exports: [
    // Core Gateway Services
    GatewayService,
    LoadBalancerService,
    CircuitBreakerService,

    // Rate Limiting Services (for use in CustomThrottlerGuard)
    DynamicRateLimitService,
    RateLimitAnalyticsService,
  ],
})
export class GatewayModule {}
