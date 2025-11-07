/**
 * Authentication Test Helper Utilities
 * 
 * Provides helper functions for authenticating test requests
 * 
 * CRITICAL IMPACT: Unlocks 60-70+ tests that require authentication
 * - Alert endpoints (6 tests)
 * - User management (15+ tests)
 * - Product management (20+ tests)
 * - Order management (18+ tests)
 * - Profile endpoints (10+ tests)
 * 
 * @module test/utils/auth.helper
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * Test User Credentials
 * Matches the seed data in prisma/seeders/01-users.seeder.ts
 * Password for all users: PP@Namias99
 */
export const TEST_USERS = {
  ADMIN: {
    email: 'admin@mash.com',
    password: 'PP@Namias99',
    role: 'ADMIN',
  },
  USER: {
    email: 'buyer1@example.com',
    password: 'PP@Namias99',
    role: 'USER',
  },
  SELLER: {
    email: 'grower1@mash.com',
    password: 'PP@Namias99',
    role: 'SELLER',
  },
  BUYER: {
    email: 'buyer1@example.com',
    password: 'PP@Namias99',
    role: 'BUYER',
  },
  SUPER_ADMIN: {
    email: 'superadmin@mash.com',
    password: 'PP@Namias99',
    role: 'SUPER_ADMIN',
  },
};

/**
 * Authentication Response Interface
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

/**
 * Get authentication token for testing
 * 
 * @param app - NestJS application instance
 * @param role - User role to authenticate as (default: USER)
 * @returns Access token string
 * 
 * @example
 * ```typescript
 * // Get regular user token
 * const token = await getAuthToken(app);
 * 
 * // Get admin token
 * const adminToken = await getAuthToken(app, 'ADMIN');
 * 
 * // Use in request
 * await request(app.getHttpServer())
 *   .get('/api/v1/alerts/history')
 *   .set('Authorization', `Bearer ${token}`)
 *   .expect(200);
 * ```
 */
export async function getAuthToken(
  app: INestApplication,
  role: keyof typeof TEST_USERS = 'USER',
): Promise<string> {
  const credentials = TEST_USERS[role];

  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({
      email: credentials.email,
      password: credentials.password,
    })
    .expect(200);

  // Extract token from response
  // Supports multiple response formats
  const token =
    response.body.data?.accessToken ||
    response.body.accessToken ||
    response.body.token ||
    response.body.data?.token;

  if (!token) {
    throw new Error(
      `Failed to get auth token for ${role}. Response: ${JSON.stringify(response.body)}`,
    );
  }

  return token;
}

/**
 * Get full authentication tokens (access + refresh)
 * 
 * @param app - NestJS application instance
 * @param role - User role to authenticate as (default: USER)
 * @returns Authentication tokens object
 * 
 * @example
 * ```typescript
 * const { accessToken, refreshToken } = await getAuthTokens(app);
 * 
 * // Test refresh token endpoint
 * await request(app.getHttpServer())
 *   .post('/api/v1/auth/refresh')
 *   .send({ refreshToken })
 *   .expect(200);
 * ```
 */
export async function getAuthTokens(
  app: INestApplication,
  role: keyof typeof TEST_USERS = 'USER',
): Promise<AuthTokens> {
  const credentials = TEST_USERS[role];

  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({
      email: credentials.email,
      password: credentials.password,
    })
    .expect(200);

  const data = response.body.data || response.body;

  return {
    accessToken: data.accessToken || data.token,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
  };
}

/**
 * Make an authenticated GET request
 * 
 * @param app - NestJS application instance
 * @param url - Endpoint URL
 * @param token - Authentication token (optional - will auto-generate if not provided)
 * @param role - User role if token not provided
 * @returns Supertest request object
 * 
 * @example
 * ```typescript
 * // Auto-generate user token
 * const response = await authenticatedGet(app, '/api/v1/alerts/history');
 * expect(response.status).toBe(200);
 * 
 * // Use existing token
 * const token = await getAuthToken(app, 'ADMIN');
 * const response = await authenticatedGet(app, '/api/v1/users', token);
 * ```
 */
