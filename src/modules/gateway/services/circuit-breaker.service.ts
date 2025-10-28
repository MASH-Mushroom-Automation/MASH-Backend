import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CircuitBreakerStateEnum } from '@prisma/client';
import { ICircuitBreakerConfig } from '../interfaces/circuit-breaker.interface';

/**
 * CircuitBreakerService - Implements circuit breaker pattern for fault tolerance
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, reject requests immediately
 * - HALF_OPEN: Testing if service has recovered
 *
 * Flow:
 * CLOSED -> (failures exceed threshold) -> OPEN
 * OPEN -> (timeout expires) -> HALF_OPEN
 * HALF_OPEN -> (success threshold met) -> CLOSED
 * HALF_OPEN -> (any failure) -> OPEN
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  private readonly defaultConfig: ICircuitBreakerConfig = {
    failureThreshold: 5, // Open circuit after 5 failures
    successThreshold: 3, // Close circuit after 3 successes in half-open
    timeout: 60000, // Try again after 60 seconds
    halfOpenRequests: 3, // Allow 3 requests in half-open state
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if request should be allowed based on circuit state
   */
  async canExecute(serviceName: string): Promise<boolean> {
    const state = await this.getState(serviceName);

    switch (state.state) {
      case CircuitBreakerStateEnum.CLOSED:
        return true;

      case CircuitBreakerStateEnum.OPEN:
        // Check if timeout has expired
        if (state.nextRetryAt && new Date() >= state.nextRetryAt) {
          // Transition to HALF_OPEN
          await this.transitionToHalfOpen(serviceName);
          return true;
        }
        return false;

      case CircuitBreakerStateEnum.HALF_OPEN:
        // Allow limited requests in half-open state
        return true;

      default:
        return true;
    }
  }

  /**
   * Record successful request
   */
  async recordSuccess(serviceName: string): Promise<void> {
    const state = await this.getState(serviceName);

    if (state.state === CircuitBreakerStateEnum.HALF_OPEN) {
      const newSuccessCount = state.successCount + 1;

      if (newSuccessCount >= this.defaultConfig.successThreshold) {
        // Transition back to CLOSED
        await this.transitionToClosed(serviceName);
        this.logger.log(`Circuit breaker CLOSED for service: ${serviceName}`);
      } else {
        await this.updateState(serviceName, {
          successCount: newSuccessCount,
          lastSuccessAt: new Date(),
        });
      }
    } else {
      // Reset failure count on success
      await this.updateState(serviceName, {
        failureCount: 0,
        successCount: state.successCount + 1,
        lastSuccessAt: new Date(),
      });
    }
  }

  /**
   * Record failed request
   */
  async recordFailure(serviceName: string): Promise<void> {
    const state = await this.getState(serviceName);

    if (state.state === CircuitBreakerStateEnum.HALF_OPEN) {
      // Any failure in half-open immediately opens circuit
      await this.transitionToOpen(serviceName);
      this.logger.warn(`Circuit breaker reopened for service: ${serviceName}`);
      return;
    }

    const newFailureCount = state.failureCount + 1;

    if (newFailureCount >= this.defaultConfig.failureThreshold) {
      // Transition to OPEN
      await this.transitionToOpen(serviceName);
      this.logger.warn(
        `Circuit breaker OPENED for service: ${serviceName} (${newFailureCount} failures)`,
      );
    } else {
      await this.updateState(serviceName, {
        failureCount: newFailureCount,
        lastFailureAt: new Date(),
      });
    }
  }

  /**
   * Get current circuit breaker state
   */
  private async getState(serviceName: string) {
    let state = await this.prisma.circuitBreakerState.findUnique({
      where: { serviceName },
    });

    if (!state) {
      // Create initial state
      state = await this.prisma.circuitBreakerState.create({
        data: {
          serviceName,
          state: CircuitBreakerStateEnum.CLOSED,
          failureCount: 0,
          successCount: 0,
        },
      });
    }

    return state;
  }

  /**
   * Update circuit breaker state
   */
  private async updateState(
    serviceName: string,
    data: Partial<{
      state: CircuitBreakerStateEnum;
      failureCount: number;
      successCount: number;
      lastFailureAt: Date;
      lastSuccessAt: Date;
      nextRetryAt: Date;
      openedAt: Date;
    }>,
  ) {
    return this.prisma.circuitBreakerState.upsert({
      where: { serviceName },
      update: data,
      create: {
        serviceName,
        state: CircuitBreakerStateEnum.CLOSED,
        failureCount: 0,
        successCount: 0,
        ...data,
      },
    });
  }

  /**
   * Transition to OPEN state
   */
  private async transitionToOpen(serviceName: string) {
    const nextRetryAt = new Date(Date.now() + this.defaultConfig.timeout);

    await this.updateState(serviceName, {
      state: CircuitBreakerStateEnum.OPEN,
      openedAt: new Date(),
      nextRetryAt,
    });
  }

  /**
   * Transition to HALF_OPEN state
   */
  private async transitionToHalfOpen(serviceName: string) {
    await this.updateState(serviceName, {
      state: CircuitBreakerStateEnum.HALF_OPEN,
      successCount: 0,
      failureCount: 0,
    });

    this.logger.log(`Circuit breaker HALF_OPEN for service: ${serviceName}`);
  }

  /**
   * Transition to CLOSED state
   */
  private async transitionToClosed(serviceName: string) {
    await this.updateState(serviceName, {
      state: CircuitBreakerStateEnum.CLOSED,
      failureCount: 0,
      successCount: 0,
      nextRetryAt: null,
      openedAt: null,
    });
  }

  /**
   * Manually reset circuit breaker
   */
  async reset(serviceName: string): Promise<void> {
    await this.transitionToClosed(serviceName);
    this.logger.log(`Circuit breaker manually reset for service: ${serviceName}`);
  }

  /**
   * Get all circuit breaker states
   */
  async getAllStates() {
    return this.prisma.circuitBreakerState.findMany({
      orderBy: { serviceName: 'asc' },
    });
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    const states = await this.getAllStates();

    return {
      total: states.length,
      closed: states.filter(s => s.state === CircuitBreakerStateEnum.CLOSED).length,
      open: states.filter(s => s.state === CircuitBreakerStateEnum.OPEN).length,
      halfOpen: states.filter(s => s.state === CircuitBreakerStateEnum.HALF_OPEN).length,
      states: states.map(s => ({
        serviceName: s.serviceName,
        state: s.state,
        failureCount: s.failureCount,
        successCount: s.successCount,
        lastFailureAt: s.lastFailureAt,
        nextRetryAt: s.nextRetryAt,
      })),
    };
  }
}
