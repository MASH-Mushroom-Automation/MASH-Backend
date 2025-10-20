import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  // Mock ConfigService
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        NODE_ENV: 'test',
        PORT: '3000',
        APP_NAME: 'MASH Backend API',
        APP_VERSION: '1.0.0',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    })

      .setLogger(new ConsoleLogger()) // Use ConsoleLogger for NestJS v11 compatibility

      .compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API information', () => {
      const result = appController.getApiInfo();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('status');
    });
  });
});