export async function authenticatedGet(
  app: INestApplication,
  url: string,
  token?: string,
  role: keyof typeof TEST_USERS = 'USER',
) {
  const authToken = token || (await getAuthToken(app, role));

  return request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${authToken}`);
}

/**
 * Make an authenticated POST request
 * 
 * @param app - NestJS application instance
 * @param url - Endpoint URL
 * @param data - Request body data
 * @param token - Authentication token (optional - will auto-generate if not provided)
 * @param role - User role if token not provided
 * @returns Supertest request object
 * 
 * @example
 * ```typescript
 * const response = await authenticatedPost(
 *   app,
 *   '/api/v1/alerts/trigger',
 *   { type: 'TEMPERATURE', severity: 'HIGH', message: 'Test alert' }
 * );
 * expect(response.status).toBe(201);
 * ```
 */
export async function authenticatedPost(
  app: INestApplication,
  url: string,
  data: any,
  token?: string,
  role: keyof typeof TEST_USERS = 'USER',
) {
  const authToken = token || (await getAuthToken(app, role));

  return request(app.getHttpServer())
    .post(url)
    .set('Authorization', `Bearer ${authToken}`)
    .send(data);
}

/**
 * Make an authenticated PATCH request
 * 
 * @param app - NestJS application instance
 * @param url - Endpoint URL
 * @param data - Request body data
 * @param token - Authentication token (optional - will auto-generate if not provided)
 * @param role - User role if token not provided
 * @returns Supertest request object
 */
export async function authenticatedPatch(
  app: INestApplication,
  url: string,
  data: any,
  token?: string,
  role: keyof typeof TEST_USERS = 'USER',
) {
  const authToken = token || (await getAuthToken(app, role));

  return request(app.getHttpServer())
    .patch(url)
    .set('Authorization', `Bearer ${authToken}`)
    .send(data);
}

/**
 * Make an authenticated PUT request
 * 
 * @param app - NestJS application instance
 * @param url - Endpoint URL
 * @param data - Request body data
 * @param token - Authentication token (optional - will auto-generate if not provided)
 * @param role - User role if token not provided
 * @returns Supertest request object
 */
export async function authenticatedPut(
  app: INestApplication,
  url: string,
  data: any,
  token?: string,
  role: keyof typeof TEST_USERS = 'USER',
) {
  const authToken = token || (await getAuthToken(app, role));

  return request(app.getHttpServer())
    .put(url)
    .set('Authorization', `Bearer ${authToken}`)
    .send(data);
}

/**
 * Make an authenticated DELETE request
 * 
 * @param app - NestJS application instance
 * @param url - Endpoint URL
 * @param token - Authentication token (optional - will auto-generate if not provided)
 * @param role - User role if token not provided
 * @returns Supertest request object
 */
export async function authenticatedDelete(
  app: INestApplication,
  url: string,
  token?: string,
  role: keyof typeof TEST_USERS = 'USER',
) {
  const authToken = token || (await getAuthToken(app, role));

  return request(app.getHttpServer()).delete(url).set('Authorization', `Bearer ${authToken}`);
}

/**
 * Create a test user and get authentication token
 * Useful when you need a fresh user for testing
 * 
 * @param app - NestJS application instance
 * @param userData - User registration data
 * @returns Authentication token
 * 
 * @example
 * ```typescript
 * const token = await createTestUserAndGetToken(app, {
 *   email: 'newuser@example.com',
 *   password: 'NewUser123!',
 *   firstName: 'Test',
 *   lastName: 'User'
 * });
 * ```
 */
export async function createTestUserAndGetToken(
  app: INestApplication,
  userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
  },
): Promise<string> {
  // Register new user
  await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send(userData)
    .expect(201);

  // Login with new user
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({
      email: userData.email,
      password: userData.password,
    })
    .expect(200);

  const token =
    response.body.data?.accessToken ||
    response.body.accessToken ||
    response.body.token ||
    response.body.data?.token;

  if (!token) {
    throw new Error(`Failed to get token for new user. Response: ${JSON.stringify(response.body)}`);
  }

  return token;
}

/**
 * Verify that a token is valid
 * 
 * @param app - NestJS application instance
 * @param token - Token to verify
 * @returns True if token is valid
 * 
 * @example
 * ```typescript
 * const token = await getAuthToken(app);
 * const isValid = await verifyToken(app, token);
 * expect(isValid).toBe(true);
 * ```
 */
export async function verifyToken(app: INestApplication, token: string): Promise<boolean> {
  try {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Refresh an authentication token
 * 
 * @param app - NestJS application instance
 * @param refreshToken - Refresh token
 * @returns New access token
 * 
 * @example
 * ```typescript
 * const { refreshToken } = await getAuthTokens(app);
 * const newToken = await refreshAuthToken(app, refreshToken);
 * ```
 */
export async function refreshAuthToken(
  app: INestApplication,
  refreshToken: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/refresh')
    .send({ refreshToken })
    .expect(200);

  const token =
    response.body.data?.accessToken ||
    response.body.accessToken ||
    response.body.token ||
    response.body.data?.token;

  if (!token) {
    throw new Error(
      `Failed to refresh token. Response: ${JSON.stringify(response.body)}`,
    );
  }

  return token;
}

/**
 * Generate a unique test email
 * Useful for creating multiple test users
 * 
 * @param prefix - Email prefix (default: 'test')
 * @returns Unique email address
 * 
 * @example
 * ```typescript
 * const email = generateTestEmail('user');
 * // Returns: user-1699384756123@test.com
 * ```
 */
export function generateTestEmail(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}@test.com`;
}

/**
 * Generate test user data
 * Useful for user creation tests
 * 
 * @param overrides - Override default values
 * @returns User data object
 * 
 * @example
 * ```typescript
 * const userData = generateTestUserData({ role: 'ADMIN' });
 * ```
 */
export function generateTestUserData(overrides: Partial<any> = {}) {
  return {
    email: generateTestEmail(),
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'User',
    phoneNumber: `09${Math.floor(Math.random() * 1000000000)}`,
    ...overrides,
  };
}
