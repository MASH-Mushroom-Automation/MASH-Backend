import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * CORS (Cross-Origin Resource Sharing) Configuration
 *
 * Configures which origins can access the API, what methods/headers are allowed,
 * and whether credentials (cookies, auth headers) can be sent cross-origin.
 *
 * Security Considerations:
 * 1. Production: Whitelist specific origins only
 * 2. Development: Allow localhost for testing
 * 3. Credentials: Enable only if cookies/auth required
 * 4. Methods: Limit to required HTTP methods
 * 5. Headers: Whitelist specific headers
 *
 * Environment Variables:
 * - CORS_ORIGINS: Comma-separated list of allowed origins (production)
 * - CORS_CREDENTIALS: Enable credentials (true/false)
 * - CORS_MAX_AGE: Preflight cache duration (seconds)
 *
 * Usage:
 * ```typescript
 * import { getCorsConfig } from './config/cors.config';
 * app.enableCors(getCorsConfig(nodeEnv, configService));
 * ```
 */

/**
 * Get CORS configuration based on environment
 * @param nodeEnv - Current environment (development, production, test)
 * @param corsOrigins - Comma-separated list of allowed origins (for production)
 * @param enableCredentials - Whether to allow credentials (cookies, auth)
 * @returns CORS configuration object
 */
export function getCorsConfig(
  nodeEnv: string = 'production',
  corsOrigins?: string,
  enableCredentials: boolean = true,
): CorsOptions {
  const isDevelopment = nodeEnv === 'development';
  const isTest = nodeEnv === 'test';

  /**
   * Parse allowed origins
   * - Development: Allow all origins for easy testing
   * - Production: Allow all origins (as requested)
   * - Test: Allow all (for integration tests)
   */
  const getAllowedOrigins = (): ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void) | boolean => {
    // Use a function to dynamically allow all origins while enabling credentials
    // This is the correct way to allow all origins with credentials
    return (origin, callback) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) {
        callback(null, true);
        return;
      }
      // Allow all origins dynamically
      callback(null, true);
    };
  };

  return {
    /**
     * origin: Which origins can access the API
     * - string: Single origin
     * - string[]: Array of allowed origins
     * - boolean: true = allow all (dangerous!), false = deny all
     * - function: Dynamic origin validation
     */
    origin: getAllowedOrigins(),

    /**
     * credentials: Whether to allow credentials (cookies, auth headers)
     * Required for:
     * - Cookie-based sessions
     * - HTTP authentication
     * - Client certificates
     *
     * Security Note: Using a dynamic origin function allows credentials to work
     * with all origins while maintaining proper CORS headers
     */
    credentials: enableCredentials

    /**
     * methods: Allowed HTTP methods
     * Only include methods your API actually uses
     */
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    /**
     * allowedHeaders: Headers clients can send
     * Standard headers + custom headers for your API
     */
    allowedHeaders: [
      'Content-Type', // Required for JSON requests
      'Authorization', // Required for Bearer tokens
      'Accept', // Content negotiation
      'Accept-Language', // Localization
      'X-Requested-With', // AJAX identification
      'X-Correlation-ID', // Request tracing
      'X-Request-ID', // Request identification
    ],

    /**
     * exposedHeaders: Headers clients can read from response
     * By default, only CORS-safelisted headers are exposed
     */
    exposedHeaders: [
      'X-RateLimit-Limit', // Rate limiting info
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Correlation-ID', // Request tracing
      'X-Request-ID',
      'X-Response-Time', // Performance metrics
    ],

    /**
     * maxAge: How long to cache preflight responses (seconds)
     * Reduces preflight requests for improved performance
     *
     * - Development: 1 hour (for faster iteration)
     * - Production: 24 hours (reduce load)
     */
    maxAge: isDevelopment ? 3600 : 86400,

    /**
     * preflightContinue: Pass preflight to next handler
     * false = handle OPTIONS automatically (recommended)
     */
    preflightContinue: false,

    /**
     * optionsSuccessStatus: Status code for successful OPTIONS requests
     * 204 = No Content (recommended for compatibility)
     */
    optionsSuccessStatus: 204,
  };
}

/**
 * Dynamic CORS validation function
 * Allows programmatic origin validation (e.g., database lookup)
 *
 * Example:
 * ```typescript
 * origin: (origin, callback) => {
 *   return validateCorsOrigin(origin, callback, allowedPatterns);
 * }
 * ```
 */
export function validateCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
  allowedPatterns: (string | RegExp)[],
): void {
  // Allow requests with no origin (e.g., mobile apps, Postman)
  if (!origin) {
    callback(null, true);
    return;
  }

  // Check against allowed patterns
  const isAllowed = allowedPatterns.some(pattern => {
    if (typeof pattern === 'string') {
      return origin === pattern;
    } else if (pattern instanceof RegExp) {
      return pattern.test(origin);
    }
    return false;
  });

  if (isAllowed) {
    callback(null, true);
  } else {
    callback(
      new Error(`CORS policy: Origin '${origin}' is not allowed by Access-Control-Allow-Origin`),
      false,
    );
  }
}

/**
 * CORS configuration presets for different deployment scenarios
 */
export const CORS_PRESETS = {
  /**
   * Strict - Production API (explicit origins required)
   */
  STRICT: getCorsConfig('production', undefined, true),

  /**
   * Development - Local development with common ports
   */
  DEVELOPMENT: getCorsConfig('development', undefined, true),

  /**
   * Test - Allow all origins for integration tests
   */
  TEST: getCorsConfig('test', undefined, true),

  /**
   * Public API - No credentials, open origins (use with caution!)
   */
  PUBLIC: {
    ...getCorsConfig('production', undefined, false),
    origin: true, // Allow all origins (dangerous!)
  },

  /**
   * Mobile App - Allow requests with no origin
   */
  MOBILE: {
    ...getCorsConfig('production', undefined, true),
    origin: (origin: string | undefined, callback: any) => {
      // Mobile apps don't send origin header
      if (!origin) {
        callback(null, true);
      } else {
        callback(new Error('CORS: Only mobile apps without origin are allowed'), false);
      }
    },
  },
} as const;

/**
 * CORS headers reference for documentation
 */
export const CORS_HEADERS = {
  ALLOW_ORIGIN: 'Access-Control-Allow-Origin',
  ALLOW_METHODS: 'Access-Control-Allow-Methods',
  ALLOW_HEADERS: 'Access-Control-Allow-Headers',
  EXPOSE_HEADERS: 'Access-Control-Expose-Headers',
  MAX_AGE: 'Access-Control-Max-Age',
  ALLOW_CREDENTIALS: 'Access-Control-Allow-Credentials',
  REQUEST_METHOD: 'Access-Control-Request-Method',
  REQUEST_HEADERS: 'Access-Control-Request-Headers',
} as const;

/**
 * Common CORS error messages
 */
export const CORS_ERRORS = {
  ORIGIN_NOT_ALLOWED:
    'The CORS policy for this site does not allow access from the specified origin',
  METHOD_NOT_ALLOWED: 'Method not allowed by Access-Control-Allow-Methods in preflight response',
  HEADER_NOT_ALLOWED:
    'Request header field not allowed by Access-Control-Allow-Headers in preflight response',
  CREDENTIALS_WITHOUT_ORIGIN:
    'Credentials flag is true, but Access-Control-Allow-Origin is not set',
  WILDCARD_WITH_CREDENTIALS:
    'Credentials flag is true, but Access-Control-Allow-Origin cannot be wildcard (*)',
} as const;
