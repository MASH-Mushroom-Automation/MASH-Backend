import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleLogger } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../database/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: PrismaService;

  const mockPrismaService = {
    healthCheck: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    })

      .setLogger(new ConsoleLogger()) // Use ConsoleLogger for NestJS v11 compatibility

      .compile();

    controller = module.get<HealthController>(HealthController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkDatabase', () => {
    it('should return database health status', async () => {
      const mockHealth = {
        status: 'ok',
        database: 'neondb',
        responseTime: 45,
        connected: true,
        timestamp: new Date().toISOString(),
      };

      mockPrismaService.healthCheck.mockResolvedValue(mockHealth);

      const result = await controller.checkDatabase();

      expect(result).toEqual(mockHealth);
      expect(prismaService.healthCheck).toHaveBeenCalled();
    });
  });

  describe('checkHealth', () => {
    it('should return API health status', async () => {
      const result = await controller.checkHealth();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('message', 'MASH Backend API is running');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('version', '1.0.0');
    });
  });

  describe('checkSystem', () => {
    it('should return comprehensive system health when database is connected', async () => {
      const mockDbHealth = {
        status: 'ok',
        database: 'neondb',
        responseTime: 45,
        connected: true,
        timestamp: new Date().toISOString(),
      };

      mockPrismaService.healthCheck.mockResolvedValue(mockDbHealth);

      const result = await controller.checkSystem();

      expect(result.status).toBe('healthy');
      expect(result.checks.api).toHaveProperty('status', 'ok');
      expect(result.checks.api).toHaveProperty('uptime');
      expect(result.checks.api).toHaveProperty('memory');
      expect(result.checks.database).toHaveProperty('status', 'ok');
      expect(result.checks.database.connected).toBe(true);
    });

    it('should return degraded status when database is disconnected', async () => {
      const mockDbHealth = {
        status: 'error',
        database: 'neondb',
        responseTime: 0,
        connected: false,
        timestamp: new Date().toISOString(),
      };

      mockPrismaService.healthCheck.mockResolvedValue(mockDbHealth);

      const result = await controller.checkSystem();

      expect(result.status).toBe('degraded');
      expect(result.checks.database.status).toBe('error');
      expect(result.checks.database.connected).toBe(false);
    });
  });
});
