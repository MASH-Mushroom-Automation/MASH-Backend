import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PrometheusModule } from '../../monitoring/prometheus/prometheus.module';
import { GatewayService } from './services/gateway.service';
import { LoadBalancerService } from './services/load-balancer.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { GatewayController } from './controllers/gateway.controller';

/**
 * GatewayModule - API Gateway functionality
 *
 * Features:
 * - Request routing and forwarding
 * - Load balancing across service instances
 * - Circuit breaker pattern for fault tolerance
 * - Service health monitoring
 * - Route configuration management
 *
 * This module provides the core infrastructure for the API Gateway
 * that sits in front of all backend services.
 */
@Module({
  imports: [DatabaseModule, PrometheusModule],
  controllers: [GatewayController],
  providers: [GatewayService, LoadBalancerService, CircuitBreakerService],
  exports: [GatewayService, LoadBalancerService, CircuitBreakerService],
})
export class GatewayModule {}
