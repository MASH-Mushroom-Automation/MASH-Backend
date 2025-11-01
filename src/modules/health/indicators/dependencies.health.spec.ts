import { Test, TestingModule } from '@nestjs/testing';
import { DependenciesHealthIndicator } from './dependencies.health';

describe('DependenciesHealthIndicator', () => {
  let indicator: DependenciesHealthIndicator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DependenciesHealthIndicator],
    }).compile();

    indicator = module.get<DependenciesHealthIndicator>(DependenciesHealthIndicator);
  });

  afterEach(() => {
    // Clear services after each test
    (indicator as any).services.clear();
  });

  it('should be defined', () => {
    expect(indicator).toBeDefined();
  });

  describe('registerService', () => {
    it('should register a new service', () => {
      const healthCheck = jest.fn().mockResolvedValue({ status: 'up' });
      
      indicator.registerService('test-service', healthCheck);
      
      const services = (indicator as any).services;
      expect(services.has('test-service')).toBe(true);
    });

    it('should store health check function', () => {
      const healthCheck = jest.fn().mockResolvedValue({ status: 'up' });
      
      indicator.registerService('test-service', healthCheck);
      
      const services = (indicator as any).services;
      const service = services.get('test-service');
      expect(service).toHaveProperty('healthCheck');
      expect(service.healthCheck).toBe(healthCheck);
    });

    it('should initialize with unknown status', () => {
      const healthCheck = jest.fn().mockResolvedValue({ status: 'up' });
      
      indicator.registerService('test-service', healthCheck);
      
      const services = (indicator as any).services;
      const service = services.get('test-service');
      expect(service.status).toBe('unknown');
    });
  });

  describe('updateServiceStatus', () => {
    it('should update service status', () => {
      const healthCheck = jest.fn().mockResolvedValue({ status: 'up' });
      indicator.registerService('test-service', healthCheck);
      
      indicator.updateServiceStatus('test-service', 'up');
      
      const services = (indicator as any).services;
      const service = services.get('test-service');
      expect(service.status).toBe('up');
    });

    it('should update lastChecked timestamp', () => {
      const healthCheck = jest.fn().mockResolvedValue({ status: 'up' });
      indicator.registerService('test-service', healthCheck);
      
      const beforeUpdate = Date.now();
      indicator.updateServiceStatus('test-service', 'up');
      const afterUpdate = Date.now();
      
      const services = (indicator as any).services;
      const service = services.get('test-service');
      expect(service.lastChecked).toBeGreaterThanOrEqual(beforeUpdate);
      expect(service.lastChecked).toBeLessThanOrEqual(afterUpdate);
    });

    it('should not throw error for non-existent service', () => {
      expect(() => {
        indicator.updateServiceStatus('non-existent', 'up');
      }).not.toThrow();
    });
  });

  describe('isHealthy', () => {
    it('should return healthy status when no services registered', async () => {
      const result = await indicator.isHealthy('dependencies');
      
      expect(result).toHaveProperty('dependencies');
      expect(result.dependencies.status).toBe('up');
    });

    it('should return healthy status when all services are up', async () => {
      const healthCheck1 = jest.fn().mockResolvedValue({ status: 'up' });
      const healthCheck2 = jest.fn().mockResolvedValue({ status: 'up' });
      
      indicator.registerService('service1', healthCheck1);
      indicator.registerService('service2', healthCheck2);
      indicator.updateServiceStatus('service1', 'up');
      indicator.updateServiceStatus('service2', 'up');
      
      const result = await indicator.isHealthy('dependencies');
      
      expect(result.dependencies.status).toBe('up');
    });

    it('should return unhealthy status when any service is down', async () => {
      const healthCheck1 = jest.fn().mockResolvedValue({ status: 'up' });
      const healthCheck2 = jest.fn().mockResolvedValue({ status: 'down' });
      
      indicator.registerService('service1', healthCheck1);
      indicator.registerService('service2', healthCheck2);
      indicator.updateServiceStatus('service1', 'up');
      indicator.updateServiceStatus('service2', 'down');
      
      const result = await indicator.isHealthy('dependencies');
      
      expect(result.dependencies.status).toBe('down');
    });

    it('should include all service details', async () => {
      const healthCheck = jest.fn().mockResolvedValue({ status: 'up' });
      
      indicator.registerService('test-service', healthCheck);
      indicator.updateServiceStatus('test-service', 'up');
      
      const result = await indicator.isHealthy('dependencies');
      
      expect(result.dependencies).toHaveProperty('services');
      expect(result.dependencies.services).toHaveProperty('test-service');
      expect(result.dependencies.services['test-service']).toHaveProperty('status');
      expect(result.dependencies.services['test-service']).toHaveProperty('lastChecked');
    });

    it('should execute health checks for all services', async () => {
      const healthCheck1 = jest.fn().mockResolvedValue({ status: 'up' });
      const healthCheck2 = jest.fn().mockResolvedValue({ status: 'up' });
      
      indicator.registerService('service1', healthCheck1);
      indicator.registerService('service2', healthCheck2);
      
      await indicator.isHealthy('dependencies');
      
      expect(healthCheck1).toHaveBeenCalled();
      expect(healthCheck2).toHaveBeenCalled();
    });

    it('should handle health check failures gracefully', async () => {
      const healthCheck = jest.fn().mockRejectedValue(new Error('Check failed'));
      
      indicator.registerService('failing-service', healthCheck);
      
      const result = await indicator.isHealthy('dependencies');
      
      expect(result.dependencies.status).toBe('down');
      expect(result.dependencies.services['failing-service'].status).toBe('down');
    });
  });

  describe('getServiceStatus', () => {
    it('should return service status', () => {
      const healthCheck = jest.fn().mockResolvedValue({ status: 'up' });
      indicator.registerService('test-service', healthCheck);
      indicator.updateServiceStatus('test-service', 'up');
      
      const status = indicator.getServiceStatus('test-service');
      
      expect(status).toBe('up');
    });

    it('should return unknown for non-existent service', () => {
      const status = indicator.getServiceStatus('non-existent');
      
      expect(status).toBe('unknown');
    });
  });

  describe('getAllServices', () => {
    it('should return all registered services', () => {
      const healthCheck1 = jest.fn().mockResolvedValue({ status: 'up' });
      const healthCheck2 = jest.fn().mockResolvedValue({ status: 'up' });
      
      indicator.registerService('service1', healthCheck1);
      indicator.registerService('service2', healthCheck2);
      
      const services = indicator.getAllServices();
      
      expect(services).toHaveLength(2);
      expect(services[0]).toHaveProperty('name');
      expect(services[0]).toHaveProperty('status');
      expect(services[0]).toHaveProperty('lastChecked');
    });

    it('should return empty array when no services registered', () => {
      const services = indicator.getAllServices();
      
      expect(services).toHaveLength(0);
    });
  });
});
