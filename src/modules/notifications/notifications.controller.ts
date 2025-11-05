import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';
import {
  SendDeviceHealthAlertDto,
  DeviceHealthAlertResponseDto,
} from './dto/device-health-alert.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { NotificationQueueService } from '../queues/services/notification-queue.service';
import {
  PushNotificationService,
  PushNotificationPayload,
} from './services/push-notification.service';
import {
  SmsService,
  SMSMessage,
  SMSDeliveryResult,
  SMSProviderHealth,
} from './services/sms.service';
import { CommunicationHubService } from './services/communication-hub.service';
import * as nodemailer from 'nodemailer';

@ApiTags('notifications')
@Controller('notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationQueue: NotificationQueueService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly smsService: SmsService,
    private readonly communicationHubService: CommunicationHubService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get user notifications with pagination and filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of notifications',
  })
  async findAll(@Request() req, @Query() query: NotificationQueryDto) {
    return this.notificationsService.findAll(req.user.id, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create new notification (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
  })
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get count of unread notifications' })
  @ApiResponse({
    status: 200,
    description: 'Returns unread notification count',
  })
  async getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({ status: 200, description: 'Returns notification preferences' })
  async getPreferences(@Request() req) {
    return this.notificationsService.getPreferences(req.user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update user notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated successfully' })
  async updatePreferences(@Request() req, @Body() preferencesDto: NotificationPreferencesDto) {
    return this.notificationsService.updatePreferences(req.user.id, preferencesDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiResponse({ status: 200, description: 'Returns notification details' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.notificationsService.findOne(id, req.user.id);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(@Param('id') id: string, @Request() req) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  async remove(@Param('id') id: string, @Request() req) {
    return this.notificationsService.remove(id, req.user.id);
  }

  /**
   * Test email delivery (no auth required for testing)
   */
  @Public() // <--- ALLOW UNAUTHENTICATED ACCESS FOR TESTING
  @Post('test-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send test email via queue' })
  @ApiResponse({ status: 200, description: 'Test email queued' })
  async testEmail(@Body() dto: { to: string; subject?: string; body?: string }) {
    await this.notificationQueue.sendEmail({
      to: [dto.to],
      subject: dto.subject || 'Test Email from MASH System',
      body:
        dto.body || 'This is a test email to verify your email configuration is working correctly.',
      priority: 'normal',
    });

    return {
      success: true,
      message: `Test email queued for ${dto.to}`,
    };
  }

  /**
   * Test email delivery DIRECTLY (bypasses queue - no Redis needed!)
   */
  @Public() // <--- ALLOW UNAUTHENTICATED ACCESS FOR TESTING
  @Post('test-email-direct')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send test email directly without queue (no Redis needed)',
  })
  @ApiResponse({ status: 200, description: 'Test email sent directly' })
  async testEmailDirect(@Body() dto: { to: string; subject?: string; body?: string }) {
    // Use your existing Gmail SMTP configuration
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: dto.to,
        subject: dto.subject || '✅ Direct Test Email from MASH System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">🍄 MASH Alert System</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Phase 3 Direct Email Test</p>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
              <h2 style="color: #10b981; margin-top: 0; font-size: 24px;">✅ Email Delivery Working!</h2>
              <p style="color: #6b7280; line-height: 1.6; font-size: 16px;">
                ${dto.body || 'This is a <strong>direct test email</strong> sent without using the queue system. If you receive this, your Gmail SMTP configuration is working perfectly!'}
              </p>
              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #374151; margin-top: 0; font-size: 18px;">📋 Test Details:</h3>
                <ul style="color: #6b7280; line-height: 1.8; padding-left: 20px;">
                  <li><strong>Delivery Method:</strong> Direct SMTP (No Queue)</li>
                  <li><strong>SMTP Server:</strong> ${process.env.EMAIL_HOST}</li>
                  <li><strong>Sent From:</strong> ${process.env.EMAIL_FROM}</li>
                  <li><strong>Timestamp:</strong> ${new Date().toLocaleString()}</li>
                </ul>
              </div>
              <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #065f46; font-weight: 600;">🎉 Phase 3 Success!</p>
                <p style="margin: 5px 0 0 0; color: #047857; font-size: 14px;">Your email notification system is configured correctly. Once Redis is set up, the queue-based notifications will work seamlessly!</p>
              </div>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; font-size: 14px; margin: 0; text-align: center;">
                  Sent by <strong>MASH Backend</strong> Alert & Notification System<br>
                  <span style="font-size: 12px;">Issue #10 - Phase 3 Implementation</span>
                </p>
              </div>
            </div>
          </div>
        `,
      });

      return {
        success: true,
        message: `✅ Direct email sent successfully to ${dto.to}`,
        details: {
          messageId: info.messageId,
          response: info.response,
          accepted: info.accepted,
          sentAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: 'Check your Gmail SMTP configuration in .env file',
        config: {
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT,
          user: process.env.EMAIL_USER,
          from: process.env.EMAIL_FROM,
        },
      };
    }
  }

  /**
   * Get queue statistics (admin only)
   */
  @Public() // <--- ALLOW UNAUTHENTICATED ACCESS FOR TESTING
  @Get('queue-stats')
  @ApiOperation({ summary: 'Get notification queue statistics' })
  @ApiResponse({ status: 200, description: 'Queue statistics retrieved' })
  async getQueueStats() {
    const stats = await this.notificationQueue.getQueueStats();

    return {
      success: true,
      data: stats,
    };
  }

  // ===== PUSH NOTIFICATION ENDPOINTS =====

  @Post('push/subscribe')
  @ApiOperation({ summary: 'Subscribe to push notifications' })
  @ApiResponse({ status: 201, description: 'Push subscription created' })
  @ApiResponse({ status: 400, description: 'Invalid subscription data' })
  async subscribeToPush(
    @Body()
    subscriptionData: {
      endpoint: string;
      p256dh: string;
      auth: string;
      userAgent?: string;
    },
    @Request() req,
  ) {
    const userId = req.user?.id as string;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    const subscription = {
      endpoint: subscriptionData.endpoint,
      keys: {
        p256dh: subscriptionData.p256dh,
        auth: subscriptionData.auth,
      },
      userAgent: subscriptionData.userAgent,
      userId,
    };

    const result = await this.pushNotificationService.registerSubscription(userId, subscription);

    return {
      success: true,
      data: result,
      message: 'Push subscription registered successfully',
    };
  }

  @Delete('push/unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from push notifications' })
  @ApiResponse({ status: 200, description: 'Push subscription removed' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async unsubscribeFromPush(@Body() subscriptionData: { endpoint: string }, @Request() req) {
    const userId = req.user?.id as string;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    await this.pushNotificationService.unregisterSubscription(userId, subscriptionData.endpoint);

    return {
      success: true,
      message: 'Push subscription removed successfully',
    };
  }

  @Get('push/subscriptions')
  @ApiOperation({ summary: 'Get user push subscriptions' })
  @ApiResponse({ status: 200, description: 'Push subscriptions retrieved' })
  async getPushSubscriptions(@Request() req) {
    const userId = req.user?.id as string;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    // For now, return empty array as we don't have a method to get subscriptions
    const subscriptions = [];

    return {
      success: true,
      data: subscriptions,
    };
  }

  @Post('push/test')
  @ApiOperation({ summary: 'Send test push notification' })
  @ApiResponse({ status: 200, description: 'Test notification sent' })
  async sendTestPush(@Request() req) {
    const userId = req.user?.id as string;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    const payload: PushNotificationPayload = {
      title: 'Test Notification',
      body: 'This is a test push notification from MASH',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { test: true, timestamp: new Date().toISOString() },
    };

    await this.pushNotificationService.sendToUser({ userId, payload });

    return {
      success: true,
      message: 'Test push notification sent',
    };
  }

  // ===== COMMUNICATION HUB ENDPOINTS =====

  @Post('communication/send')
  @ApiOperation({ summary: 'Send communication through multiple channels' })
  @ApiResponse({ status: 200, description: 'Communication sent successfully' })
  async sendCommunication(
    @Body()
    body: {
      userId: string;
      message: { title: string; body: string; data?: any; priority?: string };
      channels?: string[];
      emailTemplate?: string;
      smsTemplate?: string;
    },
    @Request() req,
  ) {
    const result = await this.communicationHubService.sendCommunication({
      userId: body.userId,
      message: {
        title: body.message.title,
        body: body.message.body,
        data: body.message.data,
        priority: body.message.priority as any,
      },
      channels: body.channels as any,
      emailTemplate: body.emailTemplate,
      smsTemplate: body.smsTemplate,
    });

    return {
      success: true,
      data: result,
    };
  }

  @Get('communication/preferences')
  @ApiOperation({ summary: 'Get user communication preferences' })
  @ApiResponse({ status: 200, description: 'Preferences retrieved' })
  async getCommunicationPreferences(@Request() req) {
    const userId = req.user?.id as string;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    const preferences = await this.communicationHubService.getUserCommunicationPreferences(userId);

    return {
      success: true,
      data: preferences,
    };
  }

  @Put('communication/preferences')
  @ApiOperation({ summary: 'Update user communication preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  async updateCommunicationPreferences(@Body() preferences: any, @Request() req) {
    const userId = req.user?.id as string;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    await this.communicationHubService.updateUserCommunicationPreferences(userId, preferences);

    return {
      success: true,
      message: 'Communication preferences updated',
    };
  }

  // SMS Endpoints
  @Post('sms/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Test SMS delivery to a phone number' })
  @ApiResponse({ status: 200, description: 'SMS test result' })
  async testSMS(
    @Body() body: { phoneNumber: string; message?: string },
  ): Promise<SMSDeliveryResult> {
    return this.smsService.testSMS(body.phoneNumber, body.message);
  }

  @Get('sms/providers/health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get SMS provider health status' })
  @ApiResponse({ status: 200, description: 'SMS provider health information' })
  getSMSProviderHealth(): SMSProviderHealth[] {
    return this.smsService.getProviderHealth();
  }

  @Get('sms/status/:messageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get SMS delivery status' })
  @ApiResponse({ status: 200, description: 'SMS delivery status' })
  async getSMSDeliveryStatus(
    @Param('messageId') messageId: string,
    @Query('provider') provider?: 'twilio' | 'nexmo',
  ): Promise<any> {
    return this.smsService.getDeliveryStatus(messageId, provider);
  }

  @Post('communication/device-health-alert')
  @ApiOperation({
    summary: 'Send device health alert through communication channels',
    description: `Send a device health alert that will be delivered through multiple communication channels based on the health status:

    - **HEALTHY/WARNING**: Sent via push notification and email only
    - **CRITICAL/OFFLINE**: Sent via push notification, email, and SMS (with automatic provider failover)

    The system automatically selects the appropriate channels and handles provider failover for SMS delivery.`,
  })
  @ApiResponse({
    status: 200,
    description: 'Device health alert sent successfully through appropriate channels',
    type: DeviceHealthAlertResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or missing required fields',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during alert processing',
  })
  async sendDeviceHealthAlert(
    @Body() body: SendDeviceHealthAlertDto,
  ): Promise<DeviceHealthAlertResponseDto> {
    await this.communicationHubService.sendDeviceHealthAlert(
      body.userId,
      body.deviceId,
      body.healthStatus,
      {
        ...body.metrics,
        lastSeen: body.metrics?.lastSeen ? new Date(body.metrics.lastSeen) : undefined,
      },
    );

    return {
      success: true,
      message: 'Device health alert sent',
    } as DeviceHealthAlertResponseDto;
  }
}
