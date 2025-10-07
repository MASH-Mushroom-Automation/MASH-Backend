import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * CurrentUser decorator - extracts the authenticated user from the request
 * Use this to access the current user in your controllers
 *
 * @example
 * @Get('profile')
 * @UseGuards(ClerkAuthGuard)
 * getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 *
 * @example With specific property
 * @Get('email')
 * getEmail(@CurrentUser('email') email: string) {
 *   return { email };
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // If a specific property is requested, return that
    if (data) {
      return user?.[data];
    }

    // Otherwise return the entire user object
    return user;
  },
);
