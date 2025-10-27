import { Injectable, Logger } from '@nestjs/common';
import { EmailService, SendEmailOptions } from './email.service';
import { PushNotificationService, PushNotificationPayload } from './push-notification.service';
import { SmsService, SMSMessage } from './sms.service';
import { SMSTemplateService, SMSTemplateType, SMSTemplateVariables } from './sms-template.service';
import { PrismaService } from '../../../database/prisma.service';

export interface CommunicationMessage {
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface CommunicationOptions {
  userId: string;
  message: CommunicationMessage;
  channels?: ('email' | 'push' | 'sms')[];
  emailTemplate?: string;
  smsTemplate?: string;
  deviceId?: string;
}

export interface UserCommunicationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  emailTypes: string[];
  pushTypes: string[];
  smsTypes: string[];
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
}

@Injectable()
export class CommunicationHubService {
  private readonly logger = new Logger(CommunicationHubService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly smsService: SmsService,
    private readonly smsTemplateService: SMSTemplateService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Send communication through multiple channels based on user preferences
   */
  async sendCommunication(options: CommunicationOptions): Promise<{
    emailSent: boolean;
    pushSent: boolean;
    smsSent: boolean;
    errors: string[];
  }> {
    const { userId, message, channels = ['email', 'push', 'sms'] } = options;

    const result = {
      emailSent: false,
      pushSent: false,
      smsSent: false,
      errors: [] as string[],
    };

    try {
      // Get user preferences
      const preferences = await this.getUserCommunicationPreferences(userId);

      // Check if within quiet hours
      if (this.isWithinQuietHours(preferences)) {
        this.logger.log(`Skipping communication for user ${userId} - within quiet hours`);
        return result;
      }

      // Send through enabled channels
      const promises = [];

      if (channels.includes('email') && preferences.email) {
        promises.push(this.sendEmailCommunication(userId, message, options.emailTemplate));
      }

      if (channels.includes('push') && preferences.push) {
        promises.push(this.sendPushCommunication(userId, message, options.deviceId));
      }

      if (channels.includes('sms') && preferences.sms) {
        promises.push(this.sendSmsCommunication(userId, message, options.smsTemplate));
      }

      // Wait for all communications to complete
      const results = await Promise.allSettled(promises);

      // Process results
      let promiseIndex = 0;
      if (channels.includes('email') && preferences.email) {
        const promiseResult = results[promiseIndex] as PromiseSettledResult<void>;
        if (promiseResult.status === 'fulfilled') {
          result.emailSent = true;
        } else {
          result.errors.push(`Email failed: ${promiseResult.reason}`);
        }
        promiseIndex++;
      }

      if (channels.includes('push') && preferences.push) {
        const promiseResult = results[promiseIndex] as PromiseSettledResult<void>;
        if (promiseResult.status === 'fulfilled') {
          result.pushSent = true;
        } else {
          result.errors.push(`Push failed: ${promiseResult.reason}`);
        }
        promiseIndex++;
      }

      if (channels.includes('sms') && preferences.sms) {
        const promiseResult = results[promiseIndex] as PromiseSettledResult<void>;
        if (promiseResult.status === 'fulfilled') {
          result.smsSent = true;
        } else {
          result.errors.push(`SMS failed: ${promiseResult.reason}`);
        }
      }

    } catch (error) {
      this.logger.error(`Failed to send communication to user ${userId}`, error);
      result.errors.push(`Communication failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Send device health alert through appropriate channels
   */
  async sendDeviceHealthAlert(
    userId: string,
    deviceId: string,
    healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE',
    metrics: {
      cpuUsage?: number;
      memoryUsage?: number;
      temperature?: number;
      lastSeen?: Date;
    },
  ): Promise<void> {
    const message: CommunicationMessage = {
      title: `Device Health Alert - ${healthStatus}`,
      body: this.generateHealthAlertMessage(deviceId, healthStatus, metrics),
      data: {
        type: 'device_health',
        deviceId,
        healthStatus,
        metrics,
        timestamp: new Date().toISOString(),
      },
      priority: healthStatus === 'CRITICAL' ? 'urgent' : healthStatus === 'WARNING' ? 'high' : 'normal',
    };

    await this.sendCommunication({
      userId,
      message,
      channels: ['push', 'email'], // SMS for critical alerts only
      emailTemplate: healthStatus === 'OFFLINE' ? 'device-offline' : 'health-warning',
    });

    // Send SMS for critical alerts
    if (healthStatus === 'CRITICAL' || healthStatus === 'OFFLINE') {
      await this.sendCommunication({
        userId,
        message,
        channels: ['sms'],
      });
    }
  }

  /**
   * Get user communication preferences
   */
  async getUserCommunicationPreferences(userId: string): Promise<UserCommunicationPreferences> {
    try {
      // Try to get from database first
      const userPrefs = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          notificationPreferences: true,
        },
      });

      if (userPrefs?.notificationPreferences) {
        return userPrefs.notificationPreferences as UserCommunicationPreferences;
      }
    } catch (error) {
      this.logger.warn(`Failed to get user preferences from database: ${error.message}`);
    }

    // Return default preferences
    return {
      email: true,
      push: true,
      sms: false, // SMS disabled by default due to costs
      emailTypes: ['device_health', 'system_alerts', 'marketing'],
      pushTypes: ['device_health', 'system_alerts'],
      smsTypes: ['device_health'],
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
    };
  }

  /**
   * Update user communication preferences
   */
  async updateUserCommunicationPreferences(
    userId: string,
    preferences: Partial<UserCommunicationPreferences>,
  ): Promise<void> {
    try {
      const currentPrefs = await this.getUserCommunicationPreferences(userId);
      const updatedPrefs = { ...currentPrefs, ...preferences };

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          notificationPreferences: updatedPrefs,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update user communication preferences: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send email communication
   */
  private async sendEmailCommunication(
    userId: string,
    message: CommunicationMessage,
    template?: string,
  ): Promise<void> {
    try {
      // Get user email
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      });

      if (!user?.email) {
        throw new Error('User email not found');
      }

      const emailData: SendEmailOptions = {
        to: user.email,
        subject: message.title,
        templateType: (template as any) || 'default',
        variables: {
          title: message.title,
          message: message.body,
          userName: `${user.firstName} ${user.lastName}`,
          data: message.data,
        },
      };

      await this.emailService.sendTemplatedEmail(emailData);
    } catch (error) {
      this.logger.error(`Failed to send email communication: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send push notification
   */
  private async sendPushCommunication(
    userId: string,
    message: CommunicationMessage,
    deviceId?: string,
  ): Promise<void> {
    try {
      const payload: PushNotificationPayload = {
        title: message.title,
        body: message.body,
        data: message.data,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: message.data?.type || 'general',
        requireInteraction: message.priority === 'urgent',
      };

      await this.pushNotificationService.sendToUser({
        userId,
        deviceId,
        payload,
        priority: message.priority === 'urgent' ? 'high' : 'normal',
      });
    } catch (error) {
      this.logger.error(`Failed to send push communication: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send SMS communication using the SMS service with template support
   */
  private async sendSmsCommunication(
    userId: string,
    message: CommunicationMessage,
    template?: string,
  ): Promise<void> {
    try {
      // Get user's phone number from database
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phoneNumber: true },
      });

      if (!user?.phoneNumber) {
        throw new Error(`No phone number found for user ${userId}`);
      }

      // Prepare SMS message
      let smsBody: string;

      if (template) {
        // Use template if provided
        const templateType = this.mapTemplateToType(template);
        if (templateType) {
          // Extract variables from message data
          const variables = this.extractTemplateVariables(message, templateType);
          smsBody = this.smsTemplateService.renderTemplate(templateType, variables);
        } else {
          // Use template string directly
          smsBody = this.formatSmsMessage(message, template);
        }
      } else {
        // Use default formatting
        smsBody = this.formatSmsMessage(message);
      }

      const smsMessage: SMSMessage = {
        to: user.phoneNumber,
        body: smsBody,
      };

      // Send SMS
      const result = await this.smsService.sendSMS(smsMessage);

      if (!result.success) {
        throw new Error(`SMS delivery failed: ${result.error}`);
      }

      this.logger.log(`✅ SMS sent successfully to user ${userId} via ${result.provider} (${result.messageId})`);
    } catch (error) {
      this.logger.error(`❌ Failed to send SMS to user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Format message for SMS (shorter, concise format)
   */
  private formatSmsMessage(message: CommunicationMessage, template?: string): string {
    if (template) {
      // Use template if provided
      return template
        .replace('{{title}}', message.title)
        .replace('{{body}}', message.body)
        .replace('{{priority}}', message.priority || 'normal');
    }

    // Default SMS format - keep it under 160 characters for single SMS
    const baseMessage = `${message.title}: ${message.body}`;

    // Truncate if too long
    if (baseMessage.length > 160) {
      return baseMessage.substring(0, 157) + '...';
    }

    return baseMessage;
  }

  /**
   * Map template string to SMS template type
   */
  private mapTemplateToType(template: string): SMSTemplateType | null {
    const templateMap: Record<string, SMSTemplateType> = {
      'device-offline': SMSTemplateType.DEVICE_OFFLINE,
      'device-error': SMSTemplateType.DEVICE_ERROR,
      'health-warning': SMSTemplateType.HEALTH_WARNING,
      'health-critical': SMSTemplateType.HEALTH_CRITICAL,
      'test-message': SMSTemplateType.TEST_MESSAGE,
    };

    return templateMap[template] || null;
  }

  /**
   * Extract template variables from communication message
   */
  private extractTemplateVariables(
    message: CommunicationMessage,
    templateType: SMSTemplateType,
  ): SMSTemplateVariables {
    const variables: SMSTemplateVariables = {};

    // Extract common variables from message data
    if (message.data) {
      if (message.data.deviceId) variables.deviceId = message.data.deviceId;
      if (message.data.metric) variables.metric = message.data.metric;
      if (message.data.value !== undefined) variables.value = message.data.value;
      if (message.data.errorMessage) variables.errorMessage = message.data.errorMessage;
      if (message.data.lastSeen) {
        variables.lastSeen = message.data.lastSeen instanceof Date
          ? message.data.lastSeen.toISOString()
          : message.data.lastSeen;
      }
    }

    // Add timestamp for test messages
    if (templateType === SMSTemplateType.TEST_MESSAGE) {
      variables.timestamp = new Date().toISOString();
    }

    return variables;
  }

  /**
   * Check if current time is within user's quiet hours
   */
  private isWithinQuietHours(preferences: UserCommunicationPreferences): boolean {
    if (!preferences.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const startTime = this.parseTime(preferences.quietHours.start);
    const endTime = this.parseTime(preferences.quietHours.end);

    if (startTime < endTime) {
      // Same day range (e.g., 08:00 to 22:00)
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight range (e.g., 22:00 to 08:00)
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Parse time string (HH:mm) to minutes since midnight
   */
  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 100 + minutes;
  }

  /**
   * Generate health alert message
   */
  private generateHealthAlertMessage(
    deviceId: string,
    status: string,
    metrics: any,
  ): string {
    let message = `Device ${deviceId} is ${status.toLowerCase()}.`;

    if (metrics.cpuUsage !== undefined) {
      message += ` CPU: ${metrics.cpuUsage}%.`;
    }
    if (metrics.memoryUsage !== undefined) {
      message += ` Memory: ${metrics.memoryUsage}%.`;
    }
    if (metrics.temperature !== undefined) {
      message += ` Temperature: ${metrics.temperature}°C.`;
    }
    if (metrics.lastSeen) {
      message += ` Last seen: ${new Date(metrics.lastSeen).toLocaleString()}.`;
    }

    return message;
  }
}