/**
 * Circuit Breaker State Interface
 */

import { CircuitBreakerStateEnum } from '@prisma/client';

export interface ICircuitBreakerState {
  serviceName: string;
  state: CircuitBreakerStateEnum;
  failureCount: number;
  successCount: number;
  lastFailureAt?: Date;
  lastSuccessAt?: Date;
  nextRetryAt?: Date;
  openedAt?: Date;
}

export interface ICircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenRequests: number;
}
