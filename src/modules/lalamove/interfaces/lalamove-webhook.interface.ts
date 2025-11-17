/**
 * Lalamove Webhook Interfaces
 * Based on Lalamove API v3 webhook events
 */

import { LalamoveCoordinates } from './lalamove-quotation.interface';

/**
 * Webhook event types
 */
export type LalamoveWebhookEventType =
  | 'ORDER.STATUS_CHANGED'
  | 'ORDER.DRIVER_ASSIGNED'
  | 'ORDER.PICKED_UP'
  | 'ORDER.COMPLETED'
  | 'ORDER.CANCELED'
  | 'ORDER.DRIVER_LOCATION_UPDATED'
  | 'ORDER.POD_UPLOADED';

/**
 * Driver information in webhook
 */
export interface WebhookDriverInfo {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  plateNumber: string;
}

/**
 * Proof of Delivery information
 */
export interface WebhookPOD {
  status: string;
  image?: string;
  signature?: string;
  images?: string[];
}

/**
 * Webhook event data structure
 */
export interface LalamoveWebhookEventData {
  status?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driver?: WebhookDriverInfo;
  coordinates?: LalamoveCoordinates;
  stopId?: string;
  POD?: WebhookPOD;
  proofOfDelivery?: {
    images?: string[];
  };
  cancellationReason?: string;
  timestamp?: string;
}

/**
 * Complete webhook payload from Lalamove
 */
export interface LalamoveWebhookPayload {
  orderId: string;
  eventType: LalamoveWebhookEventType;
  timestamp: string;
  data: LalamoveWebhookEventData;
}

/**
 * Webhook signature verification
 */
export interface WebhookSignature {
  signature: string;
  timestamp: string;
}

/**
 * Webhook setup request
 */
export interface WebhookSetupRequest {
  url: string;
  events?: LalamoveWebhookEventType[];
}

/**
 * Webhook setup response
 */
export interface WebhookSetupResponse {
  webhookId: string;
  url: string;
  events: LalamoveWebhookEventType[];
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

/**
 * Notification data for internal use
 */
export interface WebhookNotificationData {
  orderId: string;
  eventType: LalamoveWebhookEventType;
  title: string;
  message: string;
  priority: 'urgent' | 'high' | 'normal';
  userId?: string;
  metadata?: Record<string, any>;
}
