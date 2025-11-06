/**
 * ============================================================================
 * PROFILE MANAGEMENT E2E TESTS
 * ============================================================================
 * 
 * Tests for user profile management endpoints (MODULE 3 - Phase 2)
 * 
 * Endpoints Tested:
 * - GET    /api/v1/profile           - Get current user profile
 * - PATCH  /api/v1/profile           - Update profile
 * - GET    /api/v1/profile/preferences - Get preferences
 * - PATCH  /api/v1/profile/preferences - Update preferences
 * - POST   /api/v1/profile/avatar    - Upload avatar
 * - DELETE /api/v1/profile/avatar    - Remove avatar
 * 
 * Test Count: 35+ tests
 * Priority: 🔴 CRITICAL
 * ============================================================================
 */

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/database/prisma.service';
import { ErrorAnalyzer } from '../../utils/error-analyzer';
import { ProgressTracker } from '../../utils/progress-tracker';

describe('Profile Management E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let errorAnalyzer: ErrorAnalyzer;
  let progressTracker: ProgressTracker;
  let authToken: string;
  let userId: string;

  // Test data
  const testUser = {
    email: 'profile.test@example.com',
    password: 'SecurePass123!',
    firstName: 'Profile',
    lastName: 'Test',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    errorAnalyzer = new ErrorAnalyzer();
    progressTracker = new ProgressTracker('profile');

    // Cleanup and create test user
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    
    // Register user
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser);
    
    authToken = registerResponse.body.access_token;
    userId = registerResponse.body.user.id;

    progressTracker.startModule();
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await prisma.$disconnect();
    
    // Generate progress report
    await progressTracker.generateReport();
    
    await app.close();
  });

  describe('GET /api/v1/profile', () => {
    it('should get current user profile', async () => {
      const testName = 'GET /api/v1/profile - Success';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', userId);
      expect(response.body).toHaveProperty('email', testUser.email);
      expect(response.body).toHaveProperty('firstName', testUser.firstName);
      expect(response.body).toHaveProperty('lastName', testUser.lastName);
      expect(response.body).not.toHaveProperty('password');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail without authentication token', async () => {
      const testName = 'GET /api/v1/profile - No Auth Token';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get('/api/v1/profile')
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Unauthorized');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail with invalid token', async () => {
      const testName = 'GET /api/v1/profile - Invalid Token';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get('/api/v1/profile')
        .set('Authorization', 'Bearer invalid_token_12345')
        .expect(401);

      expect(response.body).toHaveProperty('message');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail with expired token', async () => {
      const testName = 'GET /api/v1/profile - Expired Token';
      progressTracker.startTest(testName);

      // Create an expired token (mock - in real test you'd wait or use time manipulation)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj0H8UJXQT7PkG-6R6l8Y6EqX8fXQ8WqZ4FhJ7Uc';

      const response = await request(app.getHttpServer())
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      progressTracker.recordTest(testName, 'passed', response.body);
    });
  });

  describe('PATCH /api/v1/profile', () => {
    it('should update user profile successfully', async () => {
      const testName = 'PATCH /api/v1/profile - Success';
      progressTracker.startTest(testName);

      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        bio: 'This is my updated bio',
      };

      const response = await request(app.getHttpServer())
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('firstName', updateData.firstName);
      expect(response.body).toHaveProperty('lastName', updateData.lastName);
      expect(response.body).toHaveProperty('bio', updateData.bio);

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should update only firstName', async () => {
      const testName = 'PATCH /api/v1/profile - Partial Update (firstName)';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'NewFirstName' })
        .expect(200);

      expect(response.body.firstName).toBe('NewFirstName');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail with invalid email format', async () => {
      const testName = 'PATCH /api/v1/profile - Invalid Email';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'not-an-email' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(Array.isArray(response.body.message)).toBe(true);

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail without authentication', async () => {
      const testName = 'PATCH /api/v1/profile - No Auth';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/profile')
        .send({ firstName: 'Test' })
        .expect(401);

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should handle SQL injection attempts', async () => {
      const testName = 'PATCH /api/v1/profile - SQL Injection Protection';
      progressTracker.startTest(testName);

      const maliciousData = {
        firstName: "'; DROP TABLE users; --",
        lastName: "Robert'); DROP TABLE students;--",
      };

      const response = await request(app.getHttpServer())
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousData)
        .expect(200);

      // Should escape and store as regular string
      expect(response.body.firstName).toBe(maliciousData.firstName);

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should reject XSS attempts in bio', async () => {
      const testName = 'PATCH /api/v1/profile - XSS Protection';
      progressTracker.startTest(testName);

      const xssData = {
        bio: '<script>alert("XSS")</script>',
      };

      const response = await request(app.getHttpServer())
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(xssData)
        .expect(200);

      // Should sanitize or encode HTML
      expect(response.body.bio).not.toContain('<script>');

      progressTracker.recordTest(testName, 'passed', response.body);
    });
  });

  describe('GET /api/v1/profile/preferences', () => {
    it('should get user preferences with defaults', async () => {
      const testName = 'GET /api/v1/profile/preferences - Success';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get('/api/v1/profile/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('emailNotifications');
      expect(response.body).toHaveProperty('smsNotifications');
      expect(response.body).toHaveProperty('pushNotifications');
      expect(response.body).toHaveProperty('language');
      expect(response.body).toHaveProperty('timezone');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail without authentication', async () => {
      const testName = 'GET /api/v1/profile/preferences - No Auth';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get('/api/v1/profile/preferences')
        .expect(401);

      progressTracker.recordTest(testName, 'passed', response.body);
    });
  });

  describe('PATCH /api/v1/profile/preferences', () => {
    it('should update notification preferences', async () => {
      const testName = 'PATCH /api/v1/profile/preferences - Update Notifications';
      progressTracker.startTest(testName);

      const preferences = {
        emailNotifications: false,
        smsNotifications: true,
        pushNotifications: true,
      };

      const response = await request(app.getHttpServer())
        .patch('/api/v1/profile/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(preferences)
        .expect(200);

      expect(response.body.emailNotifications).toBe(false);
      expect(response.body.smsNotifications).toBe(true);
      expect(response.body.pushNotifications).toBe(true);

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should update language preference', async () => {
      const testName = 'PATCH /api/v1/profile/preferences - Update Language';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/profile/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ language: 'es' })
        .expect(200);

      expect(response.body.language).toBe('es');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should update timezone preference', async () => {
      const testName = 'PATCH /api/v1/profile/preferences - Update Timezone';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/profile/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ timezone: 'Asia/Manila' })
        .expect(200);

      expect(response.body.timezone).toBe('Asia/Manila');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should reject invalid language code', async () => {
      const testName = 'PATCH /api/v1/profile/preferences - Invalid Language';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/profile/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ language: 'invalid_lang' })
        .expect(400);

      expect(response.body).toHaveProperty('message');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should reject invalid timezone', async () => {
      const testName = 'PATCH /api/v1/profile/preferences - Invalid Timezone';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/profile/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ timezone: 'Invalid/Timezone' })
        .expect(400);

      progressTracker.recordTest(testName, 'passed', response.body);
    });
  });

  describe('POST /api/v1/profile/avatar', () => {
    it('should upload avatar successfully', async () => {
      const testName = 'POST /api/v1/profile/avatar - Success';
      progressTracker.startTest(testName);

      // Note: In real test, you'd attach an actual image file
      const response = await request(app.getHttpServer())
        .post('/api/v1/profile/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', Buffer.from('fake-image-data'), 'avatar.jpg')
        .expect(200);

      expect(response.body).toHaveProperty('avatarUrl');
      expect(response.body.avatarUrl).toContain('uploads/');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail without file', async () => {
      const testName = 'POST /api/v1/profile/avatar - No File';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .post('/api/v1/profile/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('message');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail with file too large', async () => {
      const testName = 'POST /api/v1/profile/avatar - File Too Large';
      progressTracker.startTest(testName);

      // Create a buffer larger than allowed size (e.g., 5MB)
      const largeFile = Buffer.alloc(6 * 1024 * 1024); // 6MB

      const response = await request(app.getHttpServer())
        .post('/api/v1/profile/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', largeFile, 'large-avatar.jpg')
        .expect(413);

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail with invalid file type', async () => {
      const testName = 'POST /api/v1/profile/avatar - Invalid File Type';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .post('/api/v1/profile/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', Buffer.from('fake-data'), 'avatar.txt')
        .expect(400);

      expect(response.body.message).toContain('image');

      progressTracker.recordTest(testName, 'passed', response.body);
    });
  });

  describe('DELETE /api/v1/profile/avatar', () => {
    it('should remove avatar successfully', async () => {
      const testName = 'DELETE /api/v1/profile/avatar - Success';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .delete('/api/v1/profile/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('removed');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should handle removing non-existent avatar gracefully', async () => {
      const testName = 'DELETE /api/v1/profile/avatar - No Avatar';
      progressTracker.startTest(testName);

      // Try to delete avatar again (already deleted)
      const response = await request(app.getHttpServer())
        .delete('/api/v1/profile/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail without authentication', async () => {
      const testName = 'DELETE /api/v1/profile/avatar - No Auth';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .delete('/api/v1/profile/avatar')
        .expect(401);

      progressTracker.recordTest(testName, 'passed', response.body);
    });
  });

  describe('Error Detection', () => {
    it('should detect and categorize profile errors', async () => {
      const testName = 'Profile Error Detection Test';
      progressTracker.startTest(testName);

      // Trigger a validation error
      const response = await request(app.getHttpServer())
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'invalid-email' })
        .expect(400);

      // Analyze error
      const diagnosis = await errorAnalyzer.analyze(response, {
        expectedStatus: 200,
        endpoint: '/api/v1/profile',
        testCase: 'Invalid email format',
      });

      expect(diagnosis.errorType).toBe('VALIDATION_ERROR');
      expect(diagnosis.severity).toBe('LOW');
      expect(diagnosis.fixSuggestions.length).toBeGreaterThan(0);

      console.log('\n📊 Error Analysis Result:');
      console.log(JSON.stringify(diagnosis, null, 2));

      progressTracker.recordTest(testName, 'passed', diagnosis);
    });
  });
});
