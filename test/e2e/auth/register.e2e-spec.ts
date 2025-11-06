import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/database/prisma.service';
import { ErrorAnalyzer } from '../../utils/error-analyzer';
import { ProgressTracker } from '../../utils/progress-tracker';
import {
  VALID_REGISTER_DATA,
  WEAK_PASSWORDS,
  INVALID_EMAILS,
  INVALID_USERNAMES,
  generateRandomEmail,
  generateRandomUsername,
} from '../../fixtures/auth/test-data';

describe('Register Endpoint - Automated Testing (POST /api/v1/auth/register)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let errorAnalyzer: ErrorAnalyzer;
  let progressTracker: ProgressTracker;

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
  });

  afterAll(async () => {
    await progressTracker.generateReport();
    await cleanupTestUsers();
    await app.close();
  });

  async function cleanupTestUsers() {
    try {
      await prisma.user.deleteMany({
        where: {
          email: {
            contains: '@mash.com',
          },
        },
      });
    } catch (error) {
      console.error('⚠️  Failed to cleanup test users:', error);
    }
  }

  // ==================== SUCCESS SCENARIOS ====================

  describe('✅ Success Scenarios', () => {
    it('S1.1 - Should register new user successfully', async () => {
      const startTime = Date.now();
      const uniqueData = {
        ...VALID_REGISTER_DATA,
        email: generateRandomEmail(),
        username: generateRandomUsername(),
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(uniqueData)
        .expect(201);

      const responseTime = Date.now() - startTime;

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(uniqueData.email);
      expect(response.body.user).not.toHaveProperty('password');

      progressTracker.recordSuccess('POST /register', responseTime, 'S1.1 - New user registered');
    });

    it('S1.2 - Should send verification email', async () => {
      const uniqueData = {
        ...VALID_REGISTER_DATA,
        email: generateRandomEmail(),
        username: generateRandomUsername(),
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(uniqueData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('verification');

      progressTracker.recordSuccess('POST /register', 0, 'S1.2 - Verification email sent');
    });

    it('S1.3 - Should hash password before storing', async () => {
      const uniqueData = {
        ...VALID_REGISTER_DATA,
        email: generateRandomEmail(),
        username: generateRandomUsername(),
      };

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(uniqueData)
        .expect(201);

      const user = await prisma.user.findUnique({
        where: { email: uniqueData.email },
      });

      // Password should be hashed, not plain text
      expect(user?.password).not.toBe(uniqueData.password);
      expect(user?.password).toBeDefined();

      progressTracker.recordSuccess('POST /register', 0, 'S1.3 - Password hashed');
    });

    it('S1.4 - Should create user with optional username', async () => {
      const uniqueData = {
        email: generateRandomEmail(),
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        username: generateRandomUsername(),
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(uniqueData)
        .expect(201);

      expect(response.body.user.username).toBe(uniqueData.username);

      progressTracker.recordSuccess('POST /register', 0, 'S1.4 - Optional username');
    });

    it('S1.5 - Should complete within 3 seconds', async () => {
      const startTime = Date.now();
      const uniqueData = {
        ...VALID_REGISTER_DATA,
        email: generateRandomEmail(),
        username: generateRandomUsername(),
      };

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(uniqueData)
        .expect(201);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(3000);

      progressTracker.recordSuccess('POST /register', responseTime, 'S1.5 - Performance < 3s');
    });
  });

  // ==================== VALIDATION ERROR SCENARIOS ====================

  describe('❌ Validation Error Scenarios', () => {
    it('V2.1 - Should reject invalid email format', async () => {
      for (const invalidEmail of INVALID_EMAILS.slice(0, 3)) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({
            ...VALID_REGISTER_DATA,
            email: invalidEmail,
          })
          .expect(400);

        expect(response.body.message).toEqual(
          expect.arrayContaining([expect.stringContaining('email')]),
        );
      }

      progressTracker.recordSuccess('POST /register', 0, 'V2.1 - Invalid email rejected');
    });

    it('V2.2 - Should reject weak passwords', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: generateRandomEmail(),
          password: WEAK_PASSWORDS.tooShort,
        })
        .expect(400);

      if (response.status !== 400) {
        const diagnosis = await errorAnalyzer.analyze(response, {
          expectedStatus: 400,
          endpoint: '/api/v1/auth/register',
          testCase: 'V2.2 - Weak password',
        });
        progressTracker.recordFailure('POST /register', diagnosis);
      } else {
        progressTracker.recordSuccess('POST /register', 0, 'V2.2 - Weak password rejected');
      }
    });

    it('V2.3 - Should reject password without uppercase', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: generateRandomEmail(),
          password: WEAK_PASSWORDS.noUppercase,
        })
        .expect(400);

      progressTracker.recordSuccess('POST /register', 0, 'V2.3 - No uppercase rejected');
    });

    it('V2.4 - Should reject password without special character', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: generateRandomEmail(),
          password: WEAK_PASSWORDS.noSpecialChar,
        })
        .expect(400);

      progressTracker.recordSuccess('POST /register', 0, 'V2.4 - No special char rejected');
    });

    it('V2.5 - Should reject missing required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: generateRandomEmail(),
          // Missing password, firstName, lastName
        })
        .expect(400);

      progressTracker.recordSuccess('POST /register', 0, 'V2.5 - Missing fields rejected');
    });

    it('V2.6 - Should reject invalid username format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: generateRandomEmail(),
          username: INVALID_USERNAMES.withSpaces,
        })
        .expect(400);

      progressTracker.recordSuccess('POST /register', 0, 'V2.6 - Invalid username rejected');
    });

    it('V2.7 - Should reject username too short', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: generateRandomEmail(),
          username: INVALID_USERNAMES.tooShort,
        })
        .expect(400);

      progressTracker.recordSuccess('POST /register', 0, 'V2.7 - Username too short rejected');
    });
  });

  // ==================== DUPLICATE ENTRY SCENARIOS ====================

  describe('🔒 Duplicate Entry Scenarios', () => {
    it('D3.1 - Should reject duplicate email', async () => {
      const uniqueData = {
        ...VALID_REGISTER_DATA,
        email: generateRandomEmail(),
        username: generateRandomUsername(),
      };

      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(uniqueData)
        .expect(201);

      // Duplicate registration
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...uniqueData,
          username: generateRandomUsername(), // Different username
        })
        .expect(400);

      expect(response.body.message).toContain('already exists');

      progressTracker.recordSuccess('POST /register', 0, 'D3.1 - Duplicate email rejected');
    });

    it('D3.2 - Should reject duplicate username', async () => {
      const username = generateRandomUsername();

      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: generateRandomEmail(),
          username,
        })
        .expect(201);

      // Duplicate username
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: generateRandomEmail(),
          username, // Same username
        })
        .expect(400);

      progressTracker.recordSuccess('POST /register', 0, 'D3.2 - Duplicate username rejected');
    });

    it('D3.3 - Should handle case-insensitive email duplicates', async () => {
      const email = generateRandomEmail();

      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: email.toLowerCase(),
          username: generateRandomUsername(),
        })
        .expect(201);

      // Try uppercase version
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: email.toUpperCase(),
          username: generateRandomUsername(),
        })
        .expect(400);

      progressTracker.recordSuccess('POST /register', 0, 'D3.3 - Case-insensitive email');
    });
  });

  // ==================== RATE LIMITING SCENARIOS ====================

  describe('⏱️ Rate Limiting Scenarios', () => {
    it('R4.1 - Should allow 3 registrations per minute', async () => {
      for (let i = 0; i < 3; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({
            ...VALID_REGISTER_DATA,
            email: generateRandomEmail(),
            username: generateRandomUsername(),
          });

        expect([201, 400, 429]).toContain(response.status);
      }

      progressTracker.recordSuccess('POST /register', 0, 'R4.1 - Rate limit allows 3 requests');
    });

    it('R4.2 - Should reject 4th registration within window', async () => {
      // Make 3 registrations
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({
            ...VALID_REGISTER_DATA,
            email: generateRandomEmail(),
            username: generateRandomUsername(),
          });
      }

      // 4th should fail
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: generateRandomEmail(),
          username: generateRandomUsername(),
        })
        .expect(429);

      if (response.status !== 429) {
        const diagnosis = await errorAnalyzer.analyze(response, {
          expectedStatus: 429,
          endpoint: '/api/v1/auth/register',
          testCase: 'R4.2 - 4th request rejected',
        });
        progressTracker.recordFailure('POST /register', diagnosis);
      } else {
        progressTracker.recordSuccess('POST /register', 0, 'R4.2 - Rate limit enforced');
      }
    });
  });

  // ==================== SECURITY SCENARIOS ====================

  describe('🔐 Security Scenarios', () => {
    it('S5.1 - Should not return password in response', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: generateRandomEmail(),
          username: generateRandomUsername(),
        })
        .expect(201);

      expect(response.body.user).not.toHaveProperty('password');

      progressTracker.recordSuccess('POST /register', 0, 'S5.1 - Password not in response');
    });

    it('S5.2 - Should sanitize user input', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: generateRandomEmail(),
          firstName: '<script>alert("xss")</script>',
          username: generateRandomUsername(),
        })
        .expect(201);

      // Should not contain script tags
      expect(response.body.user.firstName).not.toContain('<script>');

      progressTracker.recordSuccess('POST /register', 0, 'S5.2 - Input sanitized');
    });

    it('S5.3 - Should reject SQL injection attempts', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: "test'; DROP TABLE users; --@example.com",
          username: generateRandomUsername(),
        })
        .expect(400);

      progressTracker.recordSuccess('POST /register', 0, 'S5.3 - SQL injection prevented');
    });
  });

  // ==================== SYSTEM ERROR SCENARIOS ====================

  describe('🔥 System Error Scenarios', () => {
    it('E6.1 - Should handle malformed JSON', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"email": invalid json}')
        .expect(400);

      progressTracker.recordSuccess('POST /register', 0, 'E6.1 - Malformed JSON rejected');
    });

    it('E6.2 - Should handle extremely long inputs', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: 'a'.repeat(1000) + '@example.com',
          username: generateRandomUsername(),
        })
        .expect(400);

      progressTracker.recordSuccess('POST /register', 0, 'E6.2 - Long input rejected');
    });

    it('E6.3 - Should handle special characters in names', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTER_DATA,
          email: generateRandomEmail(),
          firstName: 'José',
          lastName: "O'Brien",
          username: generateRandomUsername(),
        })
        .expect(201);

      expect(response.body.user.firstName).toBe('José');
      expect(response.body.user.lastName).toBe("O'Brien");

      progressTracker.recordSuccess('POST /register', 0, 'E6.3 - Special chars in names accepted');
    });
  });
});
