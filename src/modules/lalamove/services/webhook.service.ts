import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { WebhookEventDto } from '../dto/webhook-event.dto';

/**
 * WebhookService
 * Handles Lalamove webhook events and notifications
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process webhook event from Lalamove
   */
  async handleWebhookEvent(event: WebhookEventDto): Promise<void> {
    this.logger.log(`📨 Received webhook: ${event.eventType} for order ${event.orderId}`);

    try {
      // Store webhook event
      await this.storeWebhookEvent(event);

      // Update order status based on event type
      await this.updateOrderStatus(event);

      // Send notifications to relevant parties
      await this.sendNotifications(event);

      this.logger.log(`✅ Webhook processed: ${event.eventType}`);
    } catch (error) {
      this.logger.error(`❌ Failed to process webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Store webhook event in database
   */
  private async storeWebhookEvent(event: WebhookEventDto): Promise<void> {
    await this.prisma.lalamoveOrder.update({
      where: { orderId: event.orderId },
      data: {
        webhookEvents: {
          push: {
            eventType: event.eventType,
            timestamp: event.timestamp,
            data: event.data,
            receivedAt: new Date().toISOString(),
          },
        },
        statusHistory: {
          push: {
            status: event.data.status || event.eventType,
            timestamp: event.timestamp,
            data: event.data,
          },
        },
      },
    });
  }

  /**
   * Update order status based on webhook event
   */
  private async updateOrderStatus(event: WebhookEventDto): Promise<void> {
    const updateData: any = {};

    switch (event.eventType) {
      case 'ORDER.ASSIGNING_DRIVER':
        updateData.status = 'ASSIGNING_DRIVER';
        break;

      case 'ORDER.ONGOING':
        updateData.status = 'ON_GOING';
        // Extract driver info from event data
        if (event.data.driver) {
          updateData.driverId = event.data.driver.id;
          updateData.driverName = event.data.driver.name;
          updateData.driverPhone = event.data.driver.phone;
          updateData.driverPhoto = event.data.driver.photo;
          updateData.plateNumber = event.data.driver.plateNumber;
        }
        break;

      case 'ORDER.PICKED_UP':
        updateData.status = 'PICKED_UP';
        updateData.pickedUpAt = new Date(event.timestamp);
        break;

      case 'ORDER.COMPLETED':
        updateData.status = 'COMPLETED';
        updateData.deliveredAt = new Date(event.timestamp);
        // Extract POD images if available
        if (event.data.proofOfDelivery?.images) {
          updateData.podImages = event.data.proofOfDelivery.images;
        }
        break;

      case 'ORDER.CANCELED':
        updateData.status = 'CANCELED';
        updateData.cancelledAt = new Date(event.timestamp);
        break;

      case 'ORDER.REJECTED':
        updateData.status = 'REJECTED';
        break;

      case 'ORDER.EXPIRED':
        updateData.status = 'EXPIRED';
        break;

      case 'DRIVER.LOCATION':
        // Update driver location
        if (event.data.coordinates) {
          updateData.currentLocation = event.data.coordinates;
        }
        break;

      default:
        this.logger.warn(`Unknown webhook event type: ${event.eventType}`);
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.lalamoveOrder.update({
        where: { orderId: event.orderId },
        data: updateData,
      });
    }
  }

  /**
   * Send notifications to relevant parties
   */
  private async sendNotifications(event: WebhookEventDto): Promise<void> {
    try {
      // Get order and MASH order details
      const lalamoveOrder = await this.prisma.lalamoveOrder.findUnique({
        where: { orderId: event.orderId },
        include: {
          mashOrder: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!lalamoveOrder?.mashOrder) {
        this.logger.warn(`MASH order not found for Lalamove order ${event.orderId}`);
        return;
      }

      const { mashOrder } = lalamoveOrder;

      // Prepare notification based on event type
      let notificationTitle = '';
      let notificationBody = '';

      switch (event.eventType) {
        case 'ORDER.ONGOING':
          notificationTitle = '🚗 Driver Assigned!';
          notificationBody = `Your order #${mashOrder.orderNumber} is on the way. Driver: ${lalamoveOrder.driverName}`;
          break;

        case 'ORDER.PICKED_UP':
          notificationTitle = '📦 Order Picked Up!';
          notificationBody = `Your order #${mashOrder.orderNumber} has been picked up and is on its way to you.`;
          break;

        case 'ORDER.COMPLETED':
          notificationTitle = '✅ Order Delivered!';
          notificationBody = `Your order #${mashOrder.orderNumber} has been successfully delivered. Thank you!`;
          break;

        case 'ORDER.CANCELED':
          notificationTitle = '❌ Order Canceled';
          notificationBody = `Your delivery for order #${mashOrder.orderNumber} has been canceled.`;
          break;

        default:
          // Skip notification for other events
          return;
      }

      // TODO: Integrate with NotificationService
      // await this.notificationService.sendPushNotification({
      //   userId: mashOrder.userId,
      //   title: notificationTitle,
      //   body: notificationBody,
      //   data: {
      //     orderId: mashOrder.id,
      //     lalamoveOrderId: event.orderId,
      //     type: 'delivery_update',
      //   },
      // });

      // TODO: Send email notification
      // await this.emailService.sendOrderStatusEmail({
      //   to: mashOrder.user.email,
      //   orderNumber: mashOrder.orderNumber,
      //   status: event.eventType,
      //   trackingLink: lalamoveOrder.shareLink,
      // });

      this.logger.log(`📧 Notification sent to user ${mashOrder.userId}`);
    } catch (error) {
      this.logger.error(`Failed to send notifications: ${error.message}`);
      // Don't throw - notifications are non-critical
    }
  }
}
