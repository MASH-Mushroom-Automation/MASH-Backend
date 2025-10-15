import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';

/**
 * CSRF Token Controller
 *
 * Provides endpoints for clients to retrieve CSRF tokens required for
 * state-changing operations (POST, PUT, DELETE, PATCH).
 *
 * The CSRF protection middleware automatically sets the token in cookies
 * on GET requests, but this controller provides explicit endpoints for:
 * 1. Single Page Applications (SPAs) to fetch tokens on initialization
 * 2. Native mobile apps to retrieve tokens before making mutations
 * 3. Testing and debugging CSRF protection
 *
 * Usage:
 * ```typescript
 * // In your frontend app
 * const response = await fetch('/api/v1/csrf-token');
 * const { csrfToken } = await response.json();
 *
 * // Use token in subsequent requests
 * await fetch('/api/v1/resource', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-XSRF-TOKEN': csrfToken,
 *   },
 *   credentials: 'include', // Important: include cookies
 *   body: JSON.stringify(data),
 * });
 * ```
 */
@ApiTags('CSRF Protection')
@Controller('csrf-token')
export class CsrfTokenController {
  /**
   * Get CSRF token
   *
   * Returns the current CSRF token for the session. The token is also
   * automatically set in cookies and response headers.
   *
   * @returns CSRF token in JSON format
   */
  @Get()
  @ApiOperation({
    summary: 'Get CSRF token',
    description:
      'Retrieve the CSRF token required for state-changing operations. ' +
      'The token is automatically set in cookies (XSRF-TOKEN) and can be ' +
      'read from the response body or X-CSRF-Token header.',
  })
  @ApiResponse({
    status: 200,
    description: 'CSRF token retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        csrfToken: {
          type: 'string',
          description: 'CSRF token to include in subsequent requests',
          example: '1234567890.abc123def456',
        },
        expiresIn: {
          type: 'string',
          description: 'Token expiration duration',
          example: '24 hours',
        },
        headerName: {
          type: 'string',
          description: 'Header name to include token in requests',
          example: 'X-XSRF-TOKEN',
        },
        cookieName: {
          type: 'string',
          description: 'Cookie name containing the token',
          example: 'XSRF-TOKEN',
        },
      },
    },
  })
  @ApiCookieAuth('XSRF-TOKEN')
  getCsrfToken(@Req() req: Request, @Res() res: Response) {
    // Token is automatically set by CsrfProtectionMiddleware
    // Read it from cookie or header
    const csrfToken =
      req.cookies?.['XSRF-TOKEN'] || res.getHeader('X-CSRF-Token');

    return res.json({
      csrfToken,
      expiresIn: '24 hours',
      headerName: 'X-XSRF-TOKEN',
      cookieName: 'XSRF-TOKEN',
      usage: {
        description:
          'Include this token in X-XSRF-TOKEN header for POST/PUT/DELETE/PATCH requests',
        example: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': csrfToken,
          },
          credentials: 'include',
        },
      },
    });
  }

  /**
   * Refresh CSRF token
   *
   * Generates a new CSRF token and invalidates the old one.
   * Useful for token rotation or when the user reports issues.
   *
   * @returns New CSRF token
   */
  @Get('refresh')
  @ApiOperation({
    summary: 'Refresh CSRF token',
    description:
      'Generate a new CSRF token and invalidate the previous one. ' +
      'Use this endpoint for token rotation or security purposes.',
  })
  @ApiResponse({
    status: 200,
    description: 'CSRF token refreshed successfully',
  })
  refreshCsrfToken(@Req() req: Request, @Res() res: Response) {
    // Clear existing cookies to force regeneration
    res.clearCookie('XSRF-TOKEN');
    res.clearCookie('_csrf_secret');

    // Middleware will automatically generate new token on next request
    // But we'll trigger it by reading from the regenerated cookie
    const newToken = res.getHeader('X-CSRF-Token');

    return res.json({
      message: 'CSRF token refreshed successfully',
      csrfToken: newToken,
      expiresIn: '24 hours',
    });
  }
}
