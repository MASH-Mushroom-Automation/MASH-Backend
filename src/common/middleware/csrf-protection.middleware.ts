import { Injectable, NestMiddleware, ForbiddenException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes, createHmac } from 'crypto';

/**
 * CSRF Protection Middleware
 *
 * Implements Cross-Site Request Forgery (CSRF) protection using the Synchronizer Token Pattern.
 * Protects against unauthorized state-changing operations by requiring a valid CSRF token.
 *
 * How it works:
 * 1. Generate a secret key and store in session/cookie
 * 2. Generate a token from the secret using HMAC
 * 3. Client includes token in requests (header or body)
 * 4. Server validates token before processing request
 *
 * Features:
 * - Double Submit Cookie pattern (no server-side session required)
 * - HMAC-based token generation
 * - SameSite cookie policy
 * - Automatic token rotation
 * - Safe method exemption (GET, HEAD, OPTIONS)
 *
 * Usage:
 * ```typescript
 * // In main.ts or module
 * const csrfMiddleware = new CsrfProtectionMiddleware();
 * app.use(csrfMiddleware.use.bind(csrfMiddleware));
 *
 * // In client (fetch example)
 * const csrfToken = getCookie('XSRF-TOKEN');
 * fetch('/api/v1/resource', {
 *   method: 'POST',
 *   headers: { 'X-XSRF-TOKEN': csrfToken },
 *   body: JSON.stringify(data),
 * });
 * ```
 *
 * Reference: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */
