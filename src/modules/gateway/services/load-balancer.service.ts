import { Injectable, Logger } from '@nestjs/common';
import { LoadBalancingStrategy } from '@prisma/client';
import { IServiceInstance } from '../interfaces/gateway-route.interface';

/**
 * LoadBalancerService - Manages load distribution across service instances
 *
 * Strategies:
 * - ROUND_ROBIN: Distribute requests evenly in circular order
 * - LEAST_CONNECTIONS: Route to instance with fewest active connections
 * - WEIGHTED_ROUND_ROBIN: Distribution based on instance weights
 * - IP_HASH: Consistent routing based on client IP (sticky sessions)
 * - HEALTH_BASED: Route only to healthy instances
 */
@Injectable()
export class LoadBalancerService {
  private readonly logger = new Logger(LoadBalancerService.name);

  // Track current index for round-robin
  private roundRobinIndexes: Map<string, number> = new Map();

  // Track service instances health
  private serviceInstances: Map<string, IServiceInstance[]> = new Map();

  /**
   * Get next instance URL based on load balancing strategy
   */
  async getNextInstance(
    serviceName: string,
    strategy: LoadBalancingStrategy,
    clientIp?: string,
  ): Promise<string | null> {
    const instances = this.serviceInstances.get(serviceName) || [];
    const healthyInstances = instances.filter((i) => i.healthy);

    if (healthyInstances.length === 0) {
      this.logger.warn(
        `No healthy instances available for service: ${serviceName}`,
      );
      return null;
    }

    switch (strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.roundRobin(serviceName, healthyInstances);

      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        return this.leastConnections(healthyInstances);

      case LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
        return this.weightedRoundRobin(serviceName, healthyInstances);

      case LoadBalancingStrategy.IP_HASH:
        return this.ipHash(clientIp, healthyInstances);

      case LoadBalancingStrategy.HEALTH_BASED:
        return this.healthBased(healthyInstances);

      default:
        return this.roundRobin(serviceName, healthyInstances);
    }
  }

  /**
   * Round Robin: Simple circular distribution
   */
  private roundRobin(
    serviceName: string,
    instances: IServiceInstance[],
  ): string {
    const currentIndex = this.roundRobinIndexes.get(serviceName) || 0;
    const instance = instances[currentIndex % instances.length];

    this.roundRobinIndexes.set(serviceName, currentIndex + 1);

    return instance.url;
  }

  /**
   * Least Connections: Route to instance with fewest active connections
   */
  private leastConnections(instances: IServiceInstance[]): string {
    const instance = instances.reduce((min, current) =>
      current.activeConnections < min.activeConnections ? current : min,
    );

    return instance.url;
  }

  /**
   * Weighted Round Robin: Distribution based on instance weights
   */
  private weightedRoundRobin(
    serviceName: string,
    instances: IServiceInstance[],
  ): string {
    // Calculate total weight
    const totalWeight = instances.reduce((sum, i) => sum + (i.weight || 1), 0);

    // Get current position in weighted distribution
    const currentIndex = this.roundRobinIndexes.get(serviceName) || 0;
    const position = currentIndex % totalWeight;

    // Find instance based on weight distribution
    let weightSum = 0;
    for (const instance of instances) {
      weightSum += instance.weight || 1;
      if (position < weightSum) {
        this.roundRobinIndexes.set(serviceName, currentIndex + 1);
        return instance.url;
      }
    }

    // Fallback to first instance
    this.roundRobinIndexes.set(serviceName, currentIndex + 1);
    return instances[0].url;
  }

  /**
   * IP Hash: Consistent hashing for sticky sessions
   */
  private ipHash(
    clientIp: string | undefined,
    instances: IServiceInstance[],
  ): string {
    if (!clientIp) {
      // Fallback to round robin if no IP
      return instances[0].url;
    }

    // Simple hash function
    const hash = clientIp.split('.').reduce((acc, octet) => {
      return acc + parseInt(octet, 10);
    }, 0);

    const index = hash % instances.length;
    return instances[index].url;
  }

  /**
   * Health Based: Route to fastest healthy instance
   */
  private healthBased(instances: IServiceInstance[]): string {
    // Sort by response time (fastest first)
    const sorted = [...instances].sort(
      (a, b) => a.responseTime - b.responseTime,
    );
    return sorted[0].url;
  }

  /**
   * Register service instance
   */
  registerInstance(serviceName: string, url: string, weight?: number): void {
    const instances = this.serviceInstances.get(serviceName) || [];

    const existingIndex = instances.findIndex((i) => i.url === url);

    if (existingIndex >= 0) {
      // Update existing instance
      instances[existingIndex].weight = weight;
    } else {
      // Add new instance
      instances.push({
        url,
        healthy: true,
        lastChecked: new Date(),
        responseTime: 0,
        activeConnections: 0,
        weight,
      });
    }

    this.serviceInstances.set(serviceName, instances);
    this.logger.log(`Registered instance ${url} for service ${serviceName}`);
  }

  /**
   * Mark instance as healthy or unhealthy
   */
  updateInstanceHealth(
    serviceName: string,
    url: string,
    healthy: boolean,
    responseTime?: number,
  ): void {
    const instances = this.serviceInstances.get(serviceName);
    if (!instances) return;

    const instance = instances.find((i) => i.url === url);
    if (instance) {
      instance.healthy = healthy;
      instance.lastChecked = new Date();
      if (responseTime !== undefined) {
        instance.responseTime = responseTime;
      }

      this.logger.debug(
        `Instance ${url} health updated: ${healthy ? 'healthy' : 'unhealthy'}`,
      );
    }
  }

  /**
   * Increment active connections for instance
   */
  incrementConnections(serviceName: string, url: string): void {
    const instances = this.serviceInstances.get(serviceName);
    if (!instances) return;

    const instance = instances.find((i) => i.url === url);
    if (instance) {
      instance.activeConnections++;
    }
  }

  /**
   * Decrement active connections for instance
   */
  decrementConnections(serviceName: string, url: string): void {
    const instances = this.serviceInstances.get(serviceName);
    if (!instances) return;

    const instance = instances.find((i) => i.url === url);
    if (instance && instance.activeConnections > 0) {
      instance.activeConnections--;
    }
  }

  /**
   * Get all instances for a service
   */
  getInstances(serviceName: string): IServiceInstance[] {
    return this.serviceInstances.get(serviceName) || [];
  }

  /**
   * Get load balancer statistics
   */
  getStatistics(serviceName?: string) {
    if (serviceName) {
      const instances = this.getInstances(serviceName);
      return {
        serviceName,
        totalInstances: instances.length,
        healthyInstances: instances.filter((i) => i.healthy).length,
        totalConnections: instances.reduce(
          (sum, i) => sum + i.activeConnections,
          0,
        ),
        instances: instances.map((i) => ({
          url: i.url,
          healthy: i.healthy,
          connections: i.activeConnections,
          responseTime: i.responseTime,
        })),
      };
    }

    // Statistics for all services
    const allStats = Array.from(this.serviceInstances.entries()).map(
      ([service, instances]) => ({
        serviceName: service,
        totalInstances: instances.length,
        healthyInstances: instances.filter((i) => i.healthy).length,
        totalConnections: instances.reduce(
          (sum, i) => sum + i.activeConnections,
          0,
        ),
      }),
    );

    return {
      totalServices: this.serviceInstances.size,
      services: allStats,
    };
  }
}
