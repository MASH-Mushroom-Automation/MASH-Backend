import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Current User Decorator
 *
 * Extract authenticated user from request
 *
 * Usage:
 * @Get('profile')
 * getProfile(@CurrentUser() user: User) {}
 *
 * Or get specific property:
 * @Get('profile')
 * getProfile(@CurrentUser('id') userId: string) {}
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // If no user in request, return undefined
    if (!user) {
      return undefined;
    }

    // If data is provided, return specific property
    if (data) {
      return user[data];
    }

    // Return full user object
    return user;
  },
);
