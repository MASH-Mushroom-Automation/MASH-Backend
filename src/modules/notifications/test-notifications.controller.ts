import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeController } from '@nestjs/swagger';
import { NotificationQueueService } from '../queues/services/notification-queue.service';

@ApiExcludeController() // Hide from Swagger docs (test endpoint)
@ApiTags('SMS & Push Testing')
@Controller('test-notifications')
export class TestNotificationsController {
  constructor(private readonly notificationQueue: NotificationQueueService) {}

  /**
   * Test SMS notification (no auth required for testing)
   */
  @Post('test-sms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send test SMS via queue' })
  @ApiResponse({ status: 200, description: 'Test SMS queued' })
  async testSms(@Body() dto: { to: string; message?: string }) {
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
          dto.message ||
          'Phase 4 Push notification test successful! Your alert system is working.',
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
    const results: Array<{ channel: string; status: string; target: string }> =
      [];
    const baseMessage =
      dto.message ||
      '🍄 MASH Phase 4 Multi-Channel Test: All notification systems operational!';

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
            channels: results.map((r) => r.channel),
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
}
