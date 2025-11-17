/**
 * Lalamove API Constants
 * Based on Lalamove API v3 for Philippines market
 */

/**
 * Service types available in Philippines
 */
export const SERVICE_TYPES = {
  MOTORCYCLE: 'MOTORCYCLE',
  SEDAN: 'SEDAN',
  MPV: 'MPV',
  VAN: 'VAN',
  PICKUP: 'PICKUP',
  TRUCK_330: 'TRUCK_330',
  TRUCK_550: 'TRUCK_550',
} as const;

export type ServiceType = (typeof SERVICE_TYPES)[keyof typeof SERVICE_TYPES];

/**
 * Item weight categories (in kg)
 */
export const ITEM_WEIGHTS = {
  LIGHT: 'LIGHT', // < 5kg
  MEDIUM: 'MEDIUM', // 5-20kg
  HEAVY: 'HEAVY', // > 20kg
} as const;

/**
 * Item categories
 */
export const ITEM_CATEGORIES = {
  FOOD: 'FOOD',
  DOCUMENTS: 'DOCUMENTS',
  PARCELS: 'PARCELS',
  FLOWERS: 'FLOWERS',
  OTHERS: 'OTHERS',
} as const;

/**
 * Special handling instructions
 */
export const HANDLING_INSTRUCTIONS = {
  FRAGILE: 'FRAGILE',
  KEEP_UPRIGHT: 'KEEP_UPRIGHT',
  HANDLE_WITH_CARE: 'HANDLE_WITH_CARE',
  TEMPERATURE_SENSITIVE: 'TEMPERATURE_SENSITIVE',
} as const;

/**
 * Order status values from Lalamove
 */
export const ORDER_STATUSES = {
  // Pre-assignment
  ASSIGNING_DRIVER: 'ASSIGNING_DRIVER',
  
  // Driver assigned
  ON_GOING: 'ON_GOING',
  
  // In progress
  PICKED_UP: 'PICKED_UP',
  
  // Completed
  COMPLETED: 'COMPLETED',
  
  // Failed
  REJECTED: 'REJECTED',
  CANCELED: 'CANCELED',
  EXPIRED: 'EXPIRED',
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

/**
 * Supported markets
 */
export const MARKETS = {
  PH: 'PH', // Philippines
  SG: 'SG', // Singapore
  TH: 'TH', // Thailand
  HK: 'HK', // Hong Kong
  MY: 'MY', // Malaysia
  VN: 'VN', // Vietnam
  ID: 'ID', // Indonesia
} as const;

/**
 * Supported languages
 */
export const LANGUAGES = {
  EN: 'en_PH', // English (Philippines)
  TL: 'tl_PH', // Tagalog
} as const;

/**
 * API configuration
 */
export const API_CONFIG = {
  VERSION: 'v3',
  QUOTATION_EXPIRY_MINUTES: 5,
  CANCELLATION_WINDOW_MINUTES: 5,
  WEBHOOK_SIGNATURE_EXPIRY_MINUTES: 5,
  API_REQUEST_TIMEOUT_MS: 30000,
} as const;

/**
 * Webhook event types
 */
export const WEBHOOK_EVENTS = {
  ORDER_STATUS_CHANGED: 'ORDER.STATUS_CHANGED',
  DRIVER_ASSIGNED: 'ORDER.DRIVER_ASSIGNED',
  PICKED_UP: 'ORDER.PICKED_UP',
  COMPLETED: 'ORDER.COMPLETED',
  CANCELED: 'ORDER.CANCELED',
  DRIVER_LOCATION_UPDATED: 'ORDER.DRIVER_LOCATION_UPDATED',
  POD_UPLOADED: 'ORDER.POD_UPLOADED',
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

/**
 * Priority fee configuration
 */
export const PRIORITY_FEE = {
  MIN_AMOUNT: 20, // PHP
  MAX_AMOUNT: 500, // PHP
  DEFAULT_AMOUNT: 50, // PHP
} as const;

/**
 * Distance limits (in km)
 */
export const DISTANCE_LIMITS = {
  MOTORCYCLE: {
    MIN: 0.5,
    MAX: 50,
  },
  SEDAN: {
    MIN: 1,
    MAX: 100,
  },
  VAN: {
    MIN: 1,
    MAX: 150,
  },
} as const;

/**
 * Error codes
 */
export const ERROR_CODES = {
  INVALID_QUOTATION: 'INVALID_QUOTATION',
  QUOTATION_EXPIRED: 'QUOTATION_EXPIRED',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  DRIVER_NOT_ASSIGNED: 'DRIVER_NOT_ASSIGNED',
  CANCELLATION_NOT_ALLOWED: 'CANCELLATION_NOT_ALLOWED',
  INVALID_WEBHOOK_SIGNATURE: 'INVALID_WEBHOOK_SIGNATURE',
  API_ERROR: 'API_ERROR',
} as const;
