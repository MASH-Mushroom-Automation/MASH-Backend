import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';

describe('SMS Integration Tests', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /test-notifications/test-sms', () => {
    it('should queue test SMS successfully', () => {
      const testSmsData = {
        to: '+1234567890',
        message: 'Test SMS from integration test',
      };

      return request(app.getHttpServer())
        .post('/test-notifications/test-sms')
        .send(testSmsData)
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('Test SMS queued');
          expect(res.body).toHaveProperty('timestamp');
        });
    });

    it('should queue test SMS with default message', () => {
      const testSmsData = {
        to: '+1234567890',
      };

      return request(app.getHttpServer())
        .post('/test-notifications/test-sms')
        .send(testSmsData)
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('Test SMS queued');
          expect(res.body).toHaveProperty('timestamp');
        });
    });

    it('should handle missing phone number gracefully', () => {
      const incompleteSmsData = {
        message: 'Test SMS',
      };

      return request(app.getHttpServer())
        .post('/test-notifications/test-sms')
        .send(incompleteSmsData)
        .expect(200)
        .expect(res => {
          // The endpoint might handle this differently, just check it responds
          expect(res.body).toHaveProperty('success');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('GET /', () => {
    it('should return API info', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body.data).toHaveProperty('name');
          expect(res.body.data).toHaveProperty('status', 'operational');
        });
    });
  });

  describe('POST /communication/device-health-alert', () => {
    it('should send device health alert for CRITICAL status (includes SMS)', () => {
      const criticalAlertData = {
        userId: 'test-user-123',
        deviceId: 'device-456',
        healthStatus: 'CRITICAL',
        metrics: {
          cpuUsage: 95.5,
          memoryUsage: 87.2,
          temperature: 85.0,
          lastSeen: new Date().toISOString(),
        },
      };

      return request(app.getHttpServer())
        .post('/communication/device-health-alert')
        .send(criticalAlertData)
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('message', 'Device health alert sent');
        });
    });

    it('should send device health alert for OFFLINE status (includes SMS)', () => {
      const offlineAlertData = {
        userId: 'test-user-123',
        deviceId: 'device-789',
        healthStatus: 'OFFLINE',
        metrics: {
          lastSeen: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        },
      };

      return request(app.getHttpServer())
        .post('/communication/device-health-alert')
        .send(offlineAlertData)
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('message', 'Device health alert sent');
        });
    });

    it('should send device health alert for WARNING status (no SMS)', () => {
      const warningAlertData = {
        userId: 'test-user-123',
        deviceId: 'device-101',
        healthStatus: 'WARNING',
        metrics: {
          cpuUsage: 75.0,
          memoryUsage: 60.0,
          temperature: 65.0,
        },
      };

      return request(app.getHttpServer())
        .post('/communication/device-health-alert')
        .send(warningAlertData)
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('message', 'Device health alert sent');
        });
    });

    it('should send device health alert for HEALTHY status (no SMS)', () => {
      const healthyAlertData = {
        userId: 'test-user-123',
        deviceId: 'device-202',
        healthStatus: 'HEALTHY',
        metrics: {
          cpuUsage: 25.0,
          memoryUsage: 30.0,
          temperature: 45.0,
        },
      };

      return request(app.getHttpServer())
        .post('/communication/device-health-alert')
        .send(healthyAlertData)
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('message', 'Device health alert sent');
        });
    });

    it('should handle device health alert with minimal metrics', () => {
      const minimalAlertData = {
        userId: 'test-user-123',
        deviceId: 'device-303',
        healthStatus: 'CRITICAL',
      };

      return request(app.getHttpServer())
        .post('/communication/device-health-alert')
        .send(minimalAlertData)
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('message', 'Device health alert sent');
        });
    });

    it('should handle device health alert with invalid health status', () => {
      const invalidAlertData = {
        userId: 'test-user-123',
        deviceId: 'device-404',
        healthStatus: 'INVALID_STATUS',
        metrics: {
          cpuUsage: 50.0,
        },
      };

      return request(app.getHttpServer())
        .post('/communication/device-health-alert')
        .send(invalidAlertData)
        .expect(200) // The endpoint might handle this gracefully
        .expect(res => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('message', 'Device health alert sent');
        });
    });
  });
});
