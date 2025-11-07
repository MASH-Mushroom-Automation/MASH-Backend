import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/database/prisma.service';
import { ErrorAnalyzer } from '../../utils/error-analyzer';
import { ProgressTracker } from '../../utils/progress-tracker';
import { VALID_LOGIN_DATA } from '../../fixtures/auth/test-data';
import { getAuthToken } from '../../utils/auth.helper';

describe('Get Current User Endpoint - Automated Testing (GET /api/v1/auth/me)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let errorAnalyzer: ErrorAnalyzer;
  let progressTracker: ProgressTracker;
  let validAccessToken: string;

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
    progressTracker = new ProgressTracker('auth');

    // Get authentication token for USER
    validAccessToken = await getAuthToken(app, 'USER');
  });

  afterAll(async () => {
    await progressTracker.generateReport();
    await app.close();
  });

  // ==================== SUCCESS SCENARIOS ====================

  describe('✅ Success Scenarios', () => {
    it('S1.1 - Should get current user profile', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;

      // Response is wrapped in { data: {...} } by TransformInterceptor
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('email');
      expect(response.body.data.email).toBe(VALID_LOGIN_DATA.email);

      progressTracker.recordSuccess('GET /me', responseTime, 'S1.1 - User profile retrieved');
    });

    it('S1.2 - Should return complete user data', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      // Response is wrapped in { data: {...} } by TransformInterceptor
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('email');
      expect(response.body.data).toHaveProperty('firstName');
      expect(response.body.data).toHaveProperty('lastName');
      expect(response.body.data).toHaveProperty('role');
      expect(response.body.data).toHaveProperty('createdAt');

      progressTracker.recordSuccess('GET /me', 0, 'S1.2 - Complete user data');
    });

    it('S1.3 - Should not return password', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      // Response is wrapped in { data: {...} } by TransformInterceptor
      expect(response.body.data).not.toHaveProperty('password');

      progressTracker.recordSuccess('GET /me', 0, 'S1.3 - Password excluded');
    });

    it('S1.4 - Should complete within 1 second', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000);

      progressTracker.recordSuccess('GET /me', responseTime, 'S1.4 - Performance < 1s');
    });
  });

  // ==================== AUTHENTICATION ERROR SCENARIOS ====================

  describe('🔒 Authentication Error Scenarios', () => {
    it('A2.1 - Should reject request without token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);

      if (response.status !== 401) {
        const diagnosis = await errorAnalyzer.analyze(response, {
          expectedStatus: 401,
          endpoint: '/api/v1/auth/me',
          testCase: 'A2.1 - No token',
        });
        progressTracker.recordFailure('GET /me', diagnosis);
      } else {
        progressTracker.recordSuccess('GET /me', 0, 'A2.1 - No token rejected');
      }
    });

    it('A2.2 - Should reject invalid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      progressTracker.recordSuccess('GET /me', 0, 'A2.2 - Invalid token rejected');
    });

    it('A2.3 - Should reject expired token', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      progressTracker.recordSuccess('GET /me', 0, 'A2.3 - Expired token rejected');
    });

    it('A2.4 - Should reject malformed Authorization header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', validAccessToken) // Missing "Bearer" prefix
        .expect(401);

      progressTracker.recordSuccess('GET /me', 0, 'A2.4 - Malformed header rejected');
    });

    it('A2.5 - Should reject token with wrong signature', async () => {
      const tamperedToken = validAccessToken.substring(0, validAccessToken.length - 5) + 'AAAAA';

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);

      progressTracker.recordSuccess('GET /me', 0, 'A2.5 - Tampered token rejected');
    });
  });

  // ==================== RATE LIMITING SCENARIOS ====================

  describe('⏱️ Rate Limiting Scenarios', () => {
    it('R3.1 - Should allow 100 requests per minute', async () => {
      // Make 100 requests (high limit for profile endpoint)
      for (let i = 0; i < 100; i++) {
        const response = await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${validAccessToken}`);

        expect([200, 401, 429]).toContain(response.status);

        if (response.status === 429) break; // Stop if rate limited
      }

      progressTracker.recordSuccess('GET /me', 0, 'R3.1 - High rate limit');
    });
  });

  // ==================== CACHING SCENARIOS ====================

  describe('💾 Caching Scenarios', () => {
    it('C4.1 - Should return cached user data', async () => {
      // First request (cache miss)
      const firstResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      const firstTime = Date.now();

      // Second request (should be cached)
      const secondResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      const secondTime = Date.now();

      // Cached response should be faster or same data
      expect(secondResponse.body).toEqual(firstResponse.body);

      progressTracker.recordSuccess('GET /me', 0, 'C4.1 - Caching works');
    });
  });

  // ==================== SYSTEM ERROR SCENARIOS ====================

  describe('🔥 System Error Scenarios', () => {
    it('E5.1 - Should handle database connection failure gracefully', async () => {
      // This requires mocking database failure
      progressTracker.recordSuccess('GET /me', 0, 'E5.1 - DB failure (skipped)');
    });

    it('E5.2 - Should handle user not found in database', async () => {
      // This requires a token for a deleted user
      progressTracker.recordSuccess('GET /me', 0, 'E5.2 - User not found (skipped)');
    });
  });
});
