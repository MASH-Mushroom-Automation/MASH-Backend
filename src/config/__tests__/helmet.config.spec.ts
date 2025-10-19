import {
  getHelmetConfig,
  HELMET_PRESETS,
  SECURITY_HEADERS,
} from '../helmet.config';

describe('HelmetConfig', () => {
  describe('getHelmetConfig', () => {
    describe('Production Environment', () => {
      it('should return helmet config with CSP enabled', () => {
        const config = getHelmetConfig('production');

        expect(config.contentSecurityPolicy).toBeDefined();
        expect(config.contentSecurityPolicy).not.toBe(false);
      });

      it('should return helmet config with HSTS enabled', () => {
        const config = getHelmetConfig('production');

        expect(config.hsts).toBeDefined();
        expect(config.hsts).not.toBe(false);
        expect(config.hsts).toMatchObject({
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        });
      });

      it('should enable cross-origin policies in production', () => {
        const config = getHelmetConfig('production');

        expect(config.crossOriginEmbedderPolicy).toBe(true);
        expect(config.crossOriginOpenerPolicy).toBeDefined();
        expect(config.crossOriginResourcePolicy).toBeDefined();
      });
    });

    describe('Development Environment', () => {
      it('should disable CSP in development', () => {
        const config = getHelmetConfig('development');

        expect(config.contentSecurityPolicy).toBe(false);
      });

      it('should disable HSTS in development', () => {
        const config = getHelmetConfig('development');

        expect(config.hsts).toBe(false);
      });

      it('should disable cross-origin policies in development', () => {
        const config = getHelmetConfig('development');

        expect(config.crossOriginEmbedderPolicy).toBe(false);
        expect(config.crossOriginOpenerPolicy).toBe(false);
        expect(config.crossOriginResourcePolicy).toBe(false);
      });
    });

    describe('Common Security Headers', () => {
      it('should enable X-Frame-Options (clickjacking protection)', () => {
        const config = getHelmetConfig('production');

        expect(config.frameguard).toMatchObject({
          action: 'deny',
        });
      });

      it('should enable X-Content-Type-Options (MIME sniffing protection)', () => {
        const config = getHelmetConfig('production');

        expect(config.noSniff).toBe(true);
      });

      it('should enable X-XSS-Protection', () => {
        const config = getHelmetConfig('production');

        expect(config.xssFilter).toBe(true);
      });

      it('should configure Referrer-Policy', () => {
        const config = getHelmetConfig('production');

        expect(config.referrerPolicy).toMatchObject({
          policy: 'strict-origin-when-cross-origin',
        });
      });

      // Note: permissionsPolicy is not available in Helmet v7+
      // If needed, implement as custom middleware
      // it('should configure Permissions-Policy', () => {
      //   const config = getHelmetConfig('production');
      //   expect(config.permissionsPolicy).toBeDefined();
      // });

      it('should disable DNS prefetch control', () => {
        const config = getHelmetConfig('production');

        expect(config.dnsPrefetchControl).toMatchObject({
          allow: false,
        });
      });
    });

    describe('CSP Directives', () => {
      it('should configure default-src directive', () => {
        const config = getHelmetConfig('production');

        expect(config.contentSecurityPolicy).toBeDefined();
        if (typeof config.contentSecurityPolicy === 'object') {
          expect(config.contentSecurityPolicy.directives?.defaultSrc).toContain(
            "'self'",
          );
        }
      });

      it('should configure script-src directive', () => {
        const config = getHelmetConfig('production');

        if (typeof config.contentSecurityPolicy === 'object') {
          expect(config.contentSecurityPolicy.directives?.scriptSrc).toContain(
            "'self'",
          );
        }
      });

      it('should configure img-src directive to allow data URIs and HTTPS', () => {
        const config = getHelmetConfig('production');

        if (typeof config.contentSecurityPolicy === 'object') {
          expect(config.contentSecurityPolicy.directives?.imgSrc).toContain(
            "'self'",
          );
          expect(config.contentSecurityPolicy.directives?.imgSrc).toContain(
            'data:',
          );
          expect(config.contentSecurityPolicy.directives?.imgSrc).toContain(
            'https:',
          );
        }
      });

      it('should block object-src and frame-src', () => {
        const config = getHelmetConfig('production');

        if (typeof config.contentSecurityPolicy === 'object') {
          expect(config.contentSecurityPolicy.directives?.objectSrc).toEqual([
            "'none'",
          ]);
          expect(config.contentSecurityPolicy.directives?.frameSrc).toEqual([
            "'none'",
          ]);
        }
      });

      it('should enable upgrade-insecure-requests', () => {
        const config = getHelmetConfig('production');

        if (typeof config.contentSecurityPolicy === 'object') {
          expect(
            config.contentSecurityPolicy.directives?.upgradeInsecureRequests,
          ).toEqual([]);
        }
      });
    });

    describe('Default Environment', () => {
      it('should default to production if no environment provided', () => {
        const configNoEnv = getHelmetConfig();
        const configProduction = getHelmetConfig('production');

        expect(configNoEnv).toEqual(configProduction);
      });
    });
  });

  describe('HELMET_PRESETS', () => {
    it('should have STRICT preset', () => {
      expect(HELMET_PRESETS.STRICT).toBeDefined();
      expect(HELMET_PRESETS.STRICT.contentSecurityPolicy).toBeDefined();
      expect(HELMET_PRESETS.STRICT.hsts).toBeDefined();
    });

    it('should have BALANCED preset', () => {
      expect(HELMET_PRESETS.BALANCED).toBeDefined();
      expect(HELMET_PRESETS.BALANCED.contentSecurityPolicy).toBeDefined();
    });

    it('should have DEVELOPMENT preset', () => {
      expect(HELMET_PRESETS.DEVELOPMENT).toBeDefined();
      expect(HELMET_PRESETS.DEVELOPMENT.contentSecurityPolicy).toBe(false);
      expect(HELMET_PRESETS.DEVELOPMENT.hsts).toBe(false);
    });
  });

  describe('SECURITY_HEADERS', () => {
    it('should export security header constants', () => {
      expect(SECURITY_HEADERS.CSP).toBe('Content-Security-Policy');
      expect(SECURITY_HEADERS.HSTS).toBe('Strict-Transport-Security');
      expect(SECURITY_HEADERS.FRAME_OPTIONS).toBe('X-Frame-Options');
      expect(SECURITY_HEADERS.CONTENT_TYPE_OPTIONS).toBe(
        'X-Content-Type-Options',
      );
      expect(SECURITY_HEADERS.REFERRER_POLICY).toBe('Referrer-Policy');
      expect(SECURITY_HEADERS.PERMISSIONS_POLICY).toBe('Permissions-Policy');
    });
  });
});
