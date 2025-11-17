/**
 * Lalamove Webhook Interfaces
 */

export interface IWebhookEvent {
  orderId: string;
  status: string;
  timestamp: string;
  data: {
    driverId?: string;
    driverName?: string;
    driverPhone?: string;
    coordinates?: {
      lat: string;
      lng: string;
    };
    stopId?: string;
    POD?: {
      status: string;
      image?: string;
      signature?: string;
    };
    cancellationReason?: string;
  };
}

export interface IWebhookSetupRequest {
  url: string;
}

export interface IWebhookSetupResponse {
  url: string;
  status: string;
  createdAt: string;
}
