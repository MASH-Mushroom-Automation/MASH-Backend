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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { NotificationQueueService } from '../queues/services/notification-queue.service';
import * as nodemailer from 'nodemailer';

@ApiTags('notifications')
@Controller('notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationQueue: NotificationQueueService,
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
  async updatePreferences(
    @Request() req,
    @Body() preferencesDto: NotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(
      req.user.id,
      preferencesDto,
    );
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
  async testEmail(
    @Body() dto: { to: string; subject?: string; body?: string },
  ) {
    await this.notificationQueue.sendEmail({
      to: [dto.to],
      subject: dto.subject || 'Test Email from MASH System',
      body:
        dto.body ||
        'This is a test email to verify your email configuration is working correctly.',
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
  async testEmailDirect(
    @Body() dto: { to: string; subject?: string; body?: string },
  ) {
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
}
