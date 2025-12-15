import { Controller, Post, Body, HttpCode, HttpStatus, Optional } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeController } from '@nestjs/swagger';
import { NotificationQueueService } from '../queues/services/notification-queue.service';
import { EmailService } from './services/email.service';

@ApiExcludeController() // Hide from Swagger docs (test endpoint)
@ApiTags('SMS & Push Testing')
@Controller('test-notifications')
export class TestNotificationsController {
  constructor(
    @Optional() private readonly notificationQueue: NotificationQueueService | null,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Test SMS notification (no auth required for testing)
   */
  @Post('test-sms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send test SMS via queue' })
  @ApiResponse({ status: 200, description: 'Test SMS queued' })
  async testSms(@Body() dto: { to: string; message?: string }) {
    if (!this.notificationQueue) {
      return {
        success: false,
        error: 'Queue service not available - Redis not configured',
        timestamp: new Date().toISOString(),
      };
    }
    try {
      await this.notificationQueue.sendSms({
        to: dto.to,
        body:
          dto.message ||
          '🍄 MASH Alert: Phase 4 SMS test successful! Your notification system is working.',
        priority: 'normal',
      });

      return {
        success: true,
        message: `Test SMS queued for ${dto.to}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test Push notification (no auth required for testing)
   */
  @Post('test-push')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send test push notification via queue' })
  @ApiResponse({ status: 200, description: 'Test push notification queued' })
  async testPush(
    @Body()
    dto: {
      token: string;
      title?: string;
      message?: string;
      data?: Record<string, any>;
    },
  ) {
    try {
      await this.notificationQueue.sendPush({
        token: dto.token,
        title: dto.title || '🍄 MASH Alert System',
        body:
          dto.message || 'Phase 4 Push notification test successful! Your alert system is working.',
        data: dto.data || {
          type: 'test',
          phase: '4',
          timestamp: new Date().toISOString(),
        },
        priority: 'normal',
      });

      return {
        success: true,
        message: `Test push notification queued for token: ${dto.token.substring(0, 20)}...`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test all notification types at once
   */
  @Post('test-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send test notifications via all channels (Email + SMS + Push)',
  })
  @ApiResponse({ status: 200, description: 'All test notifications queued' })
  async testAllNotifications(
    @Body()
    dto: {
      email: string;
      phone?: string;
      pushToken?: string;
      message?: string;
    },
  ) {
    const results: Array<{ channel: string; status: string; target: string }> = [];
    const baseMessage =
      dto.message || '🍄 MASH Phase 4 Multi-Channel Test: All notification systems operational!';

    try {
      // Test Email
      await this.notificationQueue.sendEmail({
        to: [dto.email],
        subject: '✅ MASH Phase 4 - Multi-Channel Test',
        body: `${baseMessage}\\n\\n📧 Email delivery: ✅ Working\\n📱 SMS delivery: ${dto.phone ? '✅ Testing' : '❌ No phone provided'}\\n🔔 Push delivery: ${dto.pushToken ? '✅ Testing' : '❌ No token provided'}`,
        priority: 'normal',
      });
      results.push({ channel: 'email', status: 'queued', target: dto.email });

      // Test SMS (if phone provided)
      if (dto.phone) {
        await this.notificationQueue.sendSms({
          to: dto.phone,
          body: `${baseMessage} 📱 SMS Channel Working!`,
          priority: 'normal',
        });
        results.push({ channel: 'sms', status: 'queued', target: dto.phone });
      }

      // Test Push (if token provided)
      if (dto.pushToken) {
        await this.notificationQueue.sendPush({
          token: dto.pushToken,
          title: '🍄 MASH Multi-Channel Test',
          body: `${baseMessage} 🔔 Push Channel Working!`,
          data: {
            type: 'multi-channel-test',
            phase: '4',
            channels: results.map(r => r.channel),
          },
          priority: 'normal',
        });
        results.push({
          channel: 'push',
          status: 'queued',
          target: dto.pushToken.substring(0, 20) + '...',
        });
      }

      return {
        success: true,
        message: 'Multi-channel test notifications queued successfully',
        results,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        results,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test email template - Verification
   */
  @Post('test-template/verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test verification email template' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  async testVerificationEmail(@Body() dto: { to: string; firstName?: string }) {
    try {
      await this.emailService.sendVerificationEmail(
        dto.to,
        dto.firstName || 'Test User',
        `${process.env.APP_URL}/verify?token=test-token-123`,
        '24 hours',
      );

      return {
        success: true,
        message: `Verification email sent to ${dto.to}`,
        template: 'verification',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test email template - Forgot Password
   */
  @Post('test-template/forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test forgot password email template' })
  @ApiResponse({ status: 200, description: 'Forgot password email sent' })
  async testForgotPasswordEmail(@Body() dto: { to: string; firstName?: string }) {
    try {
      await this.emailService.sendForgotPasswordEmail(
        dto.to,
        dto.firstName || 'Test User',
        `${process.env.APP_URL}/reset-password?token=test-reset-token`,
        '1 hour',
      );

      return {
        success: true,
        message: `Forgot password email sent to ${dto.to}`,
        template: 'forgot-password',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test email template - Password Changed
   */
  @Post('test-template/password-changed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test password changed email template' })
  @ApiResponse({ status: 200, description: 'Password changed email sent' })
  async testPasswordChangedEmail(@Body() dto: { to: string; firstName?: string }) {
    try {
      await this.emailService.sendPasswordChangedEmail(
        dto.to,
        dto.firstName || 'Test User',
        new Date().toLocaleString(),
        '192.168.1.1',
      );

      return {
        success: true,
        message: `Password changed email sent to ${dto.to}`,
        template: 'password-changed',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test email template - 2FA Code
   */
  @Post('test-template/2fa-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test 2FA code email template' })
  @ApiResponse({ status: 200, description: '2FA code email sent' })
  async test2FACodeEmail(@Body() dto: { to: string; firstName?: string }) {
    try {
      const testCode = Math.floor(100000 + Math.random() * 900000).toString();
      await this.emailService.send2FACodeEmail(
        dto.to,
        dto.firstName || 'Test User',
        testCode,
        '10 minutes',
      );

      return {
        success: true,
        message: `2FA code email sent to ${dto.to}`,
        template: '2fa-code',
        code: testCode,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test email template - Welcome
   */
  @Post('test-template/welcome')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test welcome email template' })
  @ApiResponse({ status: 200, description: 'Welcome email sent' })
  async testWelcomeEmail(@Body() dto: { to: string; firstName?: string }) {
    try {
      await this.emailService.sendWelcomeEmail(
        dto.to,
        dto.firstName || 'Test User',
        `${process.env.APP_URL}/dashboard`,
      );

      return {
        success: true,
        message: `Welcome email sent to ${dto.to}`,
        template: 'welcome',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test email template - Account Locked
   */
  @Post('test-template/account-locked')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test account locked email template' })
  @ApiResponse({ status: 200, description: 'Account locked email sent' })
  async testAccountLockedEmail(@Body() dto: { to: string; firstName?: string }) {
    try {
      await this.emailService.sendAccountLockedEmail(
        dto.to,
        dto.firstName || 'Test User',
        'Multiple failed login attempts detected',
        new Date().toLocaleString(),
        'user-test-123',
        '192.168.1.1',
        `${process.env.APP_URL}/unlock-account?token=test-unlock-token`,
      );

      return {
        success: true,
        message: `Account locked email sent to ${dto.to}`,
        template: 'account-locked',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test email template - Password Reset Success
   */
  @Post('test-template/password-reset-success')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test password reset success email template' })
  @ApiResponse({
    status: 200,
    description: 'Password reset success email sent',
  })
  async testPasswordResetSuccessEmail(@Body() dto: { to: string; firstName?: string }) {
    try {
      await this.emailService.sendPasswordResetSuccessEmail(
        dto.to,
        dto.firstName || 'Test User',
        new Date().toLocaleString(),
        '192.168.1.1',
        'Chrome on Windows',
        `${process.env.APP_URL}/login`,
      );

      return {
        success: true,
        message: `Password reset success email sent to ${dto.to}`,
        template: 'password-reset-success',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test email template - Email Changed
   */
  @Post('test-template/email-changed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test email changed notification template' })
  @ApiResponse({ status: 200, description: 'Email changed notification sent' })
  async testEmailChangedNotification(
    @Body() dto: { oldEmail: string; newEmail: string; firstName?: string },
  ) {
    try {
      await this.emailService.sendEmailChangedNotification(
        dto.oldEmail,
        dto.newEmail,
        dto.firstName || 'Test User',
        new Date().toLocaleString(),
        '192.168.1.1',
        'Chrome on Windows',
        'Manila, Philippines',
        `${process.env.APP_URL}/account`,
      );

      return {
        success: true,
        message: `Email changed notification sent to ${dto.oldEmail} and ${dto.newEmail}`,
        template: 'email-changed',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test email template - Account Deletion
   */
  @Post('test-template/account-deletion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test account deletion email template' })
  @ApiResponse({ status: 200, description: 'Account deletion email sent' })
  async testAccountDeletionEmail(@Body() dto: { to: string; firstName?: string }) {
    try {
      const requestDate = new Date();
      const deletionDate = new Date(requestDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      await this.emailService.sendAccountDeletionEmail(
        dto.to,
        dto.firstName || 'Test User',
        requestDate.toLocaleString(),
        deletionDate.toLocaleString(),
        '30',
        `${process.env.APP_URL}/cancel-deletion?token=test-cancel-token`,
        `${process.env.APP_URL}/download-data?token=test-download-token`,
        `${process.env.APP_URL}/feedback`,
      );

      return {
        success: true,
        message: `Account deletion email sent to ${dto.to}`,
        template: 'account-deletion',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test all email templates at once
   */
  @Post('test-template/all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test all email templates' })
  @ApiResponse({ status: 200, description: 'All email templates sent' })
  async testAllEmailTemplates(@Body() dto: { to: string; firstName?: string }) {
    const results: Array<{ template: string; status: string }> = [];
    const firstName = dto.firstName || 'Test User';

    const templates = [
      {
        name: 'verification',
        send: () =>
          this.emailService.sendVerificationEmail(
            dto.to,
            firstName,
            `${process.env.APP_URL}/verify?token=test`,
            '24 hours',
          ),
      },
      {
        name: 'forgot-password',
        send: () =>
          this.emailService.sendForgotPasswordEmail(
            dto.to,
            firstName,
            `${process.env.APP_URL}/reset?token=test`,
            '1 hour',
          ),
      },
      {
        name: 'password-changed',
        send: () =>
          this.emailService.sendPasswordChangedEmail(
            dto.to,
            firstName,
            new Date().toLocaleString(),
            '192.168.1.1',
          ),
      },
      {
        name: '2fa-code',
        send: () => this.emailService.send2FACodeEmail(dto.to, firstName, '123456', '10 minutes'),
      },
      {
        name: 'welcome',
        send: () =>
          this.emailService.sendWelcomeEmail(dto.to, firstName, `${process.env.APP_URL}/dashboard`),
      },
    ];

    for (const template of templates) {
      try {
        await template.send();
        results.push({ template: template.name, status: 'sent' });
        // Wait 1 second between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({ template: template.name, status: 'failed' });
      }
    }

    return {
      success: true,
      message: `Sent ${results.filter(r => r.status === 'sent').length}/${results.length} email templates to ${dto.to}`,
      results,
      timestamp: new Date().toISOString(),
    };
  }
}
