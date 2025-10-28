import { SetMetadata } from '@nestjs/common';

/**
 * Permissions decorator - marks routes that require specific permissions
 * Use with PermissionsGuard for fine-grained access control
 *
 * Permissions format: "resource:action"
 * Examples: "devices:read", "orders:create", "users:delete"
 *
 * @example
 * @Permissions('devices:read', 'devices:update')
 * @UseGuards(ClerkAuthGuard, PermissionsGuard)
 * @Get('devices')
 * getDevices() { ... }
 */
export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
