import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Additional Security Headers Middleware
 *
 * Adds OWASP-recommended security headers that aren't covered by Helmet
 * Complements the Helmet configuration with additional browser protections
 *
 * Features:
 * - Permissions-Policy for feature control
 * - X-Permitted-Cross-Domain-Policies
 * - Cache-Control for sensitive endpoints
 * - Clear-Site-Data for logout endpoints
 *
 * OWASP Top 10 Compliance:
 * - A01:2021 – Broken Access Control
 * - A03:2021 – Injection
 * - A05:2021 – Security Misconfiguration
 *
 * Reference: https://owasp.org/www-project-secure-headers/
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Permissions-Policy (replaces Feature-Policy)
    // Controls which browser features and APIs can be used
    res.setHeader(
      'Permissions-Policy',
      [
        'geolocation=()', // Deny geolocation access
        'camera=()', // Deny camera access
        'microphone=()', // Deny microphone access
        'payment=()', // Deny payment API
        'usb=()', // Deny USB device access
        'magnetometer=()', // Deny magnetometer sensor
        'gyroscope=()', // Deny gyroscope sensor
        'accelerometer=()', // Deny accelerometer sensor
        'ambient-light-sensor=()', // Deny ambient light sensor
        'autoplay=()', // Deny autoplay
        'encrypted-media=()', // Deny encrypted media
        'fullscreen=(self)', // Allow fullscreen only for same origin
        'picture-in-picture=()', // Deny picture-in-picture
        'screen-wake-lock=()', // Deny screen wake lock
        'web-share=()', // Deny web share
      ].join(', '),
    );

    // X-Permitted-Cross-Domain-Policies
    // Prevents Adobe Flash and PDF from loading data cross-domain
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    // Expect-CT (Certificate Transparency)
    // Helps detect and prevent the use of mis-issued certificates
    // Note: This header is being deprecated but still useful for older browsers
    res.setHeader(
      'Expect-CT',
      'max-age=86400, enforce, report-uri="https://yourdomain.com/ct-report"',
    );

    // X-Robots-Tag
    // Controls search engine indexing for API responses
    // Prevents API endpoints from being indexed by search engines
    if (req.path.startsWith('/api/')) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    }

    // Cache-Control for sensitive endpoints
    // Prevents caching of sensitive data (auth, user data, etc.)
    if (this.isSensitiveEndpoint(req.path)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    // Clear-Site-Data for logout endpoints
    // Clears browser storage when user logs out
    // Only set for same-origin requests to avoid CORS credential issues
    if (req.path.includes('/logout') || req.path.includes('/signout')) {
      const origin = req.headers.origin;
      const host = req.headers.host;
      
      // Only set Clear-Site-Data for same-origin requests
      // For cross-origin requests (e.g., localhost:8080 -> Railway), skip this header
      // as it conflicts with CORS credentials policy
      if (!origin || origin.includes(host)) {
        res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage", "executionContexts"');
      }
    }

    // Server header obfuscation
    // Remove or obfuscate server information
    res.removeHeader('X-Powered-By'); // Already removed by Helmet, but double-check
    res.setHeader('Server', 'MASH'); // Generic server name

    next();
  }

  /**
   * Check if endpoint contains sensitive data
   * @param path - Request path
   * @returns true if endpoint is sensitive
   */
  private isSensitiveEndpoint(path: string): boolean {
    const sensitivePaths = [
      '/api/v1/auth',
      '/api/v1/users',
      '/api/v1/profile',
      '/api/v1/admin',
      '/api/v1/payment',
      '/api/v1/orders',
      '/api/v1/transactions',
      '/api/v1/sessions',
    ];

    return sensitivePaths.some(sensitivePath => path.startsWith(sensitivePath));
  }
}

/**
 * OWASP Security Headers Checklist
 *
 * ✅ IMPLEMENTED:
 * 1. Content-Security-Policy (Helmet) - Prevents XSS attacks
 * 2. Strict-Transport-Security (Helmet) - Enforces HTTPS
 * 3. X-Frame-Options (Helmet) - Prevents clickjacking
 * 4. X-Content-Type-Options (Helmet) - Prevents MIME sniffing
 * 5. X-XSS-Protection (Helmet) - Enables browser XSS filter
 * 6. Referrer-Policy (Helmet) - Controls referrer information
 * 7. Permissions-Policy (This middleware) - Controls browser features
 * 8. X-Permitted-Cross-Domain-Policies (This middleware) - Flash/PDF security
 * 9. Cache-Control (This middleware) - Prevents sensitive data caching
 * 10. Clear-Site-Data (This middleware) - Clears browser storage on logout
 *
 * 📋 RECOMMENDED (Optional):
 * - Cross-Origin-Embedder-Policy (Helmet) - Prevents data leaks
 * - Cross-Origin-Opener-Policy (Helmet) - Isolates browsing context
 * - Cross-Origin-Resource-Policy (Helmet) - Controls resource loading
 * - Expect-CT (This middleware) - Certificate transparency
 * - X-Robots-Tag (This middleware) - Search engine indexing control
 *
 * 🔍 TESTING:
 * Use securityheaders.com to scan your domain and verify headers
 * Use observatory.mozilla.org for comprehensive security testing
 */
export const SECURITY_HEADERS_CHECKLIST = {
  implemented: [
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'X-XSS-Protection',
    'Referrer-Policy',
    'Permissions-Policy',
    'X-Permitted-Cross-Domain-Policies',
    'Cache-Control',
    'Clear-Site-Data',
  ],
  optional: [
    'Cross-Origin-Embedder-Policy',
    'Cross-Origin-Opener-Policy',
    'Cross-Origin-Resource-Policy',
    'Expect-CT',
    'X-Robots-Tag',
  ],
  testing: [
    'https://securityheaders.com',
    'https://observatory.mozilla.org',
    'https://hstspreload.org',
  ],
} as const;
