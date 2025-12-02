/**
 * Lalamove Order Interfaces
 * Based on Lalamove API v3 response structure
 */

import { LalamoveCoordinates } from './lalamove-quotation.interface';

export interface LalamoveContact {
  name: string;
  phone: string;
}

export interface LalamoveOrderStop {
  stopId: string;
  coordinates: LalamoveCoordinates;
  address: string;
  contact: LalamoveContact;
  remarks?: string;
  POD?: {
    status: string;
    image?: string;
    signature?: string;
  };
}

export interface LalamoveOrderPriceBreakdown {
  total: string;
  currency: string;
  base?: string;
  surge?: string;
  priorityFee?: string;
  specialRequests?: string;
}

export interface LalamoveDriver {
  driverId: string;
  name: string;
  phone: string;
  photo?: string;
  plateNumber: string;
  location?: LalamoveCoordinates;
  rating?: number;
  totalDeliveries?: number;
}

/**
 * Order creation request to Lalamove API
 */
export interface LalamoveOrderRequest {
  quotationId: string;
  sender: {
    stopId: string;
    name: string;
    phone: string;
    remarks?: string;
  };
  recipients: Array<{
    stopId: string;
    name: string;
    phone: string;
    remarks?: string;
  }>;
  isPODEnabled?: boolean;
  orderReference?: string;
  specialRequests?: string;
}

/**
 * Order response from Lalamove API
 */
export interface LalamoveOrderResponse {
  orderId: string;
  quotationId: string;
  status: string;
  driverId?: string;
  shareLink: string;
  priceBreakdown: LalamoveOrderPriceBreakdown;
  distance: {
    value: string;
    unit: string;
  };
  stops: LalamoveOrderStop[];
  createdAt: string;
  updatedAt?: string;
  isPODEnabled: boolean;
  orderReference?: string;
}

/**
 * Driver details response from Lalamove API
 */
export interface LalamoveDriverResponse {
  driverId: string;
  name: string;
  phone: string;
  photo?: string;
  plateNumber: string;
  location?: LalamoveCoordinates;
  rating?: number;
  totalDeliveries?: number;
}

/**
 * Priority fee request
 */
export interface LalalovePriorityFeeRequest {
  amount: number;
}

/**
 * Priority fee response
 */
export interface LalalovePriorityFeeResponse {
  orderId: string;
  priorityFee: {
    amount: string;
    currency: string;
  };
  priceBreakdown: LalamoveOrderPriceBreakdown;
}

/**
 * Database model for storing orders
 */
export interface LalamoveOrderData {
  orderId: string;
  quotationId: string;
  status: string;
  driverId?: string;
  shareLink: string;
  totalPrice: number;
  currency: string;
  distance: number;
  distanceUnit: string;
  stops: any; // JSON field
  isPODEnabled: boolean;
  orderReference?: string;
  userId?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Order status from Lalamove
 */
export type LalamoveOrderStatus =
  | 'ASSIGNING_DRIVER'
  | 'ON_GOING'
  | 'PICKED_UP'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELED'
  | 'EXPIRED';
