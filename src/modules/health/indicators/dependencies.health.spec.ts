import { Test, TestingModule } from '@nestjs/testing';
import { DependenciesHealthIndicator } from './dependencies.health';
import { HealthCheckError } from '@nestjs/terminus';

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
    (indicator as any).serviceStatuses.clear();
  });

  it('should be defined', () => {
    expect(indicator).toBeDefined();
  });

  describe('registerService', () => {
    it('should register a new service', () => {
      const healthCheck = jest.fn().mockResolvedValue(true);
      
      indicator.registerService('test-service', healthCheck);
      
      const serviceStatuses = (indicator as any).serviceStatuses;
      expect(serviceStatuses.has('test-service')).toBe(true);
    });

    it('should initialize with healthy=false', () => {
      const healthCheck = jest.fn().mockResolvedValue(true);
      
      indicator.registerService('test-service', healthCheck);
      
      const serviceStatuses = (indicator as any).serviceStatuses;
      const service = serviceStatuses.get('test-service');
      expect(service.healthy).toBe(false);
    });
  });

  describe('updateServiceStatus', () => {
    it('should update service status to healthy', () => {
      const healthCheck = jest.fn().mockResolvedValue(true);
      indicator.registerService('test-service', healthCheck);
      
      indicator.updateServiceStatus('test-service', true);
      
      const serviceStatuses = (indicator as any).serviceStatuses;
      const service = serviceStatuses.get('test-service');
      expect(service.healthy).toBe(true);
    });

    it('should update service status to unhealthy', () => {
      const healthCheck = jest.fn().mockResolvedValue(true);
      indicator.registerService('test-service', healthCheck);
      
      indicator.updateServiceStatus('test-service', false);
      
      const serviceStatuses = (indicator as any).serviceStatuses;
      const service = serviceStatuses.get('test-service');
      expect(service.healthy).toBe(false);
    });

    it('should update lastCheck timestamp', () => {
      const healthCheck = jest.fn().mockResolvedValue(true);
      indicator.registerService('test-service', healthCheck);
      
      const beforeUpdate = new Date();
      indicator.updateServiceStatus('test-service', true);
      const afterUpdate = new Date();
      
      const serviceStatuses = (indicator as any).serviceStatuses;
      const service = serviceStatuses.get('test-service');
      expect(service.lastCheck.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      expect(service.lastCheck.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    });

    it('should not throw error for non-existent service', () => {
      expect(() => {
        indicator.updateServiceStatus('non-existent', true);
      }).not.toThrow();
    });
  });

  describe('isHealthy', () => {
    it('should return healthy status when no services registered', async () => {
      const result = await indicator.isHealthy('dependencies');
      
      expect(result).toHaveProperty('dependencies');
      expect(result.dependencies.status).toBe('up');
    });

    it('should return healthy status when all services are healthy', async () => {
      const healthCheck1 = jest.fn().mockResolvedValue(true);
      const healthCheck2 = jest.fn().mockResolvedValue(true);
      
      indicator.registerService('service1', healthCheck1);
      indicator.registerService('service2', healthCheck2);
      indicator.updateServiceStatus('service1', true);
      indicator.updateServiceStatus('service2', true);
      
      const result = await indicator.isHealthy('dependencies');
      
      expect(result.dependencies.status).toBe('up');
    });

    it('should throw HealthCheckError when any service is unhealthy', async () => {
      const healthCheck1 = jest.fn().mockResolvedValue(true);
      const healthCheck2 = jest.fn().mockResolvedValue(false);
      
      indicator.registerService('service1', healthCheck1);
      indicator.registerService('service2', healthCheck2);
      indicator.updateServiceStatus('service1', true);
      indicator.updateServiceStatus('service2', false);
      
      await expect(indicator.isHealthy('dependencies')).rejects.toThrow(HealthCheckError);
    });

    it('should include all service details', async () => {
      const healthCheck = jest.fn().mockResolvedValue(true);
      
      indicator.registerService('test-service', healthCheck);
      indicator.updateServiceStatus('test-service', true, 50);
      
      const result = await indicator.isHealthy('dependencies');
      
      expect(result.dependencies).toHaveProperty('services');
      expect(result.dependencies.services).toHaveProperty('test-service');
      expect(result.dependencies.services['test-service']).toHaveProperty('healthy', true);
      expect(result.dependencies.services['test-service']).toHaveProperty('responseTime', '50ms');
    });

    it('should include totalServices and healthyServices count', async () => {
      const healthCheck = jest.fn().mockResolvedValue(true);
      
      indicator.registerService('service1', healthCheck);
      indicator.registerService('service2', healthCheck);
      indicator.updateServiceStatus('service1', true);
      indicator.updateServiceStatus('service2', true);
      
      const result = await indicator.isHealthy('dependencies');
      
      expect(result.dependencies.totalServices).toBe(2);
      expect(result.dependencies.healthyServices).toBe(2);
    });
  });
});
