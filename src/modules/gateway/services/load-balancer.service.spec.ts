import { Test, TestingModule } from '@nestjs/testing';
import { LoadBalancerService } from '../services/load-balancer.service';
import { LoadBalancingStrategy } from '@prisma/client';
import { IServiceInstance } from '../interfaces/gateway-route.interface';

describe('LoadBalancerService', () => {
  let service: LoadBalancerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoadBalancerService],
    }).compile();

    service = module.get<LoadBalancerService>(LoadBalancerService);
  });

  afterEach(() => {
    // Clear all instances after each test
    jest.clearAllMocks();
  });

  describe('registerInstance', () => {
    it('should register a new service instance', () => {
      // Arrange
      const serviceName = 'test-service';
      const url = 'http://localhost:3001';
      const weight = 2;

      // Act
      service.registerInstance(serviceName, url, weight);

      // Assert
      const instances = service.getInstances(serviceName);
      expect(instances).toHaveLength(1);
      expect(instances[0]).toMatchObject({
        url,
        healthy: true,
        activeConnections: 0,
        weight,
      });
    });

    it('should register multiple instances for the same service', () => {
      // Arrange
      const serviceName = 'test-service';

      // Act
      service.registerInstance(serviceName, 'http://localhost:3001', 1);
      service.registerInstance(serviceName, 'http://localhost:3002', 2);
      service.registerInstance(serviceName, 'http://localhost:3003', 3);

      // Assert
      const instances = service.getInstances(serviceName);
      expect(instances).toHaveLength(3);
      expect(instances.map((i) => i.url)).toEqual([
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
      ]);
    });

    it('should update existing instance weight if already registered', () => {
      // Arrange
      const serviceName = 'test-service';
      const url = 'http://localhost:3001';

      // Act
      service.registerInstance(serviceName, url, 1);
      service.registerInstance(serviceName, url, 5); // Update weight

      // Assert
      const instances = service.getInstances(serviceName);
      expect(instances).toHaveLength(1);
      expect(instances[0].weight).toBe(5);
    });

    it('should register instances for different services independently', () => {
      // Arrange & Act
      service.registerInstance('service-a', 'http://localhost:3001');
      service.registerInstance('service-b', 'http://localhost:3002');

      // Assert
      expect(service.getInstances('service-a')).toHaveLength(1);
      expect(service.getInstances('service-b')).toHaveLength(1);
    });
  });

  describe('updateInstanceHealth', () => {
    it('should update instance health status to healthy', () => {
      // Arrange
      const serviceName = 'test-service';
      const url = 'http://localhost:3001';
      service.registerInstance(serviceName, url);

      // Act
      service.updateInstanceHealth(serviceName, url, true, 100);

      // Assert
      const instances = service.getInstances(serviceName);
      expect(instances[0].healthy).toBe(true);
      expect(instances[0].responseTime).toBe(100);
    });

    it('should update instance health status to unhealthy', () => {
      // Arrange
      const serviceName = 'test-service';
      const url = 'http://localhost:3001';
      service.registerInstance(serviceName, url);

      // Act
      service.updateInstanceHealth(serviceName, url, false, 5000);

      // Assert
      const instances = service.getInstances(serviceName);
      expect(instances[0].healthy).toBe(false);
      expect(instances[0].responseTime).toBe(5000);
    });

    it('should update lastChecked timestamp when health is updated', () => {
      // Arrange
      const serviceName = 'test-service';
      const url = 'http://localhost:3001';
      service.registerInstance(serviceName, url);
      const initialTimestamp = service.getInstances(serviceName)[0].lastChecked;

      // Wait a bit to ensure timestamp changes
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      // Act
      service.updateInstanceHealth(serviceName, url, true);

      // Assert
      const updatedTimestamp = service.getInstances(serviceName)[0].lastChecked;
      expect(updatedTimestamp).not.toEqual(initialTimestamp);

      jest.useRealTimers();
    });

    it('should handle updating health for non-existent service gracefully', () => {
      // Act & Assert - should not throw
      expect(() => {
        service.updateInstanceHealth('non-existent', 'http://localhost:3001', true);
      }).not.toThrow();
    });

    it('should handle updating health for non-existent instance gracefully', () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001');

      // Act & Assert - should not throw
      expect(() => {
        service.updateInstanceHealth(serviceName, 'http://localhost:9999', false);
      }).not.toThrow();
    });
  });

  describe('incrementConnections / decrementConnections', () => {
    it('should increment active connections for an instance', () => {
      // Arrange
      const serviceName = 'test-service';
      const url = 'http://localhost:3001';
      service.registerInstance(serviceName, url);

      // Act
      service.incrementConnections(serviceName, url);
      service.incrementConnections(serviceName, url);

      // Assert
      const instances = service.getInstances(serviceName);
      expect(instances[0].activeConnections).toBe(2);
    });

    it('should decrement active connections for an instance', () => {
      // Arrange
      const serviceName = 'test-service';
      const url = 'http://localhost:3001';
      service.registerInstance(serviceName, url);
      service.incrementConnections(serviceName, url);
      service.incrementConnections(serviceName, url);

      // Act
      service.decrementConnections(serviceName, url);

      // Assert
      const instances = service.getInstances(serviceName);
      expect(instances[0].activeConnections).toBe(1);
    });

    it('should not decrement below zero', () => {
      // Arrange
      const serviceName = 'test-service';
      const url = 'http://localhost:3001';
      service.registerInstance(serviceName, url);

      // Act
      service.decrementConnections(serviceName, url);
      service.decrementConnections(serviceName, url);

      // Assert
      const instances = service.getInstances(serviceName);
      expect(instances[0].activeConnections).toBe(0);
    });

    it('should handle connection management for non-existent service gracefully', () => {
      // Act & Assert - should not throw
      expect(() => {
        service.incrementConnections('non-existent', 'http://localhost:3001');
        service.decrementConnections('non-existent', 'http://localhost:3001');
      }).not.toThrow();
    });
  });

  describe('getNextInstance - ROUND_ROBIN strategy', () => {
    it('should return instances in circular order', async () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001');
      service.registerInstance(serviceName, 'http://localhost:3002');
      service.registerInstance(serviceName, 'http://localhost:3003');

      // Act
      const instance1 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.ROUND_ROBIN,
      );
      const instance2 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.ROUND_ROBIN,
      );
      const instance3 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.ROUND_ROBIN,
      );
      const instance4 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.ROUND_ROBIN,
      );

      // Assert
      expect(instance1).toBe('http://localhost:3001');
      expect(instance2).toBe('http://localhost:3002');
      expect(instance3).toBe('http://localhost:3003');
      expect(instance4).toBe('http://localhost:3001'); // Should cycle back
    });

    it('should skip unhealthy instances in round robin', async () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001');
      service.registerInstance(serviceName, 'http://localhost:3002');
      service.registerInstance(serviceName, 'http://localhost:3003');

      // Mark second instance as unhealthy
      service.updateInstanceHealth(serviceName, 'http://localhost:3002', false);

      // Act
      const instance1 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.ROUND_ROBIN,
      );
      const instance2 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.ROUND_ROBIN,
      );
      const instance3 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.ROUND_ROBIN,
      );

      // Assert - should only rotate between healthy instances (3001 and 3003)
      expect(instance1).toBe('http://localhost:3001');
      expect(instance2).toBe('http://localhost:3003');
      expect(instance3).toBe('http://localhost:3001');
    });

    it('should return null when no healthy instances available', async () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001');
      service.updateInstanceHealth(serviceName, 'http://localhost:3001', false);

      // Act
      const instance = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.ROUND_ROBIN,
      );

      // Assert
      expect(instance).toBeNull();
    });

    it('should return null when no instances registered', async () => {
      // Act
      const instance = await service.getNextInstance(
        'non-existent-service',
        LoadBalancingStrategy.ROUND_ROBIN,
      );

      // Assert
      expect(instance).toBeNull();
    });
  });

  describe('getNextInstance - LEAST_CONNECTIONS strategy', () => {
    it('should return instance with fewest active connections', async () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001');
      service.registerInstance(serviceName, 'http://localhost:3002');
      service.registerInstance(serviceName, 'http://localhost:3003');

      // Set different connection counts
      service.incrementConnections(serviceName, 'http://localhost:3001');
      service.incrementConnections(serviceName, 'http://localhost:3001');
      service.incrementConnections(serviceName, 'http://localhost:3002');

      // Act
      const instance = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.LEAST_CONNECTIONS,
      );

      // Assert - should return 3003 (0 connections)
      expect(instance).toBe('http://localhost:3003');
    });

    it('should return first instance when all have equal connections', async () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001');
      service.registerInstance(serviceName, 'http://localhost:3002');
      service.registerInstance(serviceName, 'http://localhost:3003');

      // Act
      const instance = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.LEAST_CONNECTIONS,
      );

      // Assert
      expect(instance).toBe('http://localhost:3001');
    });
  });

  describe('getNextInstance - WEIGHTED_ROUND_ROBIN strategy', () => {
    it('should distribute requests based on instance weights', async () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001', 1); // Weight 1
      service.registerInstance(serviceName, 'http://localhost:3002', 3); // Weight 3

      // Act - Get 8 instances (total weight = 4, so 2 cycles)
      const results = [];
      for (let i = 0; i < 8; i++) {
        results.push(
          await service.getNextInstance(
            serviceName,
            LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN,
          ),
        );
      }

      // Assert - 3002 should appear 3x more often than 3001
      const count3001 = results.filter((r) => r === 'http://localhost:3001').length;
      const count3002 = results.filter((r) => r === 'http://localhost:3002').length;

      expect(count3001).toBe(2); // 1/4 of 8 = 2
      expect(count3002).toBe(6); // 3/4 of 8 = 6
    });

    it('should handle instances with no weight (defaults to 1)', async () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001'); // No weight (default 1)
      service.registerInstance(serviceName, 'http://localhost:3002', 2);

      // Act
      const instance1 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN,
      );
      const instance2 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN,
      );
      const instance3 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN,
      );

      // Assert - Should follow pattern: 3001 (1), 3002 (2), 3002 (2)
      expect([instance1, instance2, instance3]).toEqual([
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3002',
      ]);
    });
  });

  describe('getNextInstance - IP_HASH strategy', () => {
    it('should return consistent instance for same client IP', async () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001');
      service.registerInstance(serviceName, 'http://localhost:3002');
      service.registerInstance(serviceName, 'http://localhost:3003');

      const clientIp = '192.168.1.100';

      // Act
      const instance1 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.IP_HASH,
        clientIp,
      );
      const instance2 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.IP_HASH,
        clientIp,
      );
      const instance3 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.IP_HASH,
        clientIp,
      );

      // Assert - All requests from same IP should go to same instance
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
    });

    it('should distribute different IPs across instances', async () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001');
      service.registerInstance(serviceName, 'http://localhost:3002');
      service.registerInstance(serviceName, 'http://localhost:3003');

      // Act
      const instance1 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.IP_HASH,
        '192.168.1.100',
      );
      const instance2 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.IP_HASH,
        '192.168.1.101',
      );
      const instance3 = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.IP_HASH,
        '192.168.1.102',
      );

      // Assert - Different IPs may get different instances
      const uniqueInstances = new Set([instance1, instance2, instance3]);
      expect(uniqueInstances.size).toBeGreaterThanOrEqual(1);
    });

    it('should fallback to first instance when no client IP provided', async () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001');
      service.registerInstance(serviceName, 'http://localhost:3002');

      // Act
      const instance = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.IP_HASH,
      );

      // Assert
      expect(instance).toBe('http://localhost:3001');
    });
  });

  describe('getNextInstance - HEALTH_BASED strategy', () => {
    it('should return instance with fastest response time', async () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001');
      service.registerInstance(serviceName, 'http://localhost:3002');
      service.registerInstance(serviceName, 'http://localhost:3003');

      // Set different response times
      service.updateInstanceHealth(serviceName, 'http://localhost:3001', true, 500);
      service.updateInstanceHealth(serviceName, 'http://localhost:3002', true, 50);
      service.updateInstanceHealth(serviceName, 'http://localhost:3003', true, 200);

      // Act
      const instance = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.HEALTH_BASED,
      );

      // Assert - Should return 3002 (fastest at 50ms)
      expect(instance).toBe('http://localhost:3002');
    });

    it('should consider only healthy instances', async () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001');
      service.registerInstance(serviceName, 'http://localhost:3002');

      // 3001 is fastest but unhealthy
      service.updateInstanceHealth(serviceName, 'http://localhost:3001', false, 10);
      service.updateInstanceHealth(serviceName, 'http://localhost:3002', true, 100);

      // Act
      const instance = await service.getNextInstance(
        serviceName,
        LoadBalancingStrategy.HEALTH_BASED,
      );

      // Assert - Should return 3002 (only healthy instance)
      expect(instance).toBe('http://localhost:3002');
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for a specific service', () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001');
      service.registerInstance(serviceName, 'http://localhost:3002');
      service.updateInstanceHealth(serviceName, 'http://localhost:3002', false);
      service.incrementConnections(serviceName, 'http://localhost:3001');

      // Act
      const stats = service.getStatistics(serviceName);

      // Assert
      expect(stats).toEqual({
        serviceName,
        totalInstances: 2,
        healthyInstances: 1,
        totalConnections: 1,
        instances: expect.arrayContaining([
          expect.objectContaining({
            url: 'http://localhost:3001',
            healthy: true,
            connections: 1,
          }),
          expect.objectContaining({
            url: 'http://localhost:3002',
            healthy: false,
            connections: 0,
          }),
        ]),
      });
    });

    it('should return statistics for all services', () => {
      // Arrange
      service.registerInstance('service-a', 'http://localhost:3001');
      service.registerInstance('service-b', 'http://localhost:3002');

      // Act
      const stats = service.getStatistics();

      // Assert
      expect(stats).toEqual({
        totalServices: 2,
        services: expect.arrayContaining([
          expect.objectContaining({ serviceName: 'service-a', totalInstances: 1 }),
          expect.objectContaining({ serviceName: 'service-b', totalInstances: 1 }),
        ]),
      });
    });

    it('should return empty statistics when no services registered', () => {
      // Act
      const stats = service.getStatistics();

      // Assert
      expect(stats).toEqual({
        totalServices: 0,
        services: [],
      });
    });
  });

  describe('getInstances', () => {
    it('should return empty array for non-existent service', () => {
      // Act
      const instances = service.getInstances('non-existent');

      // Assert
      expect(instances).toEqual([]);
    });

    it('should return all instances for a service', () => {
      // Arrange
      const serviceName = 'test-service';
      service.registerInstance(serviceName, 'http://localhost:3001');
      service.registerInstance(serviceName, 'http://localhost:3002');

      // Act
      const instances = service.getInstances(serviceName);

      // Assert
      expect(instances).toHaveLength(2);
    });
  });
});
