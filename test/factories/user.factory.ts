/**
 * User Factory
 *
 * Factory for creating test User instances with realistic fake data.
 * Uses @faker-js/faker for data generation.
 */

import { faker } from '@faker-js/faker';
import { UserRole } from '@prisma/client';
import { testAuth } from '../helpers/test-auth.helper';

export interface UserFactoryOptions {
  id?: string;
  clerkId?: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  phoneNumber?: string;
  role?: UserRole;
  isActive?: boolean;
  preferences?: any;
  twoFactorEnabled?: boolean;
  lastLoginAt?: Date;
}

export class UserFactory {
  /**
   * Create a single user with optional overrides
   */
  static create(overrides?: Partial<UserFactoryOptions>) {
    const firstName = overrides?.firstName || faker.person.firstName();
    const lastName = overrides?.lastName || faker.person.lastName();
    const role = overrides?.role || UserRole.USER;

    const user = {
      id: overrides?.id || faker.string.uuid(),
      clerkId: overrides?.clerkId || `clerk_${faker.string.alphanumeric(24)}`,
      email: overrides?.email || faker.internet.email({ firstName, lastName }).toLowerCase(),
      username:
        overrides?.username || faker.internet.userName({ firstName, lastName }).toLowerCase(),
      firstName,
      lastName,
      imageUrl: overrides?.imageUrl || faker.image.avatar(),
      phoneNumber: overrides?.phoneNumber || faker.phone.number('+639#########'),
      role,
      isActive: overrides?.isActive !== undefined ? overrides.isActive : true,
      preferences: overrides?.preferences || {
        theme: faker.helpers.arrayElement(['light', 'dark', 'auto']),
        language: 'en',
        timezone: 'Asia/Manila',
        notifications: {
          email: true,
          push: true,
          sms: false,
        },
      },
      twoFactorSecret: null,
      twoFactorEnabled: overrides?.twoFactorEnabled || false,
      twoFactorBackupCodes: [],
      lastLoginAt: overrides?.lastLoginAt || faker.date.recent({ days: 7 }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return user;
  }

  /**
   * Create admin user
   */
  static createAdmin(overrides?: Partial<UserFactoryOptions>) {
    return this.create({
      ...overrides,
      role: UserRole.ADMIN,
      firstName: overrides?.firstName || 'Admin',
      lastName: overrides?.lastName || faker.person.lastName(),
    });
  }

  /**
   * Create super admin user
   */
  static createSuperAdmin(overrides?: Partial<UserFactoryOptions>) {
    return this.create({
      ...overrides,
      role: UserRole.SUPER_ADMIN,
      firstName: overrides?.firstName || 'SuperAdmin',
      lastName: overrides?.lastName || faker.person.lastName(),
    });
  }

  /**
   * Create grower user
   */
  static createGrower(overrides?: Partial<UserFactoryOptions>) {
    return this.create({
      ...overrides,
      role: UserRole.GROWER,
      firstName: overrides?.firstName || faker.person.firstName(),
      lastName: overrides?.lastName || faker.person.lastName(),
      preferences: {
        theme: 'light',
        language: 'en',
        timezone: 'Asia/Manila',
        notifications: {
          email: true,
          push: true,
          sms: true,
        },
        business: {
          farmName: faker.company.name(),
          farmSize: faker.number.int({ min: 100, max: 10000 }),
          certifications: ['Organic', 'GAP'],
        },
      },
    });
  }

  /**
   * Create buyer user
   */
  static createBuyer(overrides?: Partial<UserFactoryOptions>) {
    return this.create({
      ...overrides,
      role: UserRole.BUYER,
    });
  }

  /**
   * Create user with 2FA enabled
   */
  static createWith2FA(overrides?: Partial<UserFactoryOptions>) {
    return this.create({
      ...overrides,
      twoFactorEnabled: true,
      twoFactorSecret: faker.string.alphanumeric(32).toUpperCase(),
      twoFactorBackupCodes: Array.from({ length: 10 }, () =>
        faker.string.alphanumeric(8).toUpperCase(),
      ),
    });
  }

  /**
   * Create inactive user
   */
  static createInactive(overrides?: Partial<UserFactoryOptions>) {
    return this.create({
      ...overrides,
      isActive: false,
      lastLoginAt: faker.date.past({ years: 1 }),
    });
  }

  /**
   * Create user with authentication credentials
   */
  static createWithAuth(overrides?: Partial<UserFactoryOptions>) {
    const user = this.create(overrides);
    const token = testAuth.generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      ...user,
      token,
      authHeader: { Authorization: `Bearer ${token}` },
    };
  }

  /**
   * Create multiple users
   */
  static createMany(count: number, overrides?: Partial<UserFactoryOptions>) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create users with different roles
   */
  static createWithRoles(roles: UserRole[]) {
    return roles.map(role => this.create({ role }));
  }

  /**
   * Create a set of users for testing (admin, grower, buyers)
   */
  static createTestSet() {
    return {
      superAdmin: this.createSuperAdmin(),
      admin: this.createAdmin(),
      grower: this.createGrower(),
      buyers: this.createMany(3, { role: UserRole.BUYER }),
    };
  }

  /**
   * Create user for integration tests (with auth)
   */
  static createForIntegrationTest(role: UserRole = UserRole.USER) {
    const user = this.create({ role });
    const token = testAuth.generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user,
      token,
      authHeader: { Authorization: `Bearer ${token}` },
      credentials: {
        email: user.email,
        password: 'Test123!@#', // Standard test password
      },
    };
  }
}