@Injectable()
export class CsrfProtectionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfProtectionMiddleware.name);
  private readonly tokenCookieName = 'XSRF-TOKEN';
  private readonly secretCookieName = '_csrf_secret';
  private readonly headerName = 'x-xsrf-token';
  private readonly bodyFieldName = '_csrf';

  // HMAC secret for token generation (rotate periodically in production)
  private readonly hmacSecret = process.env.CSRF_SECRET || this.generateSecret();

  /**
   * Safe HTTP methods that don't require CSRF protection
   */
  private readonly safeMethods = ['GET', 'HEAD', 'OPTIONS'];

  /**
   * Paths excluded from CSRF protection (public endpoints or JWT-protected)
   */
  private readonly excludedPaths = [
    '/api/v1/health',
    '/api/v1/metrics',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/logout', // Logout is protected by JWT, CSRF not needed
    '/api/v1/webhook', // Webhook endpoints (use signature verification instead)
  ];

  use(req: Request, res: Response, next: NextFunction) {
    // Skip CSRF for safe methods
    if (this.safeMethods.includes(req.method)) {
      this.ensureCsrfToken(req, res);
      return next();
    }

    // Skip CSRF for excluded paths
    if (this.isExcludedPath(req.path)) {
      return next();
    }

    // Skip CSRF for API key authenticated requests
    if (req.headers['x-api-key']) {
      this.logger.debug(`Skipping CSRF for API key authenticated request: ${req.path}`);
      return next();
    }

    try {
      // Get CSRF token from request
      const token = req.headers[this.headerName] || req.body?.[this.bodyFieldName];

      // Get CSRF secret from cookie
      const secret = req.cookies?.[this.secretCookieName];

      if (!token || !secret) {
        this.logger.warn(`CSRF token missing for ${req.method} ${req.path} from IP ${req.ip}`);
        throw new ForbiddenException('CSRF token missing');
      }

      // Validate token
      if (!this.validateToken(token as string, secret)) {
        this.logger.warn(`Invalid CSRF token for ${req.method} ${req.path} from IP ${req.ip}`);
        throw new ForbiddenException('Invalid CSRF token');
      }

      // Token is valid, proceed with request
      next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`CSRF validation error: ${error.message}`);
      throw new ForbiddenException('CSRF validation failed');
    }
  }

  /**
   * Ensure CSRF token is set for the client
   * Called on safe methods (GET, HEAD, OPTIONS) to provide token for subsequent requests
   */
  private ensureCsrfToken(req: Request, res: Response) {
    // Check if secret cookie exists
    let secret = req.cookies?.[this.secretCookieName];

    // Generate new secret if not exists
    if (!secret) {
      secret = this.generateSecret();

      // Set secret cookie (HttpOnly for security)
      res.cookie(this.secretCookieName, secret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict', // Prevent CSRF
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
      });
    }

    // Generate token from secret
    const token = this.generateToken(secret);

    // Set token cookie (readable by JavaScript for client to send in requests)
    res.cookie(this.tokenCookieName, token, {
      httpOnly: false, // Accessible by JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    // Also set token in response header for convenience
    res.setHeader('X-CSRF-Token', token);
  }

  /**
   * Generate a random secret
   */
  private generateSecret(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generate a CSRF token from secret using HMAC
   */
  private generateToken(secret: string): string {
    const timestamp = Date.now().toString();
    const hmac = createHmac('sha256', this.hmacSecret);
    hmac.update(`${secret}:${timestamp}`);
    const signature = hmac.digest('hex');
    return `${timestamp}.${signature}`;
  }

  /**
   * Validate CSRF token against secret
   */
  private validateToken(token: string, secret: string): boolean {
    try {
      const [timestamp, signature] = token.split('.');

      if (!timestamp || !signature) {
        return false;
      }

      // Check token age (reject tokens older than 24 hours)
      const tokenAge = Date.now() - parseInt(timestamp, 10);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (tokenAge > maxAge) {
        this.logger.warn(`CSRF token expired (age: ${tokenAge}ms)`);
        return false;
      }

      // Regenerate signature and compare
      const hmac = createHmac('sha256', this.hmacSecret);
      hmac.update(`${secret}:${timestamp}`);
      const expectedSignature = hmac.digest('hex');

      // Use constant-time comparison to prevent timing attacks
      return this.constantTimeCompare(signature, expectedSignature);
    } catch (error) {
      this.logger.error(`Token validation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Check if path is excluded from CSRF protection
   */
  private isExcludedPath(path: string): boolean {
    return this.excludedPaths.some(excluded => path.startsWith(excluded));
  }
}

/**
 * CSRF Protection Configuration
 */
export interface CsrfConfig {
  enabled: boolean;
  tokenCookieName?: string;
  secretCookieName?: string;
  headerName?: string;
  bodyFieldName?: string;
  excludedPaths?: string[];
  cookieOptions?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
  };
}

/**
 * Get CSRF configuration from environment
 */
export function getCsrfConfig(): CsrfConfig {
  return {
    enabled: process.env.CSRF_ENABLED !== 'false', // Enabled by default
    tokenCookieName: process.env.CSRF_TOKEN_COOKIE_NAME || 'XSRF-TOKEN',
    secretCookieName: process.env.CSRF_SECRET_COOKIE_NAME || '_csrf_secret',
    headerName: process.env.CSRF_HEADER_NAME || 'x-xsrf-token',
    bodyFieldName: process.env.CSRF_BODY_FIELD_NAME || '_csrf',
    excludedPaths: process.env.CSRF_EXCLUDED_PATHS?.split(',') || [
      '/api/v1/health',
      '/api/v1/metrics',
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/webhook',
    ],
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };
}

/**
 * CSRF Protection Best Practices
 *
 * ✅ IMPLEMENTED:
 * 1. Double Submit Cookie pattern - No server-side session required
 * 2. HMAC-based token generation - Cryptographically secure
 * 3. SameSite cookie policy - Browser-level CSRF protection
 * 4. Token expiration - Tokens expire after 24 hours
 * 5. Safe method exemption - GET, HEAD, OPTIONS don't require token
 * 6. Constant-time comparison - Prevents timing attacks
 * 7. Automatic token rotation - New token on every GET request
 *
 * 📋 CLIENT INTEGRATION:
 * ```javascript
 * // Get CSRF token from cookie
 * function getCookie(name) {
 *   const value = `; ${document.cookie}`;
 *   const parts = value.split(`; ${name}=`);
 *   if (parts.length === 2) return parts.pop().split(';').shift();
 * }
 *
 * // Include token in POST requests
 * const csrfToken = getCookie('XSRF-TOKEN');
 * fetch('/api/v1/resource', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-XSRF-TOKEN': csrfToken,
 *   },
 *   credentials: 'include',
 *   body: JSON.stringify(data),
 * });
 * ```
 *
 * 🔒 SECURITY NOTES:
 * - Use HTTPS in production (secure cookies)
 * - Set CSRF_SECRET environment variable
 * - Rotate CSRF_SECRET periodically
 * - Combine with authentication (CSRF protects authenticated sessions)
 * - Use Content-Type validation for additional protection
 */
