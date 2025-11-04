import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';

describe('Health Checks (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/health (GET)', () => {
    it('should return comprehensive health status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('info');
          expect(res.body).toHaveProperty('details');
          expect(res.body.status).toMatch(/^(ok|error)$/);
        });
    });

    it('should include database health', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect((res) => {
          expect(res.body.details).toHaveProperty('database');
          expect(res.body.details.database).toHaveProperty('status');
        });
    });

    it('should include cache health', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect((res) => {
          expect(res.body.details).toHaveProperty('cache');
          expect(res.body.details.cache).toHaveProperty('status');
        });
    });

    it('should include memory health', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect((res) => {
          expect(res.body.details).toHaveProperty('memory');
          expect(res.body.details.memory).toHaveProperty('status');
          expect(res.body.details.memory).toHaveProperty('heapUsed');
          expect(res.body.details.memory).toHaveProperty('heapTotal');
        });
    });

    it('should include disk health', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect((res) => {
          expect(res.body.details).toHaveProperty('disk');
          expect(res.body.details.disk).toHaveProperty('status');
          expect(res.body.details.disk).toHaveProperty('used');
          expect(res.body.details.disk).toHaveProperty('free');
        });
    });
  });

  describe('/api/v1/health/ready (GET)', () => {
    it('should return readiness status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('details');
        });
    });

    it('should check database connection', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect((res) => {
          expect(res.body.details).toHaveProperty('database');
        });
    });

    it('should check cache connection', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect((res) => {
          expect(res.body.details).toHaveProperty('cache');
        });
    });
  });

  describe('/api/v1/health/live (GET)', () => {
    it('should return liveness status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body.status).toBe('ok');
        });
    });

    it('should check memory usage', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect((res) => {
          expect(res.body.details).toHaveProperty('memory');
        });
    });
  });

  describe('/api/v1/health/detailed (GET)', () => {
    it('should return detailed diagnostics', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/detailed')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('details');
        });
    });

    it('should include all health indicators', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/detailed')
        .expect((res) => {
          expect(res.body.details).toHaveProperty('database');
          expect(res.body.details).toHaveProperty('cache');
          expect(res.body.details).toHaveProperty('memory');
          expect(res.body.details).toHaveProperty('disk');
        });
    });

    it('should include HTTP check', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/detailed')
        .expect((res) => {
          expect(res.body.details).toHaveProperty('http');
        });
    });
  });

  describe('Health Check Response Time', () => {
    it('should respond within 1 second', async () => {
      const start = Date.now();
      
      await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(HttpStatus.OK);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });
  });
});
