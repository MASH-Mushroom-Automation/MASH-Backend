import { Test, TestingModule } from '@nestjs/testing';
import { GatewayService } from '../gateway.service';
import { PrismaService } from '../../../../database/prisma.service';
import { RedisService } from '../../../../database/redis.service';
import { PrometheusService } from '../../../../monitoring/prometheus/prometheus.service';
import { LoadBalancingStrategy } from '@prisma/client';

describe('GatewayService', () => {
  let service: GatewayService;
  let prisma: PrismaService;
  let redis: RedisService;
  let prometheus: PrometheusService;

  const mockRoute = {
    id: '1',
    serviceName: 'orders',
    basePath: '/api/v1/orders',
    targetUrl: 'http://orders-service:3001',
    healthCheckUrl: 'http://orders-service:3001/health',
    timeout: 30000,
    retryAttempts: 3,
    circuitBreaker: true,
    loadBalancing: LoadBalancingStrategy.ROUND_ROBIN,
    isActive: true,
    priority: 0,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayService,
        {
          provide: PrismaService,
          useValue: {
            apiGatewayConfig: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn().mockResolvedValue(true),
            delete: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: PrometheusService,
          useValue: {
            apiEndpointRequests: {
              inc: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<GatewayService>(GatewayService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    prometheus = module.get<PrometheusService>(PrometheusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRoutes', () => {
    it('should return routes from cache if available', async () => {
      const cachedRoutes = [
        {
          ...mockRoute,
          createdAt: mockRoute.createdAt.toISOString(),
          updatedAt: mockRoute.updatedAt.toISOString(),
        },
      ];
      jest.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(cachedRoutes));

      const result = await service.getRoutes();

      expect(result[0].serviceName).toBe('orders');
      expect(redis.get).toHaveBeenCalledWith('gateway:routes:all');
      expect(prisma.apiGatewayConfig.findMany).not.toHaveBeenCalled();
    });

    it('should fetch routes from database if not in cache', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue(null);
      jest.spyOn(prisma.apiGatewayConfig, 'findMany').mockResolvedValue([mockRoute]);

      const result = await service.getRoutes();

      expect(result).toHaveLength(1);
      expect(result[0].serviceName).toBe('orders');
      expect(redis.get).toHaveBeenCalled();
      expect(prisma.apiGatewayConfig.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      });
      expect(redis.set).toHaveBeenCalled();
    });

    it('should cache routes after fetching from database', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue(null);
      jest.spyOn(prisma.apiGatewayConfig, 'findMany').mockResolvedValue([mockRoute]);

      await service.getRoutes();

      expect(redis.set).toHaveBeenCalledWith(
        'gateway:routes:all',
        expect.any(String),
        300, // TTL
      );
    });
  });

  describe('matchRoute', () => {
    it('should match exact route path', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue(JSON.stringify([mockRoute]));

      const result = await service.matchRoute('GET', '/api/v1/orders');

      expect(result).not.toBeNull();
      expect(result?.route.serviceName).toBe('orders');
      expect(result?.params).toEqual({});
    });

    it('should extract path parameters', async () => {
      const routeWithParam = {
        ...mockRoute,
        basePath: '/api/v1/orders/:id',
      };
      jest.spyOn(redis, 'get').mockResolvedValue(JSON.stringify([routeWithParam]));

      const result = await service.matchRoute('GET', '/api/v1/orders/123');

      expect(result).not.toBeNull();
      expect(result?.params).toEqual({ id: '123' });
    });

    it('should parse query parameters', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue(JSON.stringify([mockRoute]));

      const result = await service.matchRoute('GET', '/api/v1/orders', 'status=pending&limit=10');

      expect(result).not.toBeNull();
      expect(result?.queryParams).toEqual({
        status: 'pending',
        limit: '10',
      });
    });

    it('should handle multiple values for same query parameter', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue(JSON.stringify([mockRoute]));

      const result = await service.matchRoute('GET', '/api/v1/orders', 'tag=electronics&tag=sale');

      expect(result?.queryParams.tag).toEqual(['electronics', 'sale']);
    });

    it('should return null if no route matches', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue(JSON.stringify([mockRoute]));

      const result = await service.matchRoute('GET', '/api/v1/nonexistent');

      expect(result).toBeNull();
    });

    it('should record metrics on route match', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue(JSON.stringify([mockRoute]));

      await service.matchRoute('GET', '/api/v1/orders');

      expect(prometheus.apiEndpointRequests.inc).toHaveBeenCalledWith({
        endpoint: '/api/v1/orders',
        method: 'GET',
        service: 'orders',
      });
    });
  });

  describe('buildTargetUrl', () => {
    it('should build target URL without query parameters', () => {
      const match = {
        route: mockRoute,
        params: {},
        queryParams: {},
      };

      const result = service.buildTargetUrl(match, '/api/v1/orders');

      expect(result).toBe('http://orders-service:3001');
    });

    it('should build target URL with path parameters', () => {
      const match = {
        route: { ...mockRoute, basePath: '/api/v1/orders/:id' },
        params: { id: '123' },
        queryParams: {},
      };

      const result = service.buildTargetUrl(match, '/api/v1/orders/123');

      // The buildTargetUrl method replaces basePath with targetUrl and appends remaining path
      expect(result).toBe('http://orders-service:3001/api/v1/orders/123');
    });

    it('should build target URL with query parameters', () => {
      const match = {
        route: mockRoute,
        params: {},
        queryParams: { status: 'pending', limit: '10' },
      };

      const result = service.buildTargetUrl(match, '/api/v1/orders');

      expect(result).toBe('http://orders-service:3001?status=pending&limit=10');
    });

    it('should handle array query parameters', () => {
      const match = {
        route: mockRoute,
        params: {},
        queryParams: { tag: ['electronics', 'sale'] },
      };

      const result = service.buildTargetUrl(match, '/api/v1/orders');

      expect(result).toContain('tag=electronics');
      expect(result).toContain('tag=sale');
    });
  });

  describe('invalidateCache', () => {
    it('should delete cache key', async () => {
      await service.invalidateCache();

      expect(redis.delete).toHaveBeenCalledWith('gateway:routes:all');
    });
  });

  describe('getStatistics', () => {
    it('should return gateway statistics', async () => {
      const routes = [
        mockRoute,
        {
          ...mockRoute,
          id: '2',
          serviceName: 'products',
          circuitBreaker: false,
        },
      ];
      jest.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(routes));

      const result = await service.getStatistics();

      expect(result.totalRoutes).toBe(2);
      expect(result.activeServices).toBe(2);
      expect(result.circuitBreakerEnabled).toBe(1);
      expect(result.loadBalancingStrategies).toHaveProperty('ROUND_ROBIN');
    });
  });
});
