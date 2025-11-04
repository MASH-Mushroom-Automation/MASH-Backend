import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';

interface ServiceStatus {
  name: string;
  healthy: boolean;
  responseTime?: number;
  lastCheck?: Date;
  error?: string;
}

@Injectable()
export class DependenciesHealthIndicator extends HealthIndicator {
  private serviceStatuses: Map<string, ServiceStatus> = new Map();

  /**
   * Register a service dependency for health monitoring
   */
  registerService(name: string, checkFn: () => Promise<boolean>) {
    this.serviceStatuses.set(name, {
      name,
      healthy: false,
      lastCheck: new Date(),
    });
  }

  /**
   * Update service status
   */
  updateServiceStatus(name: string, healthy: boolean, responseTime?: number, error?: string) {
    this.serviceStatuses.set(name, {
      name,
      healthy,
      responseTime,
      lastCheck: new Date(),
      error,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const dependencies: Record<string, any> = {};
    let allHealthy = true;

    for (const [serviceName, status] of this.serviceStatuses.entries()) {
      dependencies[serviceName] = {
        healthy: status.healthy,
        responseTime: status.responseTime ? `${status.responseTime}ms` : 'N/A',
        lastCheck: status.lastCheck?.toISOString(),
        ...(status.error && { error: status.error }),
      };

      if (!status.healthy) {
        allHealthy = false;
      }
    }

    const result = this.getStatus(key, allHealthy, {
      services: dependencies,
      totalServices: this.serviceStatuses.size,
      healthyServices: Array.from(this.serviceStatuses.values()).filter(s => s.healthy).length,
    });

    if (!allHealthy) {
      throw new HealthCheckError('Some dependencies are unhealthy', result);
    }

    return result;
  }
}
