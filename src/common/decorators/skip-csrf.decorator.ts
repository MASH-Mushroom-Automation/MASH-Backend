import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to skip CSRF protection for specific routes
 *
 * Use this decorator on endpoints that:
 * - Handle OAuth callbacks (Google, Facebook, Firebase)
 * - Use alternative authentication (API keys, JWT in body)
 * - Are webhooks with signature verification
 *
 * @example
 * ```typescript
 * @Post('google/login')
 * @SkipCsrf()
 * @Public()
 * async loginWithGoogle(@Body() dto: GoogleLoginDto) {
 *   return this.authService.loginWithGoogle(dto);
 * }
 * ```
 */
export const SKIP_CSRF_KEY = 'skipCsrf';
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
