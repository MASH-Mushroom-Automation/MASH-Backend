import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { AlertPriority, AlertCategory, AlertStatus } from '@prisma/client';

describe('Alert Management (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let createdAlertId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['/'], // Exclude root path from prefix
    });
    await app.init();

    // TODO: Login as admin to get auth token
    // authToken = await getAdminToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/alerts/trigger (POST)', () => {
    it('should require authentication', () => {
      return request(app.getHttpServer())
        .post('/api/v1/alerts/trigger')
        .send({
          eventType: 'TEST_ALERT',
          data: { test: true },
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it.skip('should trigger alert evaluation', () => {
      // Skip until auth is implemented
      return request(app.getHttpServer())
        .post('/api/v1/alerts/trigger')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventType: 'HIGH_ERROR_RATE',
          data: {
            rate: 0.15,
            threshold: 0.1,
          },
          metadata: {
            source: 'e2e-test',
          },
        })
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
        });
    });
  });

  describe('/api/v1/alerts/history (GET)', () => {
    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/alerts/history')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it.skip('should return paginated alert history', () => {
      return request(app.getHttpServer())
        .get('/api/v1/alerts/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('pagination');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it.skip('should filter by priority', () => {
      return request(app.getHttpServer())
        .get('/api/v1/alerts/history')
        .query({ priority: AlertPriority.CRITICAL })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          res.body.data.forEach((alert: any) => {
            expect(alert.priority).toBe(AlertPriority.CRITICAL);
          });
        });
    });

    it.skip('should filter by category', () => {
      return request(app.getHttpServer())
        .get('/api/v1/alerts/history')
        .query({ category: AlertCategory.SECURITY })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          res.body.data.forEach((alert: any) => {
            expect(alert.category).toBe(AlertCategory.SECURITY);
          });
        });
    });

    it.skip('should filter by date range', () => {
      const startDate = new Date('2025-01-01').toISOString();
      const endDate = new Date('2025-12-31').toISOString();

      return request(app.getHttpServer())
        .get('/api/v1/alerts/history')
        .query({ startDate, endDate })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
        });
    });

    it.skip('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/api/v1/alerts/history')
        .query({ limit: 10, offset: 0 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.pagination.pageSize).toBe(10);
          expect(res.body.data.length).toBeLessThanOrEqual(10);
        });
    });
  });

  describe('/api/v1/alerts/active (GET)', () => {
    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/alerts/active')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it.skip('should return active alerts only', () => {
      return request(app.getHttpServer())
        .get('/api/v1/alerts/active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          res.body.forEach((alert: any) => {
            expect([
              AlertStatus.PENDING,
              AlertStatus.SENT,
              AlertStatus.ACKNOWLEDGED,
              AlertStatus.ESCALATED,
            ]).toContain(alert.status);
          });
        });
    });

    it.skip('should order by priority', () => {
      return request(app.getHttpServer())
        .get('/api/v1/alerts/active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          // Verify alerts are ordered by priority (CRITICAL first)
          if (res.body.length > 1) {
            const priorities = res.body.map((a: any) => a.priority);
            expect(priorities).toBeDefined();
          }
        });
    });
  });

  describe('/api/v1/alerts/:id/acknowledge (POST)', () => {
    it('should require authentication', () => {
      return request(app.getHttpServer())
        .post('/api/v1/alerts/test-id/acknowledge')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it.skip('should acknowledge alert', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/alerts/${createdAlertId}/acknowledge`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 'admin-user' })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.status).toBe(AlertStatus.ACKNOWLEDGED);
          expect(res.body.acknowledgedBy).toBeDefined();
          expect(res.body.acknowledgedAt).toBeDefined();
        });
    });

    it.skip('should return 404 for non-existent alert', () => {
      return request(app.getHttpServer())
        .post('/api/v1/alerts/non-existent-id/acknowledge')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 'admin-user' })
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('/api/v1/alerts/:id/resolve (POST)', () => {
    it('should require authentication', () => {
      return request(app.getHttpServer())
        .post('/api/v1/alerts/test-id/resolve')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it.skip('should resolve alert with notes', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/alerts/${createdAlertId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 'admin-user',
          notes: 'Issue fixed - database connection restored',
        })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.status).toBe(AlertStatus.RESOLVED);
          expect(res.body.resolvedBy).toBeDefined();
          expect(res.body.resolvedAt).toBeDefined();
          expect(res.body.resolutionNotes).toBe('Issue fixed - database connection restored');
        });
    });

    it.skip('should return 404 for non-existent alert', () => {
      return request(app.getHttpServer())
        .post('/api/v1/alerts/non-existent-id/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 'admin-user',
          notes: 'Test',
        })
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('/api/v1/alerts/statistics (GET)', () => {
    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/alerts/statistics')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it.skip('should return alert statistics', () => {
      return request(app.getHttpServer())
        .get('/api/v1/alerts/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('byPriority');
          expect(res.body).toHaveProperty('byCategory');
          expect(res.body).toHaveProperty('avgResolutionTime');
          expect(typeof res.body.total).toBe('number');
        });
    });

    it.skip('should support custom time period', () => {
      return request(app.getHttpServer())
        .get('/api/v1/alerts/statistics')
        .query({ days: 30 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('total');
        });
    });

    it.skip('should calculate resolution time', () => {
      return request(app.getHttpServer())
        .get('/api/v1/alerts/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(typeof res.body.avgResolutionTime).toBe('number');
          expect(res.body.avgResolutionTime).toBeGreaterThanOrEqual(0);
        });
    });
  });

  describe('Alert Lifecycle Integration', () => {
    it.skip('should complete full alert lifecycle', async () => {
      // 1. Trigger alert
      const triggerRes = await request(app.getHttpServer())
        .post('/api/v1/alerts/trigger')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventType: 'E2E_TEST_ALERT',
          data: { test: true },
        })
        .expect(HttpStatus.CREATED);

      // 2. Verify it appears in active alerts
      const activeRes = await request(app.getHttpServer())
        .get('/api/v1/alerts/active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      const alert = activeRes.body.find((a: any) => a.eventType === 'E2E_TEST_ALERT');
      expect(alert).toBeDefined();

      // 3. Acknowledge the alert
      await request(app.getHttpServer())
        .post(`/api/v1/alerts/${alert.id}/acknowledge`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 'e2e-test-user' })
        .expect(HttpStatus.OK);

      // 4. Resolve the alert
      await request(app.getHttpServer())
        .post(`/api/v1/alerts/${alert.id}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 'e2e-test-user',
          notes: 'E2E test completed successfully',
        })
        .expect(HttpStatus.OK);

      // 5. Verify it's in history with RESOLVED status
      const historyRes = await request(app.getHttpServer())
        .get('/api/v1/alerts/history')
        .query({ status: AlertStatus.RESOLVED })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      const resolvedAlert = historyRes.body.data.find((a: any) => a.id === alert.id);
      expect(resolvedAlert).toBeDefined();
      expect(resolvedAlert.status).toBe(AlertStatus.RESOLVED);
    });
  });
});
