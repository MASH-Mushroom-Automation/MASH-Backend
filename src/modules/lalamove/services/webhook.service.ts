import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CommunicationHubService } from '../../notifications/services/communication-hub.service';
import {
  LalamoveWebhookPayload,
  LalamoveWebhookEventType,
  WebhookNotificationData,
} from '../interfaces/lalamove-webhook.interface';
import { WEBHOOK_EVENTS } from '../constants/lalamove.constants';

/**
 * WebhookService
 * Handles Lalamove webhook events and notifications
 * Integrated with NotificationService for multi-channel alerts
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationHub: CommunicationHubService,
  ) {}

  /**
   * Process webhook event from Lalamove
   */
  async processWebhookEvent(payload: LalamoveWebhookPayload): Promise<void> {
    this.logger.log(`Processing webhook event: ${payload.eventType} for order ${payload.orderId}`);

    try {
      // Update order in database
      await this.updateOrderStatus(payload);

      // Send notifications to user
      await this.sendNotifications(payload);

      this.logger.log(`Webhook event processed successfully: ${payload.eventType}`);
    } catch (error) {
      this.logger.error(`Failed to process webhook event: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update order status in database
   */
  private async updateOrderStatus(payload: LalamoveWebhookPayload): Promise<void> {
    const updateData: any = {
      status: payload.data.status || 'UNKNOWN',
      updatedAt: new Date(),
    };

    // Update driver ID if assigned
    if (payload.data.driverId) {
      updateData.driverId = payload.data.driverId;
    }

    // Update POD information if available
    if (payload.data.POD || payload.data.proofOfDelivery) {
      updateData.podStatus = payload.data.POD?.status || 'UPLOADED';
      updateData.podImage = payload.data.POD?.image || payload.data.proofOfDelivery?.images?.[0];
      updateData.podSignature = payload.data.POD?.signature;
    }

    await this.prisma.lalamoveOrder.update({
      where: { orderId: payload.orderId },
      data: updateData,
    });

    this.logger.debug(`Order ${payload.orderId} updated with status: ${updateData.status}`);
  }

  /**
   * Send multi-channel notifications via CommunicationHubService
   */
  private async sendNotifications(payload: LalamoveWebhookPayload): Promise<void> {
    try {
      // Get order details to find user
      const order = await this.prisma.lalamoveOrder.findUnique({
        where: { orderId: payload.orderId },
        select: { userId: true, orderReference: true },
      });

      if (!order?.userId) {
        this.logger.warn(`No user found for order ${payload.orderId}, skipping notifications`);
        return;
      }

      // Build notification data
      const notificationData = this.buildNotificationData(payload, order.orderReference);

      // Send via CommunicationHubService (email, SMS, push)
      await this.communicationHub.sendCommunication({
        userId: order.userId,
        message: {
          title: notificationData.title,
          body: notificationData.message,
          data: notificationData.metadata,
          priority: notificationData.priority,
        },
        channels: this.getNotificationChannels(payload.eventType),
      });

      this.logger.log(`Notifications sent for order ${payload.orderId}`);
    } catch (error) {
      this.logger.error(`Failed to send notifications: ${error.message}`);
      // Don't throw - notification failure shouldn't break webhook processing
    }
  }

  /**
   * Build notification data based on event type
   */
  private buildNotificationData(
    payload: LalamoveWebhookPayload,
    orderReference?: string,
  ): WebhookNotificationData {
    const orderRef = orderReference ? ` (Ref: ${orderReference})` : '';

    switch (payload.eventType) {
      case WEBHOOK_EVENTS.DRIVER_ASSIGNED:
        return {
          orderId: payload.orderId,
          eventType: payload.eventType,
          title: '🚗 Driver Assigned!',
          message: `Your delivery driver has been assigned. Driver: ${payload.data.driver?.name || 'Unknown'}${orderRef}`,
          priority: 'high',
          metadata: {
            driverId: payload.data.driverId,
            driverName: payload.data.driver?.name,
            driverPhone: payload.data.driver?.phone,
            plateNumber: payload.data.driver?.plateNumber,
          },
        };

      case WEBHOOK_EVENTS.PICKED_UP:
        return {
          orderId: payload.orderId,
          eventType: payload.eventType,
          title: '📦 Order Picked Up!',
          message: `Your order has been picked up and is on the way${orderRef}`,
          priority: 'high',
          metadata: {
            driverId: payload.data.driverId,
            coordinates: payload.data.coordinates,
          },
        };

      case WEBHOOK_EVENTS.COMPLETED:
        return {
          orderId: payload.orderId,
          eventType: payload.eventType,
          title: '✅ Delivery Completed!',
          message: `Your order has been successfully delivered${orderRef}`,
          priority: 'normal',
          metadata: {
            POD: payload.data.POD,
            proofOfDelivery: payload.data.proofOfDelivery,
          },
        };

      case WEBHOOK_EVENTS.CANCELED:
        return {
          orderId: payload.orderId,
          eventType: payload.eventType,
          title: '❌ Order Canceled',
          message: `Your delivery order has been canceled. Reason: ${payload.data.cancellationReason || 'Not specified'}${orderRef}`,
          priority: 'urgent',
          metadata: {
            cancellationReason: payload.data.cancellationReason,
          },
        };

      case WEBHOOK_EVENTS.DRIVER_LOCATION_UPDATED:
        return {
          orderId: payload.orderId,
          eventType: payload.eventType,
          title: '📍 Driver Location Updated',
          message: `Your driver is on the way${orderRef}`,
          priority: 'normal',
          metadata: {
            coordinates: payload.data.coordinates,
            driverId: payload.data.driverId,
          },
        };

      case WEBHOOK_EVENTS.POD_UPLOADED:
        return {
          orderId: payload.orderId,
          eventType: payload.eventType,
          title: '📸 Proof of Delivery Available',
          message: `Proof of delivery has been uploaded for your order${orderRef}`,
          priority: 'normal',
          metadata: {
            POD: payload.data.POD,
            proofOfDelivery: payload.data.proofOfDelivery,
          },
        };

      default:
        return {
          orderId: payload.orderId,
          eventType: payload.eventType,
          title: '🔔 Order Status Update',
          message: `Your order status has been updated: ${payload.data.status}${orderRef}`,
          priority: 'normal',
          metadata: payload.data,
        };
    }
  }

  /**
   * Determine notification channels based on event type
   */
  private getNotificationChannels(eventType: LalamoveWebhookEventType): ('email' | 'push' | 'sms')[] {
    switch (eventType) {
      case WEBHOOK_EVENTS.DRIVER_ASSIGNED:
      case WEBHOOK_EVENTS.PICKED_UP:
      case WEBHOOK_EVENTS.COMPLETED:
        // Critical events - all channels
        return ['email', 'push', 'sms'];

      case WEBHOOK_EVENTS.CANCELED:
        // Urgent events - email and push
        return ['email', 'push'];

      case WEBHOOK_EVENTS.DRIVER_LOCATION_UPDATED:
      case WEBHOOK_EVENTS.POD_UPLOADED:
        // Info events - push only
        return ['push'];

      default:
        // Default - push notifications
        return ['push'];
    }
  }

  /**
   * Log webhook event for audit trail
   */
  async logWebhookEvent(
    payload: LalamoveWebhookPayload,
    status: 'SUCCESS' | 'FAILED',
    error?: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: `LALAMOVE_WEBHOOK_${payload.eventType}`,
          entity: 'LALAMOVE_ORDER',
          entityId: payload.orderId,
          newValues: JSON.parse(
            JSON.stringify({
              payload: payload,
              status,
              error,
              timestamp: payload.timestamp,
            }),
          ),
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to log webhook event: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }
}
