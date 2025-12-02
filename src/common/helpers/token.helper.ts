import { randomBytes } from 'crypto';

/**
 * Token Helper Utilities
 * 
 * Provides secure token generation and validation for email verification,
 * password reset, and other temporary token-based operations.
 * 
 * @module TokenHelper
 */

/**
 * Generate a secure cryptographic token
 * 
 * Uses Node.js crypto.randomBytes to generate cryptographically secure tokens.
 * Tokens are 32 bytes (256 bits) encoded as hexadecimal (64 characters).
 * 
 * @param length - Number of bytes to generate (default: 32 = 64 hex chars)
 * @returns Hexadecimal string token
 * 
 * @example
 * const token = generateVerificationToken();
 * // Returns: "3f4a8b9c1e2d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0"
 */
export function generateVerificationToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a token expiration date
 * 
 * Creates a Date object representing when the token should expire.
 * Default expiration is 24 hours from the current time.
 * 
 * @param hoursFromNow - Number of hours until expiration (default: 24)
 * @returns Date object representing the expiration time
 * 
 * @example
 * const expiry = generateTokenExpiry(24); // 24 hours from now
 * const shortExpiry = generateTokenExpiry(1); // 1 hour from now
 */
export function generateTokenExpiry(hoursFromNow: number = 24): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hoursFromNow);
  return expiry;
}

/**
 * Check if a token has expired
 * 
 * Compares the expiry date with the current time to determine if the token
 * is still valid. Returns true if the token has expired.
 * 
 * @param expiryDate - The token's expiration date
 * @returns True if the token has expired, false if still valid
 * 
 * @example
 * const isExpired = isTokenExpired(user.emailVerificationExpiry);
 * if (isExpired) {
 *   throw new Error('Token has expired. Please request a new one.');
 * }
 */
export function isTokenExpired(expiryDate: Date | null): boolean {
  if (!expiryDate) {
    return true; // Null expiry dates are considered expired
  }
  return new Date() > expiryDate;
}

/**
 * Generate a short numeric code
 * 
 * Creates a random numeric code (e.g., 6-digit verification code).
 * Useful for SMS verification or secondary authentication.
 * 
 * @param length - Number of digits (default: 6)
 * @returns String of random digits
 * 
 * @example
 * const code = generateNumericCode(6); // Returns: "482917"
 * const shortCode = generateNumericCode(4); // Returns: "7234"
 */
export function generateNumericCode(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const code = Math.floor(Math.random() * (max - min + 1)) + min;
  return code.toString();
}

/**
 * Hash a token for secure storage
 * 
 * Uses SHA-256 to hash tokens before storing in the database.
 * This prevents token leakage if the database is compromised.
 * 
 * @param token - The plain text token to hash
 * @returns SHA-256 hash of the token (hex string)
 * 
 * @example
 * const plainToken = generateVerificationToken();
 * const hashedToken = hashToken(plainToken);
 * // Store hashedToken in database, send plainToken to user
 */
export function hashToken(token: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Compare a plain token with a hashed token
 * 
 * Hashes the plain token and compares it with the stored hash.
 * Safe for constant-time comparison to prevent timing attacks.
 * 
 * @param plainToken - The token received from the user
 * @param hashedToken - The hashed token stored in the database
 * @returns True if tokens match, false otherwise
 * 
 * @example
 * const isValid = compareToken(userProvidedToken, user.verificationToken);
 * if (!isValid) {
 *   throw new Error('Invalid verification token');
 * }
 */
export function compareToken(plainToken: string, hashedToken: string): boolean {
  const hash = hashToken(plainToken);
  // Use timing-safe comparison to prevent timing attacks
  const crypto = require('crypto');
  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(hashedToken, 'hex'),
  );
}

/**
 * Validate token format
 * 
 * Checks if a token has the expected format (hexadecimal string of specific length).
 * 
 * @param token - The token to validate
 * @param expectedLength - Expected length in characters (default: 64 for 32 bytes)
 * @returns True if token format is valid, false otherwise
 * 
 * @example
 * const isValid = validateTokenFormat(token, 64);
 * if (!isValid) {
 *   throw new Error('Invalid token format');
 * }
 */
export function validateTokenFormat(token: string, expectedLength: number = 64): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Check length
  if (token.length !== expectedLength) {
    return false;
  }
  
  // Check if hexadecimal
  const hexRegex = /^[0-9a-fA-F]+$/;
  return hexRegex.test(token);
}

/**
 * Generate a token with metadata
 * 
 * Creates a token along with its expiry date and hash for database storage.
 * Useful for generating all token-related data in one call.
 * 
 * @param hoursUntilExpiry - Hours until token expires (default: 24)
 * @param shouldHash - Whether to hash the token (default: false)
 * @returns Object containing token, expiry, and optionally hash
 * 
 * @example
 * const { token, expiry, hash } = generateTokenWithMetadata(24, true);
 * await prisma.user.update({
 *   where: { id: userId },
 *   data: {
 *     verificationToken: hash,
 *     verificationExpiry: expiry,
 *   }
 * });
 * // Send `token` to user via email
 */
export function generateTokenWithMetadata(
  hoursUntilExpiry: number = 24,
  shouldHash: boolean = false,
): {
  token: string;
  expiry: Date;
  hash?: string;
} {
  const token = generateVerificationToken();
  const expiry = generateTokenExpiry(hoursUntilExpiry);
  
  if (shouldHash) {
    return {
      token,
      expiry,
      hash: hashToken(token),
    };
  }
  
  return { token, expiry };
}

/**
 * Generate a secure 6-digit verification code
 * 
 * Uses crypto.randomInt() for cryptographically secure random number generation.
 * Generates codes from 000000 to 999999 (always 6 digits with leading zeros).
 * 
 * @returns 6-digit numeric code as string (e.g., "123456", "000042")
 * 
 * @example
 * const code = generateSixDigitCode(); // Returns: "482917"
 * // Store code in database, send to user via email
 */
export function generateSixDigitCode(): string {
  const crypto = require('crypto');
  // Generate random integer between 0 and 999999
  const code = crypto.randomInt(0, 1000000);
  // Pad with leading zeros to ensure 6 digits
  return code.toString().padStart(6, '0');
}

/**
 * Generate code expiry time
 * 
 * Creates a Date object representing when the verification code should expire.
 * Default expiration is 10 minutes (recommended for OTP-style codes).
 * 
 * @param minutes - Number of minutes until expiration (default: 10)
 * @returns Date object representing the expiration time
 * 
 * @example
 * const expiry = generateCodeExpiry(10); // 10 minutes from now
 * const shortExpiry = generateCodeExpiry(5); // 5 minutes from now
 */
export function generateCodeExpiry(minutes: number = 10): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Check if verification code has expired
 * 
 * Compares the code expiry date with the current time to determine if the code
 * is still valid. Returns true if the code has expired or if expiry date is null.
 * 
 * @param expiryDate - The code's expiration date
 * @returns True if the code has expired, false if still valid
 * 
 * @example
 * const isExpired = isCodeExpired(user.emailVerificationCodeExpiry);
 * if (isExpired) {
 *   throw new Error('Verification code has expired. Please request a new one.');
 * }
 */
export function isCodeExpired(expiryDate: Date | null): boolean {
  if (!expiryDate) {
    return true; // Null expiry dates are considered expired
  }
  return new Date() > expiryDate;
}
