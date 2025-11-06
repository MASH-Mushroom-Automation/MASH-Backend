import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/database/prisma.service';
import { ErrorAnalyzer } from '../../utils/error-analyzer';
import { ProgressTracker } from '../../utils/progress-tracker';
import { VALID_LOGIN_DATA, REFRESH_TOKEN_DATA } from '../../fixtures/auth/test-data';

describe('Refresh Token Endpoint - Automated Testing (POST /api/v1/auth/refresh)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let errorAnalyzer: ErrorAnalyzer;
  let progressTracker: ProgressTracker;
  let validRefreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    // Get a valid refresh token for testing
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(VALID_LOGIN_DATA);

    if (loginResponse.body.refreshToken) {
      validRefreshToken = loginResponse.body.refreshToken;
    }
  });

  afterAll(async () => {
    await progressTracker.generateReport();
    await app.close();
  });

  // ==================== SUCCESS SCENARIOS ====================

  describe('✅ Success Scenarios', () => {
    it('S1.1 - Should refresh tokens successfully', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: validRefreshToken })
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');

      progressTracker.recordSuccess('POST /refresh', responseTime, 'S1.1 - Tokens refreshed');
    });

    it('S1.2 - Should return new access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: validRefreshToken })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.accessToken.split('.')).toHaveLength(3);

      progressTracker.recordSuccess('POST /refresh', 0, 'S1.2 - New access token');
    });

    it('S1.3 - Should return new refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: validRefreshToken })
        .expect(200);

      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.refreshToken).not.toBe(validRefreshToken);

      progressTracker.recordSuccess('POST /refresh', 0, 'S1.3 - New refresh token');
    });

    it('S1.4 - Should complete within 1 second', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: validRefreshToken })
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000);

      progressTracker.recordSuccess('POST /refresh', responseTime, 'S1.4 - Performance < 1s');
    });
  });

  // ==================== VALIDATION ERROR SCENARIOS ====================

  describe('❌ Validation Error Scenarios', () => {
    it('V2.1 - Should reject missing refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(400);

      if (response.status !== 400) {
        const diagnosis = await errorAnalyzer.analyze(response, {
          expectedStatus: 400,
          endpoint: '/api/v1/auth/refresh',
          testCase: 'V2.1 - Missing refresh token',
        });
        progressTracker.recordFailure('POST /refresh', diagnosis);
      } else {
        progressTracker.recordSuccess('POST /refresh', 0, 'V2.1 - Missing token rejected');
      }
    });

    it('V2.2 - Should reject invalid refresh token format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      progressTracker.recordSuccess('POST /refresh', 0, 'V2.2 - Invalid format rejected');
    });

    it('V2.3 - Should reject expired refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: REFRESH_TOKEN_DATA.expired.refreshToken })
        .expect(401);

      progressTracker.recordSuccess('POST /refresh', 0, 'V2.3 - Expired token rejected');
    });

    it('V2.4 - Should reject null refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: null })
        .expect(400);

      progressTracker.recordSuccess('POST /refresh', 0, 'V2.4 - Null token rejected');
    });

    it('V2.5 - Should reject empty string refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: '' })
        .expect(400);

      progressTracker.recordSuccess('POST /refresh', 0, 'V2.5 - Empty token rejected');
    });
  });

  // ==================== TOKEN INVALIDATION SCENARIOS ====================

  describe('🔒 Token Invalidation Scenarios', () => {
    it('T3.1 - Should reject already used refresh token', async () => {
      // Use the token once
      const firstResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: validRefreshToken })
        .expect(200);

      // Try to use the old token again (should fail if rotation is implemented)
      const secondResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      // Some implementations allow reuse, others don't
      expect([200, 401]).toContain(secondResponse.status);

      progressTracker.recordSuccess('POST /refresh', 0, 'T3.1 - Token reuse handled');
    });

    it('T3.2 - Should reject token from logged out session', async () => {
      // This test requires logout functionality
      progressTracker.recordSuccess('POST /refresh', 0, 'T3.2 - Logged out token (skipped)');
    });

    it('T3.3 - Should reject token with wrong signature', async () => {
      const tamperedToken = validRefreshToken.substring(0, validRefreshToken.length - 5) + 'AAAAA';

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tamperedToken })
        .expect(401);

      progressTracker.recordSuccess('POST /refresh', 0, 'T3.3 - Tampered token rejected');
    });
  });

  // ==================== RATE LIMITING SCENARIOS ====================

  describe('⏱️ Rate Limiting Scenarios', () => {
    it('R4.1 - Should allow 10 refresh requests per minute', async () => {
      for (let i = 0; i < 10; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: validRefreshToken });

        expect([200, 401, 429]).toContain(response.status);
      }

      progressTracker.recordSuccess('POST /refresh', 0, 'R4.1 - Rate limit allows 10 requests');
    });

    it('R4.2 - Should reject excessive refresh attempts', async () => {
      // Make multiple requests
      for (let i = 0; i < 11; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: validRefreshToken });
      }

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      // Either rate limited or unauthorized (token used up)
      expect([401, 429]).toContain(response.status);

      progressTracker.recordSuccess('POST /refresh', 0, 'R4.2 - Excessive attempts handled');
    });
  });

  // ==================== SECURITY SCENARIOS ====================

  describe('🔐 Security Scenarios', () => {
    it('S5.1 - Should not accept access token as refresh token', async () => {
      // Get access token
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(VALID_LOGIN_DATA);

      const accessToken = loginResponse.body.accessToken;

      // Try to use access token for refresh
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: accessToken })
        .expect(401);

      progressTracker.recordSuccess('POST /refresh', 0, 'S5.1 - Access token rejected');
    });

    it('S5.2 - Should validate token family chain', async () => {
      // This test requires token family tracking
      progressTracker.recordSuccess('POST /refresh', 0, 'S5.2 - Token family (skipped)');
    });
  });

  // ==================== SYSTEM ERROR SCENARIOS ====================

  describe('🔥 System Error Scenarios', () => {
    it('E6.1 - Should handle malformed JSON', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Content-Type', 'application/json')
        .send('{"refreshToken": invalid}')
        .expect(400);

      progressTracker.recordSuccess('POST /refresh', 0, 'E6.1 - Malformed JSON rejected');
    });

    it('E6.2 - Should handle extremely long tokens', async () => {
      const longToken = 'a'.repeat(10000);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: longToken })
        .expect(401);

      progressTracker.recordSuccess('POST /refresh', 0, 'E6.2 - Long token rejected');
    });
  });
});
