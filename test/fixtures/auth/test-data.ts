/**
 * Test Data Fixtures for Authentication Module
 * 
 * This file contains all test data used for automated API testing.
 * Organized by test scenario type.
 */

// ==================== VALID TEST DATA ====================

export const VALID_TEST_USER = {
  email: 'test.user@mash.com',
  password: 'SecurePass123!',
  firstName: 'Test',
  lastName: 'User',
  username: 'testuser',
};

export const VALID_ADMIN_USER = {
  email: 'admin.test@mash.com',
  password: 'AdminPass123!',
  firstName: 'Admin',
  lastName: 'Test',
  username: 'admintest',
  role: 'ADMIN',
};

export const VALID_LOGIN_DATA = {
  email: VALID_TEST_USER.email,
  password: VALID_TEST_USER.password,
};

export const VALID_REGISTER_DATA = {
  email: 'new.user@mash.com',
  password: 'NewUser123!',
  firstName: 'New',
  lastName: 'User',
  username: 'newuser',
};

// ==================== INVALID LOGIN DATA ====================

export const INVALID_LOGIN_DATA = {
  wrongPassword: {
    email: VALID_TEST_USER.email,
    password: 'WrongPassword123!',
  },
  nonExistentUser: {
    email: 'nonexistent@example.com',
    password: 'SecurePass123!',
  },
  invalidEmail: {
    email: 'notanemail',
    password: 'SecurePass123!',
  },
  missingEmail: {
    password: 'SecurePass123!',
  },
  missingPassword: {
    email: VALID_TEST_USER.email,
  },
  emptyBody: {},
  nullEmail: {
    email: null,
    password: 'SecurePass123!',
  },
  nullPassword: {
    email: VALID_TEST_USER.email,
    password: null,
  },
};

// ==================== INVALID EMAIL FORMATS ====================

export const INVALID_EMAILS = [
  'notanemail',
  '@example.com',
  'user@',
  'user @example.com',
  'user@example',
  'user..name@example.com',
  'user@.com',
];

// ==================== WEAK PASSWORDS ====================

export const WEAK_PASSWORDS = {
  tooShort: 'Pass1!',                    // Less than 8 characters
  noUppercase: 'password123!',           // No uppercase letter
  noLowercase: 'PASSWORD123!',           // No lowercase letter
  noNumber: 'PasswordTest!',             // No number
  noSpecialChar: 'Password123',          // No special character
  onlyLetters: 'PasswordTest',           // Only letters
  onlyNumbers: '12345678',               // Only numbers
};

// ==================== INVALID USERNAMES ====================

export const INVALID_USERNAMES = {
  tooShort: 'ab',                        // Less than 3 characters
  tooLong: 'a'.repeat(31),               // More than 30 characters
  withSpaces: 'user name',               // Contains space
  withSpecialChars: 'user@name',         // Invalid character
  withEmoji: 'user😀name',               // Contains emoji
};

// ==================== VERIFICATION CODE DATA ====================

export const VERIFICATION_CODE_DATA = {
  valid: {
    email: VALID_TEST_USER.email,
    code: '123456',
  },
  invalidCode: {
    email: VALID_TEST_USER.email,
    code: '000000',
  },
  wrongLength: {
    email: VALID_TEST_USER.email,
    code: '12345',
  },
  nonNumeric: {
    email: VALID_TEST_USER.email,
    code: 'ABCDEF',
  },
  missingCode: {
    email: VALID_TEST_USER.email,
  },
  missingEmail: {
    code: '123456',
  },
};

// ==================== PASSWORD RESET DATA ====================

export const PASSWORD_RESET_DATA = {
  forgotPassword: {
    valid: {
      email: VALID_TEST_USER.email,
    },
    invalidEmail: {
      email: 'notanemail',
    },
    nonExistent: {
      email: 'nonexistent@example.com',
    },
  },
  resetPassword: {
    valid: {
      email: VALID_TEST_USER.email,
      code: '123456',
      newPassword: 'NewSecurePass123!',
    },
    invalidCode: {
      email: VALID_TEST_USER.email,
      code: '000000',
      newPassword: 'NewSecurePass123!',
    },
    weakPassword: {
      email: VALID_TEST_USER.email,
      code: '123456',
      newPassword: 'weak',
    },
  },
};

// ==================== OAUTH DATA ====================

export const OAUTH_DATA = {
  google: {
    provider: 'google',
    redirectUrl: 'http://localhost:3000/auth/callback',
  },
  github: {
    provider: 'github',
    redirectUrl: 'http://localhost:3000/auth/callback',
  },
  facebook: {
    provider: 'facebook',
    redirectUrl: 'http://localhost:3000/auth/callback',
  },
  callback: {
    valid: {
      code: 'valid_auth_code',
      state: 'valid_state',
      provider: 'google',
    },
    invalidCode: {
      code: 'invalid_code',
      state: 'valid_state',
      provider: 'google',
    },
  },
};

// ==================== REFRESH TOKEN DATA ====================

export const REFRESH_TOKEN_DATA = {
  valid: {
    refreshToken: 'valid_refresh_token',
  },
  invalid: {
    refreshToken: 'invalid_refresh_token',
  },
  expired: {
    refreshToken: 'expired_refresh_token',
  },
  missing: {},
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate random email for unique test users
 */
export function generateRandomEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test.${timestamp}.${random}@mash.com`;
}

/**
 * Generate random username
 */
export function generateRandomUsername(): string {
  const random = Math.random().toString(36).substring(2, 12);
  return `testuser_${random}`;
}

/**
 * Create unique test user data
 */
export function createUniqueTestUser() {
  return {
    email: generateRandomEmail(),
    password: 'SecurePass123!',
    firstName: 'Test',
    lastName: 'User',
    username: generateRandomUsername(),
  };
}

// ==================== TEST USER CLEANUP DATA ====================

/**
 * Emails to clean up after tests
 * Add test user emails here to ensure cleanup
 */
export const TEST_EMAILS_TO_CLEANUP = [
  'test.user@mash.com',
  'admin.test@mash.com',
  'new.user@mash.com',
];
