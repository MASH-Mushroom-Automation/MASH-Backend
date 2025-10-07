import { SetMetadata } from '@nestjs/common';

/**
 * Public decorator - marks routes that don't require authentication
 * Use this on controllers or handlers that should be accessible without a token
 *
 * @example
 * @Public()
 * @Get('health')
 * healthCheck() { ... }
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
