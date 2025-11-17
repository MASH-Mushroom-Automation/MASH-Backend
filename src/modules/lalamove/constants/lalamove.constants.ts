/**
 * Lalamove API Constants
 * Philippines Market Configuration
 */

export const LALAMOVE_SERVICE_TYPES = {
  MOTORCYCLE: 'MOTORCYCLE',
  SEDAN: 'SEDAN',
  MPV: 'MPV',
  VAN: 'VAN',
} as const;

export const LALAMOVE_ITEM_WEIGHTS = {
  LESS_THAN_3_KG: 'LESS_THAN_3_KG',
  '3_TO_5_KG': '3_TO_5_KG',
  '5_TO_10_KG': '5_TO_10_KG',
  '10_TO_15_KG': '10_TO_15_KG',
  '15_TO_20_KG': '15_TO_20_KG',
} as const;

export const LALAMOVE_ITEM_CATEGORIES = {
  FOOD_DELIVERY: 'FOOD_DELIVERY',
  DOCUMENT: 'DOCUMENT',
  PARCEL: 'PARCEL',
  OFFICE_ITEM: 'OFFICE_ITEM',
  CAKE: 'CAKE',
  FLOWERS: 'FLOWERS',
} as const;

export const LALAMOVE_HANDLING_INSTRUCTIONS = {
  KEEP_UPRIGHT: 'KEEP_UPRIGHT',
  HANDLE_WITH_CARE: 'HANDLE_WITH_CARE',
  KEEP_DRY: 'KEEP_DRY',
  KEEP_COOL: 'KEEP_COOL',
} as const;

export const LALAMOVE_ORDER_STATUSES = {
  ASSIGNING_DRIVER: 'ASSIGNING_DRIVER',
  ON_GOING: 'ON_GOING',
  PICKED_UP: 'PICKED_UP',
  COMPLETED: 'COMPLETED',
  CANCELED: 'CANCELED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

export const LALAMOVE_MARKETS = {
  PHILIPPINES: 'PH',
} as const;

export const LALAMOVE_LANGUAGES = {
  ENGLISH_PH: 'en_PH',
  FILIPINO: 'tl_PH',
} as const;

// Quotation expires in 5 minutes
export const QUOTATION_EXPIRY_MINUTES = 5;

// Cancellation window in minutes
export const CANCELLATION_WINDOW_MINUTES = 5;

// Webhook signature expiry in minutes
export const WEBHOOK_SIGNATURE_EXPIRY_MINUTES = 5;

// API request timeout in milliseconds
export const API_REQUEST_TIMEOUT_MS = 30000;

// Retry configuration
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1000;

export type ServiceType = typeof LALAMOVE_SERVICE_TYPES[keyof typeof LALAMOVE_SERVICE_TYPES];
export type ItemWeight = typeof LALAMOVE_ITEM_WEIGHTS[keyof typeof LALAMOVE_ITEM_WEIGHTS];
export type ItemCategory = typeof LALAMOVE_ITEM_CATEGORIES[keyof typeof LALAMOVE_ITEM_CATEGORIES];
export type HandlingInstruction = typeof LALAMOVE_HANDLING_INSTRUCTIONS[keyof typeof LALAMOVE_HANDLING_INSTRUCTIONS];
export type OrderStatus = typeof LALAMOVE_ORDER_STATUSES[keyof typeof LALAMOVE_ORDER_STATUSES];
