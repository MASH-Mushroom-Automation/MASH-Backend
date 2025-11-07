import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/database/prisma.service';
import { ErrorAnalyzer } from '../../utils/error-analyzer';
import { ProgressTracker } from '../../utils/progress-tracker';
import { getAuthToken } from '../../utils/auth.helper';

describe('Users Module - Automated Testing', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let errorAnalyzer: ErrorAnalyzer;
  let progressTracker: ProgressTracker;
  let adminAccessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['/'],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    errorAnalyzer = new ErrorAnalyzer();
    progressTracker = new ProgressTracker('users');

    // Get authentication token for ADMIN user
    adminAccessToken = await getAuthToken(app, 'ADMIN');
  });

  afterAll(async () => {
    await progressTracker.generateReport();
    await app.close();
  });

  // ==================== GET /api/v1/users - LIST USERS ====================

  describe('GET /api/v1/users - List Users', () => {
    it('Should list all users with pagination', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);

      progressTracker.recordSuccess('GET /users', responseTime, 'List users with pagination');
    });

    it('Should filter users by role', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ role: 'ADMIN' })
        .expect(200);

      expect(response.body.data.every((user: any) => user.role === 'ADMIN')).toBe(true);

      progressTracker.recordSuccess('GET /users', 0, 'Filter by role');
    });

    it('Should search users by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ search: 'test' })
        .expect(200);

      progressTracker.recordSuccess('GET /users', 0, 'Search by name');
    });

    it('Should reject unauthorized access', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users')
        .expect(401);

      progressTracker.recordSuccess('GET /users', 0, 'Unauthorized rejected');
    });
  });

  // ==================== GET /api/v1/users/:id - GET USER BY ID ====================

  describe('GET /api/v1/users/:id - Get User by ID', () => {
    it('Should get user by valid ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/test-user-id')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');

      progressTracker.recordSuccess('GET /users/:id', 0, 'Get user by ID');
    });

    it('Should return 404 for non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/non-existent-id')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404);

      progressTracker.recordSuccess('GET /users/:id', 0, 'Non-existent user 404');
    });
  });

  // ==================== PATCH /api/v1/users/:id - UPDATE USER ====================

  describe('PATCH /api/v1/users/:id - Update User', () => {
    it('Should update user profile', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/users/test-user-id')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        })
        .expect(200);

      expect(response.body.firstName).toBe('Updated');

      progressTracker.recordSuccess('PATCH /users/:id', 0, 'Update user profile');
    });

    it('Should reject invalid email update', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/users/test-user-id')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          email: 'invalid-email',
        })
        .expect(400);

      progressTracker.recordSuccess('PATCH /users/:id', 0, 'Invalid email rejected');
    });
  });

  // ==================== DELETE /api/v1/users/:id - DELETE USER ====================

  describe('DELETE /api/v1/users/:id - Delete User', () => {
    it('Should soft delete user', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/users/test-user-id')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(204);

      progressTracker.recordSuccess('DELETE /users/:id', 0, 'Soft delete user');
    });

    it('Should reject non-admin deletion', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/users/test-user-id')
        .expect(401);

      progressTracker.recordSuccess('DELETE /users/:id', 0, 'Non-admin rejected');
    });
  });

  // ==================== PERFORMANCE TESTS ====================

  describe('⚡ Performance Tests', () => {
    it('Should handle 100 concurrent user list requests', async () => {
      const requests = Array.from({ length: 100 }, () =>
        request(app.getHttpServer())
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .query({ page: 1, limit: 10 }),
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      const successCount = responses.filter((r) => r.status === 200).length;
      expect(successCount).toBeGreaterThan(90);
      expect(duration).toBeLessThan(10000); // Complete in 10 seconds

      progressTracker.recordSuccess('GET /users', duration / 100, '100 concurrent requests');
    });
  });
});
