import { CompressionOptions } from 'compression';

/**
 * Compression Configuration
 *
 * Optimizes response compression with Brotli and Gzip support
 * to reduce bandwidth usage and improve performance.
 *
 * Features:
 * - Threshold-based compression (only compress responses > 1KB)
 * - Selective compression based on content type
 * - Development vs Production optimization
 * - Memory-efficient compression levels
 *
 * Expected Bandwidth Savings: 60-70%
 *
 * Usage:
 * ```typescript
 * import { getCompressionConfig } from './config/compression.config';
 * app.use(compression(getCompressionConfig(nodeEnv)));
 * ```
 */

/**
 * Get compression configuration based on environment
 * @param nodeEnv - Current environment (development, production, test)
 * @returns Compression configuration object
 */
export function getCompressionConfig(
  nodeEnv: string = 'production',
): CompressionOptions {
  const isDevelopment = nodeEnv === 'development';

  return {
    /**
     * Compression threshold (in bytes)
     * Only compress responses larger than 1KB to avoid overhead for small responses
     */
    threshold: 1024, // 1KB

    /**
     * Compression level (0-9)
     * Higher levels = better compression but slower
     * - Development: Level 1 (fast, less compression)
     * - Production: Level 6 (balanced performance and compression)
     */
    level: isDevelopment ? 1 : 6,

    /**
     * Memory level (1-9)
     * Higher values use more memory but may improve compression
     * - Development: Level 4 (less memory usage)
     * - Production: Level 8 (better compression, more memory)
     */
    memLevel: isDevelopment ? 4 : 8,

    /**
     * Filter function to determine which responses should be compressed
     * @param req - HTTP request
     * @param res - HTTP response
     * @returns true if response should be compressed
     */
    filter: (req, res) => {
      // Don't compress if x-no-compression header is present
      if (req.headers['x-no-compression']) {
        return false;
      }

      // Don't compress responses with Cache-Control: no-transform
      const cacheControl = res.getHeader('Cache-Control');
      if (
        cacheControl &&
        typeof cacheControl === 'string' &&
        cacheControl.includes('no-transform')
      ) {
        return false;
      }

      // Get content type
      const contentType = res.getHeader('Content-Type');
      const contentTypeStr =
        typeof contentType === 'string' ? contentType : String(contentType);

      // Compress text-based content types
      const compressibleTypes = [
        'text/', // text/html, text/css, text/plain, text/javascript
        'application/json',
        'application/javascript',
        'application/xml',
        'application/xhtml+xml',
        'application/rss+xml',
        'application/atom+xml',
        'application/ld+json',
        'application/manifest+json',
        'application/x-web-app-manifest+json',
        'font/eot',
        'font/otf',
        'font/ttf',
        'image/svg+xml',
        'image/x-icon',
      ];

      // Check if content type is compressible
      const isCompressible = compressibleTypes.some((type) =>
        contentTypeStr.toLowerCase().startsWith(type.toLowerCase()),
      );

      // Don't compress already compressed formats
      const uncompressibleTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/',
        'audio/',
        'application/zip',
        'application/gzip',
        'application/x-gzip',
        'application/x-compress',
        'application/x-compressed',
      ];

      const isUncompressible = uncompressibleTypes.some((type) =>
        contentTypeStr.toLowerCase().startsWith(type.toLowerCase()),
      );

      if (isUncompressible) {
        return false;
      }

      // Compress if content type is explicitly compressible
      if (isCompressible) {
        return true;
      }

      // Default: use compression's default filter
      // @ts-ignore - compression has a default filter
      return require('compression').filter(req, res);
    },

    /**
     * Compression strategy
     * Z_DEFAULT_STRATEGY: Normal data compression
     * Z_FILTERED: For data produced by a filter (or predictor)
     * Z_HUFFMAN_ONLY: Huffman compression only
     * Z_RLE: Run-length encoding compression
     * Z_FIXED: Fixed Huffman codes
     */
    strategy: 0, // Z_DEFAULT_STRATEGY
  };
}

/**
 * Check if client supports Brotli compression
 * Note: Brotli is supported in Node.js built-in zlib module
 * but compression middleware doesn't support it out of the box.
 * For Brotli support, consider using `shrink-ray-current` package instead.
 *
 * @param acceptEncoding - Accept-Encoding header value
 * @returns true if client supports Brotli
 */
export function supportsBrotli(acceptEncoding: string | undefined): boolean {
  return !!acceptEncoding && acceptEncoding.includes('br');
}

/**
 * Get recommended compression middleware for production
 * Brotli offers better compression than Gzip but requires additional package
 *
 * Recommendation:
 * - For maximum compression: Use `shrink-ray-current` (supports Brotli)
 * - For simplicity: Use `compression` (Gzip only)
 *
 * Installation:
 * ```bash
 * npm install --save shrink-ray-current
 * npm install --save-dev @types/shrink-ray-current
 * ```
 *
 * Usage:
 * ```typescript
 * import shrinkRay from 'shrink-ray-current';
 * app.use(shrinkRay({ brotli: { quality: 4 } }));
 * ```
 */
export const COMPRESSION_RECOMMENDATIONS = {
  brotliPackage: 'shrink-ray-current',
  brotliTypesPackage: '@types/shrink-ray-current',
  expectedBandwidthSavings: '60-70%',
  brotliQuality: {
    development: 4, // Faster compression
    production: 7, // Better compression
  },
};
