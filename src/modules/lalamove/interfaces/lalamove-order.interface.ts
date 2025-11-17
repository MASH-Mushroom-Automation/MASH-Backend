/**
 * Lalamove Order Interfaces
 */

export interface ISender {
  stopId: string;
  name: string;
  phone: string;
}

export interface IRecipient {
  stopId: string;
  name: string;
  phone: string;
  remarks?: string;
}

export interface IOrderRequest {
  quotationId: string;
  sender: ISender;
  recipients: IRecipient[];
  isPODEnabled?: boolean;
  partner?: string;
  metadata?: Record<string, any>;
}

export interface IDriverInfo {
  driverId: string;
  name: string;
  phone: string;
  plateNumber: string;
  photo?: string;
  coordinates?: {
    lat: string;
    lng: string;
    updatedAt: string;
  };
}

export interface IPODInfo {
  status: string;
  signature?: string;
  image?: string;
  timestamp?: string;
}

export interface IOrderResponse {
  orderId: string;
  quotationId: string;
  status: string;
  driverId?: string;
  shareLink: string;
  priceBreakdown: {
    total: string;
    currency: string;
    priorityFee?: string;
  };
  stops: Array<{
    stopId: string;
    coordinates: { lat: string; lng: string };
    address: string;
    POD?: IPODInfo;
  }>;
  scheduleAt?: string;
  distance: {
    value: string;
    unit: string;
  };
}
