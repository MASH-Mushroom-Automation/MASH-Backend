/**
 * Order Status Enum
 * 
 * Defines all possible states in the order lifecycle.
 * Aligns with Prisma schema OrderStatus enum.
 * 
 * Order Flow:
 * 1. PENDING → Customer creates order, awaiting payment
 * 2. PAYMENT_PENDING → Payment initiated but not completed
 * 3. PAYMENT_FAILED → Payment failed, can retry
 * 4. CONFIRMED → Payment successful, order confirmed
 * 5. PROCESSING → Order being prepared/packed
 * 6. READY_TO_SHIP → Ready for courier pickup
 * 7. SHIPPED → Handed to courier
 * 8. IN_TRANSIT → With courier, on the way
 * 9. OUT_FOR_DELIVERY → Last mile delivery
 * 10. DELIVERED → Successfully delivered
 * 11. CANCELLED → Order cancelled
 * 12. RETURNED → Item returned by customer
 * 13. REFUNDED → Refund processed
 */
export enum OrderStatus {
  // Initial States
  PENDING = 'PENDING',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  
  // Confirmed & Processing
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  READY_TO_SHIP = 'READY_TO_SHIP',
  
  // In Transit
  SHIPPED = 'SHIPPED',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  
  // Terminal States
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
  REFUNDED = 'REFUNDED',
}

/**
 * Shipping Provider Enum
 */
export enum ShippingProvider {
  LALAMOVE = 'LALAMOVE',
  LBC = 'LBC',
  JNT = 'JNT',
  NINJAVAN = 'NINJAVAN',
  GRAB_EXPRESS = 'GRAB_EXPRESS',
}

/**
 * Return Reason Enum
 */
export enum ReturnReason {
  DEFECTIVE = 'DEFECTIVE',
  WRONG_ITEM = 'WRONG_ITEM',
  NOT_AS_DESCRIBED = 'NOT_AS_DESCRIBED',
  CHANGE_OF_MIND = 'CHANGE_OF_MIND',
  OTHER = 'OTHER',
}

/**
 * Return Status Enum
 */
export enum ReturnStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

/**
 * Refund Method Enum
 */
export enum RefundMethod {
  ORIGINAL_PAYMENT = 'ORIGINAL_PAYMENT',
  STORE_CREDIT = 'STORE_CREDIT',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

/**
 * Order Status Display Names
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Pending Payment',
  [OrderStatus.PAYMENT_PENDING]: 'Payment Processing',
  [OrderStatus.PAYMENT_FAILED]: 'Payment Failed',
  [OrderStatus.CONFIRMED]: 'Confirmed',
  [OrderStatus.PROCESSING]: 'Processing',
  [OrderStatus.READY_TO_SHIP]: 'Ready to Ship',
  [OrderStatus.SHIPPED]: 'Shipped',
  [OrderStatus.IN_TRANSIT]: 'In Transit',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Out for Delivery',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.CANCELLED]: 'Cancelled',
  [OrderStatus.RETURNED]: 'Returned',
  [OrderStatus.REFUNDED]: 'Refunded',
};

/**
 * Terminal states (no further transitions allowed)
 */
export const TERMINAL_STATES = [
  OrderStatus.DELIVERED,
  OrderStatus.REFUNDED,
];

/**
 * Cancellable states (can be cancelled by user or admin)
 */
export const CANCELLABLE_STATES = [
  OrderStatus.PENDING,
  OrderStatus.PAYMENT_PENDING,
  OrderStatus.PAYMENT_FAILED,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
];

/**
 * States that allow returns
 */
export const RETURNABLE_STATES = [
  OrderStatus.DELIVERED,
];
