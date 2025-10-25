import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

/**
 * Reusable Swagger decorator for JWT authentication requirements
 *
 * Adds comprehensive documentation for endpoints requiring JWT authentication.
 * Includes bearer token requirement and optional role-based access control.
 *
 * @param roles - Optional list of required roles (e.g., 'ADMIN', 'SUPER_ADMIN')
 *
 * @example
 * ```typescript
 * // Any authenticated user
 * @Get()
 * @ApiAuthRequired()
 * async findAll() {
 *   // Implementation
 * }
 *
 * // ADMIN or SUPER_ADMIN role required
 * @Delete(':id')
 * @ApiAuthRequired('ADMIN', 'SUPER_ADMIN')
 * async remove(@Param('id') id: string) {
 *   // Implementation
 * }
 * ```
 */
export function ApiAuthRequired(...roles: string[]) {
  const roleDescription =
    roles.length > 0
      ? `Required roles: ${roles.join(', ')}`
      : 'Any authenticated user';

  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiHeader({
      name: 'Authorization',
      description: `Bearer JWT token (obtained from /api/v1/auth/login). ${roleDescription}`,
      required: true,
      schema: {
        type: 'string',
        example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        pattern: '^Bearer [A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_.+/=]*$',
      },
    }),
  );
}
