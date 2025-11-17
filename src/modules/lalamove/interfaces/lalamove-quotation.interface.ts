/**
 * Lalamove Quotation Interfaces
 */

export interface ICoordinates {
  lat: string;
  lng: string;
}

export interface IStop {
  stopId?: string;
  coordinates: ICoordinates;
  address: string;
}

export interface IItem {
  quantity: string;
  weight: string;
  categories: string[];
  handlingInstructions?: string[];
}

export interface IPriceBreakdown {
  total: string;
  currency: string;
  base: string;
  surge?: string;
  specialRequests?: string;
  priorityFee?: string;
}

export interface IDistance {
  value: string;
  unit: string;
}

export interface IQuotationRequest {
  serviceType: string;
  language?: string;
  stops: IStop[];
  item: IItem;
  scheduleAt?: string;
}

export interface IQuotationResponse {
  quotationId: string;
  serviceType: string;
  priceBreakdown: IPriceBreakdown;
  distance: IDistance;
  expiresAt: string;
  stops: IStop[];
  scheduleAt?: string;
  isRouteOptimized: boolean;
}
