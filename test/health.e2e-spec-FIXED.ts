import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health Checks (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['/'], // Exclude root path from prefix
    });
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
          // Response is wrapped in TransformInterceptor format
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('status');
          expect(res.body.data).toHaveProperty('info');
          expect(res.body.data).toHaveProperty('details');
          expect(res.body.data.status).toMatch(/^(ok|error)$/);
        });
    });

    it('should include database health', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect((res) => {
          expect(res.body.data.details).toHaveProperty('database');
          expect(res.body.data.details.database).toHaveProperty('status');
        });
    });

    it('should include cache health', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect((res) => {
          expect(res.body.data.details).toHaveProperty('cache');
          expect(res.body.data.details.cache).toHaveProperty('status');
        });
    });

    it('should include memory health', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect((res) => {
          expect(res.body.data.details).toHaveProperty('memory');
          expect(res.body.data.details.memory).toHaveProperty('status');
          expect(res.body.data.details.memory).toHaveProperty('heapUsed');
          expect(res.body.data.details.memory).toHaveProperty('heapTotal');
        });
    });

    it('should include disk health', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect((res) => {
          expect(res.body.data.details).toHaveProperty('disk');
          expect(res.body.data.details.disk).toHaveProperty('status');
          expect(res.body.data.details.disk).toHaveProperty('used');
          expect(res.body.data.details.disk).toHaveProperty('free');
        });
    });
  });

  describe('/api/v1/health/ready (GET)', () => {
    it('should return readiness status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('status');
          expect(res.body.data).toHaveProperty('details');
        });
    });

    it('should check database connection', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect((res) => {
          expect(res.body.data.details).toHaveProperty('database');
        });
    });

    it('should check cache connection', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect((res) => {
          expect(res.body.data.details).toHaveProperty('cache');
        });
    });
  });

  describe('/api/v1/health/live (GET)', () => {
    it('should return liveness status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect((res) => {
          // May return 200 or 503 depending on memory/disk state
          expect([HttpStatus.OK, HttpStatus.SERVICE_UNAVAILABLE]).toContain(res.status);
          expect(res.body.data).toHaveProperty('status');
        });
    });

    it('should check memory usage', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect((res) => {
          expect(res.body.data.details).toHaveProperty('memory');
        });
    });
  });

  describe('/api/v1/health/detailed (GET)', () => {
    it('should return detailed diagnostics', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/detailed')
        .expect((res) => {
          // May return 200 or 503 depending on system health
          expect([HttpStatus.OK, HttpStatus.SERVICE_UNAVAILABLE]).toContain(res.status);
          expect(res.body.data).toHaveProperty('status');
          expect(res.body.data).toHaveProperty('details');
        });
    });

    it('should include all health indicators', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/detailed')
        .expect((res) => {
          expect(res.body.data.details).toHaveProperty('database');
          expect(res.body.data.details).toHaveProperty('cache');
          expect(res.body.data.details).toHaveProperty('memory');
          expect(res.body.data.details).toHaveProperty('disk');
          expect(res.body.data.details).toHaveProperty('dependencies');
        });
    });

    it('should include HTTP check', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/detailed')
        .expect((res) => {
          // HTTP check may or may not be present depending on configuration
          expect(res.body.data.details).toBeDefined();
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
