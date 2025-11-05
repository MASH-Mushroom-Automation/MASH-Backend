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
   * - Development: Localhost variants for local testing
   * - Production: Comma-separated list from environment variable
   * - Test: Allow all (for integration tests)
   */
  const getAllowedOrigins = (): string | string[] | boolean => {
    if (isTest) {
      return true; // Allow all origins in test environment
    }

    if (isDevelopment) {
      return [
        'https://mash-backend-api.up.railway.app', // Production backend
        'http://localhost:3000', // Main backend
        'http://localhost:3001', // Secondary backend instance
        'http://localhost:5173', // Vite dev server (common React/Vue port)
        'http://localhost:5174', // Vite dev server (alternate port)
        'http://localhost:4200', // Angular dev server
        'http://localhost:8080', // Common dev server port
        'http://127.0.0.1:3000', // IPv4 localhost
        'http://127.0.0.1:5173', // IPv4 localhost (Vite)
      ];
    }

    // Production: Use environment variable or restrictive default
    if (corsOrigins && corsOrigins.trim() !== '') {
      const origins = corsOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);

      if (origins.length === 0) {
        throw new Error(
          'CORS_ORIGINS environment variable is empty. Please provide valid origins.',
        );
      }

      return origins;
    }

    // Default fallback for production: Allow Railway backend and common dev origins
    // This allows Swagger UI on Railway and local development to work without requiring CORS_ORIGINS env var
    // For production deployments, set CORS_ORIGINS environment variable with your specific domains
    return [
      'https://mash-backend-api.up.railway.app', // Production backend (Railway)
      'http://localhost:3000',   // Backend dev server
      'http://localhost:8080',   // Flutter dev server
      'http://localhost:5173',   // Vite dev server
      'http://localhost:51133',  // Custom frontend port
      'http://127.0.0.1:3000',   // IPv4 localhost variants
      'http://127.0.0.1:8080',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:51133',
    ];
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
     * Security Note: When credentials=true, origin cannot be '*'
     */
    credentials: enableCredentials,

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
  const isAllowed = allowedPatterns.some((pattern) => {
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
      new Error(
        `CORS policy: Origin '${origin}' is not allowed by Access-Control-Allow-Origin`,
      ),
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
        callback(
          new Error('CORS: Only mobile apps without origin are allowed'),
          false,
        );
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
  METHOD_NOT_ALLOWED:
    'Method not allowed by Access-Control-Allow-Methods in preflight response',
  HEADER_NOT_ALLOWED:
    'Request header field not allowed by Access-Control-Allow-Headers in preflight response',
  CREDENTIALS_WITHOUT_ORIGIN:
    'Credentials flag is true, but Access-Control-Allow-Origin is not set',
  WILDCARD_WITH_CREDENTIALS:
    'Credentials flag is true, but Access-Control-Allow-Origin cannot be wildcard (*)',
} as const;
