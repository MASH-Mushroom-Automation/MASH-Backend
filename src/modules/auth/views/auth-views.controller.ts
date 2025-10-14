import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';

/**
 * Auth Views Controller
 * Serves HTML pages for authentication flows
 * 
 * Note: In development, files are served from src/public/
 * In production (dist), files are served from dist/public/
 */
@Controller()
export class AuthViewsController {
  private getPublicPath(): string {
    // In dist: __dirname = dist/modules/auth/views
    // We need: dist/public or src/public
    const isDev = process.env.NODE_ENV !== 'production';
    return isDev
      ? join(__dirname, '../../../../src/public')
      : join(__dirname, '../../../public');
  }

  /**
   * Serve login page at root URL
   */
  @Get('/')
  serveLogin(@Res() res: Response) {
    return res.sendFile(join(this.getPublicPath(), 'auth/login.html'));
  }

  /**
   * Serve registration page
   */
  @Get('/register')
  serveRegister(@Res() res: Response) {
    return res.sendFile(join(this.getPublicPath(), 'auth/register.html'));
  }

  /**
   * Serve email verification page
   */
  @Get('/verify')
  serveVerify(@Res() res: Response) {
    return res.sendFile(join(this.getPublicPath(), 'auth/verify-email.html'));
  }

  /**
   * Serve forgot password page
   */
  @Get('/forgot-password')
  serveForgotPassword(@Res() res: Response) {
    return res.sendFile(
      join(this.getPublicPath(), 'auth/forgot-password.html'),
    );
  }

  /**
   * Serve reset password page
   */
  @Get('/reset-password')
  serveResetPassword(@Res() res: Response) {
    return res.sendFile(
      join(this.getPublicPath(), 'auth/reset-password.html'),
    );
  }

  /**
   * Serve dashboard page
   */
  @Get('/dashboard')
  serveDashboard(@Res() res: Response) {
    return res.sendFile(join(this.getPublicPath(), 'auth/dashboard.html'));
  }
}
