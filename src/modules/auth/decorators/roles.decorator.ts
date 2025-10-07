import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Roles decorator - marks routes that require specific user roles
 * Use with RolesGuard to restrict access based on user roles
 *
 * @example
 * @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
 * @UseGuards(ClerkAuthGuard, RolesGuard)
 * @Get('admin-only')
 * adminOnlyRoute() { ... }
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
