import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';

/**
 * Auth Views Controller
 * Serves HTML pages for authentication flows
 */
@Controller()
export class AuthViewsController {
  /**
   * Serve login page at root URL
   */
  @Get('/')
  serveLogin(@Res() res: Response) {
    return res.sendFile(join(__dirname, '../../../public/auth/login.html'));
  }

  /**
   * Serve registration page
   */
  @Get('/register')
  serveRegister(@Res() res: Response) {
    return res.sendFile(join(__dirname, '../../../public/auth/register.html'));
  }

  /**
   * Serve email verification page
   */
  @Get('/verify')
  serveVerify(@Res() res: Response) {
    return res.sendFile(
      join(__dirname, '../../../public/auth/verify-email.html'),
    );
  }

  /**
   * Serve forgot password page
   */
  @Get('/forgot-password')
  serveForgotPassword(@Res() res: Response) {
    return res.sendFile(
      join(__dirname, '../../../public/auth/forgot-password.html'),
    );
  }

  /**
   * Serve reset password page
   */
  @Get('/reset-password')
  serveResetPassword(@Res() res: Response) {
    return res.sendFile(
      join(__dirname, '../../../public/auth/reset-password.html'),
    );
  }

  /**
   * Serve dashboard page
   */
  @Get('/dashboard')
  serveDashboard(@Res() res: Response) {
    return res.sendFile(join(__dirname, '../../../public/auth/dashboard.html'));
  }
}
