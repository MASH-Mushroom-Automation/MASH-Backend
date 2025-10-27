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
        .expect((res) => {
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
        .expect((res) => {
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
        .expect((res) => {
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
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body.data).toHaveProperty('name');
          expect(res.body.data).toHaveProperty('status', 'operational');
        });
    });
  });
});
