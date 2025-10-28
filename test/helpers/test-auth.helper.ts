/**
 * Test Auth Helper
 *
 * Provides utilities for authentication in tests.
 * Generates JWT tokens, creates test users with different roles, etc.
 */

import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

export class TestAuthHelper {
  private readonly jwtSecret =
    process.env.TEST_JWT_SECRET || 'test-jwt-secret-change-in-production';
  private readonly jwtExpiresIn = '1h';

  /**
   * Generate JWT token for test user
   */
  generateToken(payload: {
    id: string;
    email: string;
    role: UserRole;
  }): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });
  }

  /**
   * Generate expired JWT token (for testing token expiration)
   */
  generateExpiredToken(payload: {
    id: string;
    email: string;
    role: UserRole;
  }): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: '-1h', // Expired 1 hour ago
    });
  }

  /**
   * Generate invalid JWT token (wrong secret)
   */
  generateInvalidToken(payload: {
    id: string;
    email: string;
    role: UserRole;
  }): string {
    return jwt.sign(payload, 'wrong-secret', {
      expiresIn: this.jwtExpiresIn,
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      return null;
    }
  }

  /**
   * Hash password (for test user creation)
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate auth header with Bearer token
   */
  generateAuthHeader(
    userId: string,
    email: string,
    role: UserRole,
  ): Record<string, string> {
    const token = this.generateToken({ id: userId, email, role });
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Create test user credentials
   */
  createTestCredentials(role: UserRole = UserRole.USER) {
    const id = `test-user-${role.toLowerCase()}-${Date.now()}`;
    const email = `test-${role.toLowerCase()}@test.com`;
    const password = 'Test123!@#';

    return {
      id,
      email,
      password,
      role,
      token: this.generateToken({ id, email, role }),
      authHeader: this.generateAuthHeader(id, email, role),
    };
  }

  /**
   * Create admin test credentials
   */
  createAdminCredentials() {
    return this.createTestCredentials(UserRole.ADMIN);
  }

  /**
   * Create super admin test credentials
   */
  createSuperAdminCredentials() {
    return this.createTestCredentials(UserRole.SUPER_ADMIN);
  }

  /**
   * Create grower test credentials
   */
  createGrowerCredentials() {
    return this.createTestCredentials(UserRole.GROWER);
  }

  /**
   * Create buyer test credentials
   */
  createBuyerCredentials() {
    return this.createTestCredentials(UserRole.BUYER);
  }

  /**
   * Parse Bearer token from Authorization header
   */
  parseBearerToken(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Generate API key (for API key authentication testing)
   */
  generateApiKey(): string {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let apiKey = '';
    for (let i = 0; i < 32; i++) {
      apiKey += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }
    return `mash_${apiKey}`;
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId: string): string {
    return jwt.sign({ id: userId, type: 'refresh' }, this.jwtSecret, {
      expiresIn: '7d',
    });
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): any {
    try {
      const payload = jwt.verify(token, this.jwtSecret);
      if (
        payload &&
        typeof payload === 'object' &&
        payload.type === 'refresh'
      ) {
        return payload;
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Global test auth helper instance
 */
export const testAuth = new TestAuthHelper();
