/**
 * Test Helper Utilities
 * Provides common testing utilities, mocks, and helper functions
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import supertest from 'supertest';

/**
 * Create a testing module with common providers mocked
 */
export async function createTestingModule(
  moduleMetadata: any,
): Promise<TestingModule> {
  return Test.createTestingModule(moduleMetadata).compile();
}

/**
 * Bootstrap a NestJS application for E2E testing
 */
export async function bootstrapTestApp(
  module: TestingModule,
): Promise<INestApplication> {
  const app = module.createNestApplication();

  // Apply the same global configurations as main.ts
  app.setGlobalPrefix('api/v1');
  app.enableCors();

  await app.init();
  return app;
}

/**
 * Generate a valid JWT token for testing authenticated endpoints
 */
export function generateTestToken(
  jwtService: JwtService,
  payload: any = { sub: 'test-user-id', email: 'test@example.com' },
): string {
  return jwtService.sign(payload);
}

/**
 * Make an authenticated request
 */
export function authenticatedRequest(
  app: INestApplication,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  url: string,
  token: string,
) {
  return supertest(app.getHttpServer())
    [method](url)
    .set('Authorization', `Bearer ${token}`);
}

/**
 * Wait for a condition to be true (useful for async operations)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Clean up test data
 */
export async function cleanupTestData(app: INestApplication): Promise<void> {
  // Implement cleanup logic based on your database structure
  // This is a placeholder - customize based on your needs
  await app.close();
}

/**
 * Mock ConfigService with test values
 */
export function mockConfigService(overrides: Record<string, any> = {}) {
  const defaultConfig = {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '1h',
    PORT: 3000,
    NODE_ENV: 'test',
    ...overrides,
  };

  return {
    get: jest.fn((key: string) => defaultConfig[key]),
    getOrThrow: jest.fn((key: string) => {
      if (!defaultConfig[key]) {
        throw new Error(`Config key ${key} not found`);
      }
      return defaultConfig[key];
    }),
  };
}

/**
 * Mock JwtService for testing
 */
export function mockJwtService() {
  return {
    sign: jest.fn((payload: any) => 'mock-jwt-token'),
    verify: jest.fn((token: string) => ({
      sub: 'test-user-id',
      email: 'test@example.com',
    })),
    decode: jest.fn((token: string) => ({
      sub: 'test-user-id',
      email: 'test@example.com',
    })),
  };
}

/**
 * Create a mock logger for testing
 */
export function mockLogger() {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };
}

/**
 * Assert that an error response matches the expected format
 */
export function expectErrorResponse(
  response: any,
  expectedStatus: number,
  expectedMessage?: string,
) {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('success', false);
  expect(response.body).toHaveProperty('statusCode', expectedStatus);
  expect(response.body).toHaveProperty('timestamp');
  expect(response.body).toHaveProperty('error');

  if (expectedMessage) {
    expect(response.body.error.message).toContain(expectedMessage);
  }
}

/**
 * Assert that a success response matches the expected format
 */
export function expectSuccessResponse(
  response: any,
  expectedStatus: number = 200,
) {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('success', true);
  expect(response.body).toHaveProperty('statusCode', expectedStatus);
  expect(response.body).toHaveProperty('timestamp');
  expect(response.body).toHaveProperty('data');
}

/**
 * Generate random test data
 */
export function generateTestData(type: 'email' | 'uuid' | 'string' | 'number') {
  switch (type) {
    case 'email':
      return `test-${Date.now()}@example.com`;
    case 'uuid':
      return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    case 'string':
      return `test-string-${Date.now()}`;
    case 'number':
      return Math.floor(Math.random() * 10000);
    default:
      return null;
  }
}

/**
 * Sleep utility for testing async operations
 */
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
