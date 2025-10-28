import { HelmetOptions } from 'helmet';

/**
 * Helmet Security Headers Configuration
 *
 * Helmet helps secure Express/NestJS apps by setting various HTTP headers.
 * This configuration provides browser-level security protections against
 * common vulnerabilities like XSS, clickjacking, and MIME sniffing.
 *
 * Security Headers Configured:
 * 1. Content-Security-Policy (CSP) - Prevents XSS attacks
 * 2. HTTP Strict Transport Security (HSTS) - Enforces HTTPS
 * 3. X-Frame-Options - Prevents clickjacking
 * 4. X-Content-Type-Options - Prevents MIME sniffing
 * 5. X-XSS-Protection - Enables browser XSS filter
 * 6. Referrer-Policy - Controls referrer information
 * 7. Permissions-Policy - Controls browser features
 *
 * Production vs Development:
 * - Production: Full CSP enforcement, strict HSTS
 * - Development: CSP disabled (for hot reload), relaxed policies
 *
 * Usage:
 * ```typescript
 * import { getHelmetConfig } from './config/helmet.config';
 * app.use(helmet(getHelmetConfig(nodeEnv)));
 * ```
 */

/**
 * Get Helmet configuration based on environment
 * @param nodeEnv - Current environment (development, production, test)
 * @returns Helmet configuration object
 */
export function getHelmetConfig(nodeEnv: string = 'production'): HelmetOptions {
  const isDevelopment = nodeEnv === 'development';

  return {
    /**
     * Content Security Policy (CSP)
     * Mitigates XSS attacks by controlling which resources can be loaded
     *
     * Directives:
     * - default-src: Fallback for other directives
     * - script-src: JavaScript sources
     * - style-src: CSS sources
     * - img-src: Image sources
     * - connect-src: AJAX, WebSocket, EventSource
     * - font-src: Font sources
     * - object-src: <object>, <embed>, <applet>
     * - media-src: <audio>, <video>
     * - frame-src: <iframe>
     * - base-uri: <base> tag
     * - form-action: Form submission targets
     * - frame-ancestors: <frame>, <iframe>, <object>, <embed>, <applet>
     */
    contentSecurityPolicy: isDevelopment
      ? false // Disable in development for hot reload, webpack dev server
      : {
          directives: {
            defaultSrc: ["'self'"], // Only load resources from same origin
            scriptSrc: [
              "'self'",
              // Add CDN domains if needed (e.g., for analytics)
              // 'https://cdn.jsdelivr.net',
            ],
            styleSrc: [
              "'self'",
              "'unsafe-inline'", // Allow inline styles (required for some UI libraries)
            ],
            imgSrc: [
              "'self'",
              'data:', // Allow data: URIs for inline images
              'https:', // Allow HTTPS images (for external CDNs, S3 buckets)
            ],
            connectSrc: [
              "'self'",
              // Add WebSocket/API domains if needed
              // 'wss://your-websocket-domain.com',
            ],
            fontSrc: [
              "'self'",
              'data:', // Allow data: URIs for inline fonts
            ],
            objectSrc: ["'none'"], // Disallow <object>, <embed>, <applet>
            mediaSrc: ["'self'"], // Only same-origin media
            frameSrc: ["'none'"], // Disallow <iframe>
            baseUri: ["'self'"], // Restrict <base> tag
            formAction: ["'self'"], // Forms can only submit to same origin
            frameAncestors: ["'none'"], // Prevent embedding in iframes (anti-clickjacking)
            upgradeInsecureRequests: [], // Upgrade HTTP to HTTPS
          },
        },

    /**
     * HTTP Strict Transport Security (HSTS)
     * Forces browsers to use HTTPS for all future requests
     *
     * maxAge: How long to remember (1 year = 31536000 seconds)
     * includeSubDomains: Apply to all subdomains
     * preload: Submit to HSTS preload list (browsers will always use HTTPS)
     */
    hsts: isDevelopment
      ? false // Disable in development (localhost uses HTTP)
      : {
          maxAge: 31536000, // 1 year in seconds
          includeSubDomains: true,
          preload: true, // Enable for production domains only
        },

    /**
     * X-Frame-Options
     * Prevents clickjacking by controlling iframe embedding
     *
     * Options:
     * - deny: Cannot be embedded in any iframe
     * - sameorigin: Can only be embedded in same-origin iframes
     */
    frameguard: {
      action: 'deny', // Strictest option - no iframes allowed
    },

    /**
     * X-Content-Type-Options
     * Prevents MIME type sniffing
     * Ensures browsers respect Content-Type headers
     */
    noSniff: true,

    /**
     * X-XSS-Protection
     * Enables browser's built-in XSS filter
     * Note: Modern browsers use CSP instead, but kept for older browsers
     */
    xssFilter: true,

    /**
     * Referrer-Policy
     * Controls how much referrer information is sent with requests
     *
     * Options:
     * - no-referrer: Never send referrer
     * - strict-origin-when-cross-origin: Send full URL for same-origin, only origin for cross-origin
     * - same-origin: Only send referrer for same-origin requests
     */
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    /**
     * Permissions-Policy (formerly Feature-Policy)
     * Controls browser features and APIs
     *
     * Disabled features:
     * - geolocation: Location access
     * - camera: Camera access
     * - microphone: Microphone access
     * - payment: Payment API
     * - usb: USB device access
     * - magnetometer: Magnetometer sensor
     * - gyroscope: Gyroscope sensor
     * - accelerometer: Accelerometer sensor
     */
    // Note: permissionsPolicy is not available in helmet v7+
    // Use Permissions-Policy header manually if needed
    // permissionsPolicy: {
    //   features: {
    //     geolocation: ["'none'"],
    //     camera: ["'none'"],
    //     microphone: ["'none'"],
    //     payment: ["'none'"],
    //     usb: ["'none'"],
    //     magnetometer: ["'none'"],
    //     gyroscope: ["'none'"],
    //     accelerometer: ["'none'"],
    //   },
    // },

    /**
     * X-DNS-Prefetch-Control
     * Controls browser DNS prefetching
     * Disabled for privacy (prevents leaking navigation intentions)
     */
    dnsPrefetchControl: {
      allow: false,
    },

    /**
     * X-Download-Options
     * Prevents Internet Explorer from executing downloaded HTML files in site context
     */
    ieNoOpen: true,

    /**
     * X-Permitted-Cross-Domain-Policies
     * Controls cross-domain policies for Flash and PDF
     */
    crossOriginEmbedderPolicy: isDevelopment ? false : true,
    crossOriginOpenerPolicy: isDevelopment ? false : { policy: 'same-origin' },
    crossOriginResourcePolicy: isDevelopment ? false : { policy: 'same-origin' },
  };
}

