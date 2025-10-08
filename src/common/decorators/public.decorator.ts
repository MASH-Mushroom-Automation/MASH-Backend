import { SetMetadata } from '@nestjs/common';

/**
 * Public Decorator
 *
 * Mark routes as public (skip authentication)
 *
 * Usage:
 * @Public()
 * @Get('public-endpoint')
 * getPublicData() {}
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
