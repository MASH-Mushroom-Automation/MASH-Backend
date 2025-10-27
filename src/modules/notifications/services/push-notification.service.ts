import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  badge?: string;
  image?: string;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
  tag?: string;
  renotify?: boolean;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  userId: string;
  deviceId?: string;
}

export interface SendPushOptions {
  userId?: string;
  deviceId?: string;
  subscription?: PushSubscription;
  payload: PushNotificationPayload;
  priority?: 'normal' | 'high';
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private vapidKeys: { publicKey: string; privateKey: string } | null = null;

  constructor(private readonly prisma: PrismaService) {
    this.initializeVAPID();
  }

  private initializeVAPID() {
    // Check if VAPID keys are configured
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (publicKey && privateKey) {
      this.vapidKeys = { publicKey, privateKey };
      this.logger.log('VAPID keys configured for web push notifications');
    } else {
      this.logger.warn('VAPID keys not configured - web push notifications disabled');
    }
  }

  /**
   * Register a push subscription for a user
   */
  async registerSubscription(
    userId: string,
    subscription: PushSubscription,
    deviceId?: string,
  ) {
    try {
      // Check if subscription already exists
      const existing = await this.prisma.pushSubscription.findFirst({
        where: {
          endpoint: subscription.endpoint,
          userId,
        },
      });

      if (existing) {
        // Update existing subscription
        await this.prisma.pushSubscription.update({
          where: { id: existing.id },
          data: {
            keys: subscription.keys,
            userAgent: subscription.userAgent,
            deviceId,
            updatedAt: new Date(),
          },
        });
        this.logger.log(`Updated push subscription for user ${userId}`);
      } else {
        // Create new subscription
        await this.prisma.pushSubscription.create({
          data: {
            userId,
            deviceId,
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            userAgent: subscription.userAgent,
          },
        });
        this.logger.log(`Registered new push subscription for user ${userId}`);
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to register push subscription: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unregister a push subscription
   */
  async unregisterSubscription(userId: string, endpoint: string) {
    try {
      await this.prisma.pushSubscription.deleteMany({
        where: {
          userId,
          endpoint,
        },
      });
      this.logger.log(`Unregistered push subscription for user ${userId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to unregister push subscription: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send push notification to user
   */
  async sendToUser(options: SendPushOptions) {
    try {
      const { userId, payload } = options;

      // Get all active subscriptions for the user
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: {
          userId,
          // TODO: Add active status when added to schema
        },
      });

      if (subscriptions.length === 0) {
        this.logger.warn(`No push subscriptions found for user ${userId}`);
        return { success: false, message: 'No subscriptions found' };
      }

      const results = await Promise.allSettled(
        subscriptions.map(sub => this.sendToSubscription(sub, payload)),
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      this.logger.log(
        `Push notification sent to user ${userId}: ${successful} successful, ${failed} failed`,
      );

      return {
        success: successful > 0,
        sent: successful,
        failed,
        total: subscriptions.length,
      };
    } catch (error) {
      this.logger.error(`Failed to send push notification to user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send push notification to specific subscription
   */
  private async sendToSubscription(
    subscription: any,
    payload: PushNotificationPayload,
  ) {
    // TODO: Implement actual web push sending using web-push library
    // For now, just log the attempt
    this.logger.log(
      `Sending push notification to ${subscription.endpoint}: ${payload.title}`,
    );

    // Mock successful send
    return { success: true, endpoint: subscription.endpoint };
  }

  /**
   * Get user's push notification preferences
   */
  async getUserPreferences(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          preferences: true,
        },
      });

      if (!user?.preferences) {
        return this.getDefaultPreferences();
      }

      const prefs = user.preferences as any;
      return {
        pushEnabled: prefs.pushEnabled ?? true,
        deviceOffline: prefs.notifications?.deviceOffline ?? true,
        healthWarnings: prefs.notifications?.healthWarnings ?? true,
        systemAlerts: prefs.notifications?.systemAlerts ?? true,
        marketing: prefs.notifications?.marketing ?? false,
        quietHours: prefs.quietHours || null,
        ...this.getDefaultPreferences(),
      };
    } catch (error) {
      this.logger.error(`Failed to get user preferences: ${error.message}`);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Update user's push notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: {
      pushEnabled?: boolean;
      deviceOffline?: boolean;
      healthWarnings?: boolean;
      systemAlerts?: boolean;
      marketing?: boolean;
      quietHours?: { start: string; end: string } | null;
    },
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });

      const currentPrefs = (user?.preferences as any) || {};
      const updatedPrefs = {
        ...currentPrefs,
        pushEnabled: preferences.pushEnabled ?? currentPrefs.pushEnabled ?? true,
        notifications: {
          ...currentPrefs.notifications,
          deviceOffline: preferences.deviceOffline ?? currentPrefs.notifications?.deviceOffline ?? true,
          healthWarnings: preferences.healthWarnings ?? currentPrefs.notifications?.healthWarnings ?? true,
          systemAlerts: preferences.systemAlerts ?? currentPrefs.notifications?.systemAlerts ?? true,
          marketing: preferences.marketing ?? currentPrefs.notifications?.marketing ?? false,
        },
        quietHours: preferences.quietHours ?? currentPrefs.quietHours ?? null,
      };

      await this.prisma.user.update({
        where: { id: userId },
        data: { preferences: updatedPrefs },
      });

      this.logger.log(`Updated push preferences for user ${userId}`);
      return updatedPrefs;
    } catch (error) {
      this.logger.error(`Failed to update user preferences: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if notification should be sent based on user preferences and quiet hours
   */
  shouldSendNotification(
    userId: string,
    notificationType: string,
    preferences?: any,
  ): boolean {
    if (!preferences) {
      return true; // Send by default if no preferences
    }

    // Check if push is enabled
    if (!preferences.pushEnabled) {
      return false;
    }

    // Check specific notification type
    const typeEnabled = preferences.notifications?.[notificationType];
    if (typeEnabled === false) {
      return false;
    }

    // Check quiet hours
    if (preferences.quietHours) {
      const now = new Date();
      const currentTime = now.getHours() * 100 + now.getMinutes();
      const startTime = this.timeToMinutes(preferences.quietHours.start);
      const endTime = this.timeToMinutes(preferences.quietHours.end);

      if (startTime < endTime) {
        // Same day range
        if (currentTime >= startTime && currentTime <= endTime) {
          return false;
        }
      } else {
        // Overnight range
        if (currentTime >= startTime || currentTime <= endTime) {
          return false;
        }
      }
    }

    return true;
  }

  private getDefaultPreferences() {
    return {
      pushEnabled: true,
      deviceOffline: true,
      healthWarnings: true,
      systemAlerts: true,
      marketing: false,
      quietHours: null,
    };
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}