/**
 * Security headers reference for documentation
 */
export const SECURITY_HEADERS = {
  CSP: 'Content-Security-Policy',
  HSTS: 'Strict-Transport-Security',
  FRAME_OPTIONS: 'X-Frame-Options',
  CONTENT_TYPE_OPTIONS: 'X-Content-Type-Options',
  XSS_PROTECTION: 'X-XSS-Protection',
  REFERRER_POLICY: 'Referrer-Policy',
  PERMISSIONS_POLICY: 'Permissions-Policy',
  DNS_PREFETCH_CONTROL: 'X-DNS-Prefetch-Control',
  DOWNLOAD_OPTIONS: 'X-Download-Options',
  CROSS_ORIGIN_EMBEDDER: 'Cross-Origin-Embedder-Policy',
  CROSS_ORIGIN_OPENER: 'Cross-Origin-Opener-Policy',
  CROSS_ORIGIN_RESOURCE: 'Cross-Origin-Resource-Policy',
} as const;

/**
 * Helmet configuration presets for different deployment scenarios
 */
export const HELMET_PRESETS: Record<string, any> = {
  /**
   * Maximum security - For production APIs without browser clients
   */
  STRICT: getHelmetConfig('production'),

  /**
   * Balanced security - For production with modern browser clients
   * Allows some flexibility for CDN resources and inline styles
   */
  BALANCED: {
    ...getHelmetConfig('production'),
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  },

  /**
   * Development - Minimal security for local development
   */
  DEVELOPMENT: getHelmetConfig('development'),
};
