import {
  getCorsConfig,
  validateCorsOrigin,
  CORS_PRESETS,
  CORS_HEADERS,
  CORS_ERRORS,
} from '../cors.config';

describe('CorsConfig', () => {
  describe('getCorsConfig', () => {
    describe('Production Environment', () => {
      it('should return empty array when no CORS_ORIGINS provided', () => {
        const config = getCorsConfig('production');

        expect(config.origin).toEqual([]);
      });

      it('should parse comma-separated CORS_ORIGINS', () => {
        const origins = 'https://app.example.com,https://admin.example.com';
        const config = getCorsConfig('production', origins);

        expect(config.origin).toEqual([
          'https://app.example.com',
          'https://admin.example.com',
        ]);
      });

      it('should trim whitespace from origins', () => {
        const origins = ' https://app.example.com , https://admin.example.com ';
        const config = getCorsConfig('production', origins);

        expect(config.origin).toEqual([
          'https://app.example.com',
          'https://admin.example.com',
        ]);
      });

      it('should filter out empty strings', () => {
        const origins = 'https://app.example.com,,https://admin.example.com';
        const config = getCorsConfig('production', origins);

        expect(config.origin).toEqual([
          'https://app.example.com',
          'https://admin.example.com',
        ]);
      });

      it('should throw error if CORS_ORIGINS contains only commas', () => {
        // After filtering empty strings, an empty origin list throws error
        expect(() => getCorsConfig('production', ',,,   ,')).toThrow(
          'CORS_ORIGINS environment variable is empty',
        );
      });

      it('should enable credentials by default', () => {
        const config = getCorsConfig('production', 'https://app.example.com');

        expect(config.credentials).toBe(true);
      });

      it('should allow disabling credentials', () => {
        const config = getCorsConfig('production', 'https://app.example.com', false);

        expect(config.credentials).toBe(false);
      });

      it('should set maxAge to 24 hours', () => {
        const config = getCorsConfig('production');

        expect(config.maxAge).toBe(86400);
      });
    });

    describe('Development Environment', () => {
      it('should allow localhost variants', () => {
        const config = getCorsConfig('development');

        expect(config.origin).toContain('http://localhost:3000');
        expect(config.origin).toContain('http://localhost:5173');
        expect(config.origin).toContain('http://127.0.0.1:3000');
      });

      it('should set maxAge to 1 hour', () => {
        const config = getCorsConfig('development');

        expect(config.maxAge).toBe(3600);
      });
    });

    describe('Test Environment', () => {
      it('should allow all origins', () => {
        const config = getCorsConfig('test');

        expect(config.origin).toBe(true);
      });
    });

    describe('Common Configuration', () => {
      it('should allow standard HTTP methods', () => {
        const config = getCorsConfig('production', 'https://app.example.com');

        expect(config.methods).toContain('GET');
        expect(config.methods).toContain('POST');
        expect(config.methods).toContain('PUT');
        expect(config.methods).toContain('PATCH');
        expect(config.methods).toContain('DELETE');
        expect(config.methods).toContain('OPTIONS');
      });

      it('should allow standard request headers', () => {
        const config = getCorsConfig('production', 'https://app.example.com');

        expect(config.allowedHeaders).toContain('Content-Type');
        expect(config.allowedHeaders).toContain('Authorization');
        expect(config.allowedHeaders).toContain('Accept');
        expect(config.allowedHeaders).toContain('X-Requested-With');
      });

      it('should expose rate limit headers', () => {
        const config = getCorsConfig('production', 'https://app.example.com');

        expect(config.exposedHeaders).toContain('X-RateLimit-Limit');
        expect(config.exposedHeaders).toContain('X-RateLimit-Remaining');
        expect(config.exposedHeaders).toContain('X-RateLimit-Reset');
      });

      it('should not pass preflight to next handler', () => {
        const config = getCorsConfig('production', 'https://app.example.com');

        expect(config.preflightContinue).toBe(false);
      });

      it('should return 204 for successful OPTIONS', () => {
        const config = getCorsConfig('production', 'https://app.example.com');

        expect(config.optionsSuccessStatus).toBe(204);
      });
    });

    describe('Default Environment', () => {
      it('should default to production if no environment provided', () => {
        const configNoEnv = getCorsConfig();
        const configProduction = getCorsConfig('production');

        expect(configNoEnv).toEqual(configProduction);
      });
    });
  });

  describe('validateCorsOrigin', () => {
    it('should allow requests with no origin (mobile apps)', (done) => {
      validateCorsOrigin(undefined, (error, allow) => {
        expect(error).toBeNull();
        expect(allow).toBe(true);
        done();
      }, []);
    });

    it('should allow origin matching string pattern', (done) => {
      const allowedPatterns = ['https://app.example.com'];

      validateCorsOrigin('https://app.example.com', (error, allow) => {
        expect(error).toBeNull();
        expect(allow).toBe(true);
        done();
      }, allowedPatterns);
    });

    it('should allow origin matching regex pattern', (done) => {
      const allowedPatterns = [/^https:\/\/.*\.example\.com$/];

      validateCorsOrigin('https://subdomain.example.com', (error, allow) => {
        expect(error).toBeNull();
        expect(allow).toBe(true);
        done();
      }, allowedPatterns);
    });

    it('should reject origin not in allowed patterns', (done) => {
      const allowedPatterns = ['https://app.example.com'];

      validateCorsOrigin('https://evil.com', (error, allow) => {
        expect(error).toBeDefined();
        expect(error?.message).toContain('not allowed by Access-Control-Allow-Origin');
        expect(allow).toBe(false);
        done();
      }, allowedPatterns);
    });

    it('should work with mixed string and regex patterns', (done) => {
      const allowedPatterns = ['https://app.example.com', /^https:\/\/.*\.example\.com$/];

      validateCorsOrigin('https://admin.example.com', (error, allow) => {
        expect(error).toBeNull();
        expect(allow).toBe(true);
        done();
      }, allowedPatterns);
    });
  });

  describe('CORS_PRESETS', () => {
    it('should have STRICT preset', () => {
      expect(CORS_PRESETS.STRICT).toBeDefined();
      expect(CORS_PRESETS.STRICT.origin).toEqual([]);
      expect(CORS_PRESETS.STRICT.credentials).toBe(true);
    });

    it('should have DEVELOPMENT preset', () => {
      expect(CORS_PRESETS.DEVELOPMENT).toBeDefined();
      expect(CORS_PRESETS.DEVELOPMENT.origin).toContain('http://localhost:3000');
      expect(CORS_PRESETS.DEVELOPMENT.credentials).toBe(true);
    });

    it('should have TEST preset', () => {
      expect(CORS_PRESETS.TEST).toBeDefined();
      expect(CORS_PRESETS.TEST.origin).toBe(true);
    });

    it('should have PUBLIC preset with open origins', () => {
      expect(CORS_PRESETS.PUBLIC).toBeDefined();
      expect(CORS_PRESETS.PUBLIC.origin).toBe(true);
      expect(CORS_PRESETS.PUBLIC.credentials).toBe(false);
    });

    it('should have MOBILE preset with custom origin validation', () => {
      expect(CORS_PRESETS.MOBILE).toBeDefined();
      expect(typeof CORS_PRESETS.MOBILE.origin).toBe('function');
    });
  });

  describe('CORS_HEADERS', () => {
    it('should export CORS header constants', () => {
      expect(CORS_HEADERS.ALLOW_ORIGIN).toBe('Access-Control-Allow-Origin');
      expect(CORS_HEADERS.ALLOW_METHODS).toBe('Access-Control-Allow-Methods');
      expect(CORS_HEADERS.ALLOW_HEADERS).toBe('Access-Control-Allow-Headers');
      expect(CORS_HEADERS.EXPOSE_HEADERS).toBe('Access-Control-Expose-Headers');
      expect(CORS_HEADERS.MAX_AGE).toBe('Access-Control-Max-Age');
      expect(CORS_HEADERS.ALLOW_CREDENTIALS).toBe('Access-Control-Allow-Credentials');
    });
  });

  describe('CORS_ERRORS', () => {
    it('should export CORS error messages', () => {
      expect(CORS_ERRORS.ORIGIN_NOT_ALLOWED).toContain('specified origin');
      expect(CORS_ERRORS.METHOD_NOT_ALLOWED).toContain('Method not allowed');
      expect(CORS_ERRORS.HEADER_NOT_ALLOWED).toContain('Request header field');
      expect(CORS_ERRORS.WILDCARD_WITH_CREDENTIALS).toContain('wildcard');
    });
  });
});
