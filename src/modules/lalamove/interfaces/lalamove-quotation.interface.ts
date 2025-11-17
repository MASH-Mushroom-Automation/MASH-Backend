/**
 * Lalamove Quotation Interfaces
 * Based on Lalamove API v3 response structure
 */

export interface LalamoveCoordinates {
  lat: string;
  lng: string;
}

export interface LalamoveStop {
  stopId: string;
  coordinates: LalamoveCoordinates;
  address: string;
}

export interface LalalovePriceBreakdown {
  total: string;
  currency: string;
  base: string;
  surge?: string;
  specialRequests?: string;
}

export interface LalamoveDistance {
  value: string;
  unit: string;
}

export interface LalamoveItem {
  quantity: string;
  weight: string;
  categories?: string[];
  handlingInstructions?: string[];
}

/**
 * Quotation request to Lalamove API
 */
export interface LalamoveQuotationRequest {
  serviceType: string;
  stops: Array<{
    coordinates: LalamoveCoordinates;
    address: string;
  }>;
  language?: string;
  isScheduled?: boolean;
  scheduleAt?: string;
  items?: LalamoveItem[];
  specialRequests?: string;
}

/**
 * Quotation response from Lalamove API
 */
export interface LalamoveQuotationResponse {
  quotationId: string;
  serviceType: string;
  priceBreakdown: LalalovePriceBreakdown;
  distance: LalamoveDistance;
  expiresAt: string;
  stops: LalamoveStop[];
  isScheduled?: boolean;
  scheduleAt?: string;
}

/**
 * Database model for storing quotations
 */
export interface LalamoveQuotationData {
  quotationId: string;
  serviceType: string;
  totalPrice: number;
  currency: string;
  distance: number;
  distanceUnit: string;
  expiresAt: Date;
  stops: any; // JSON field
  isScheduled: boolean;
  scheduleAt?: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'USED';
  userId?: string;
}
