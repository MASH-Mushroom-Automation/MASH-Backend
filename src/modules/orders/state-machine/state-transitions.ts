import { OrderStatus } from '../enums/order-status.enum';

/**
 * State Transition Configuration
 * 
 * Defines allowed transitions between order states.
 * Key: Current state
 * Value: Array of allowed next states
 */
export const STATE_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // Initial state - can initiate payment or cancel
  [OrderStatus.PENDING]: [
    OrderStatus.PAYMENT_PENDING,
    OrderStatus.CANCELLED,
  ],

  // Payment processing - can succeed, fail, or cancel
  [OrderStatus.PAYMENT_PENDING]: [
    OrderStatus.CONFIRMED,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELLED,
  ],

  // Payment failed - can retry payment or cancel
  [OrderStatus.PAYMENT_FAILED]: [
    OrderStatus.PAYMENT_PENDING,
    OrderStatus.CANCELLED,
  ],

  // Confirmed - can start processing or cancel
  [OrderStatus.CONFIRMED]: [
    OrderStatus.PROCESSING,
    OrderStatus.CANCELLED,
  ],

  // Processing - can be ready to ship or cancel
  [OrderStatus.PROCESSING]: [
    OrderStatus.READY_TO_SHIP,
    OrderStatus.CANCELLED,
  ],

  // Ready to ship - must be shipped (no cancellation after this point)
  [OrderStatus.READY_TO_SHIP]: [
    OrderStatus.SHIPPED,
  ],

  // Shipped - moves to in transit
  [OrderStatus.SHIPPED]: [
    OrderStatus.IN_TRANSIT,
  ],

  // In transit - can be out for delivery or returned
  [OrderStatus.IN_TRANSIT]: [
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.RETURNED,
  ],

  // Out for delivery - can be delivered or returned
  [OrderStatus.OUT_FOR_DELIVERY]: [
    OrderStatus.DELIVERED,
    OrderStatus.RETURNED,
  ],

  // Delivered - can be returned (within return window)
  [OrderStatus.DELIVERED]: [
    OrderStatus.RETURNED,
  ],

  // Cancelled - must be refunded
  [OrderStatus.CANCELLED]: [
    OrderStatus.REFUNDED,
  ],

  // Returned - must be refunded
  [OrderStatus.RETURNED]: [
    OrderStatus.REFUNDED,
  ],

  // Refunded - terminal state, no further transitions
  [OrderStatus.REFUNDED]: [],
};

/**
 * Transition Reason Types
 */
export enum TransitionReason {
  // Payment related
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  
  // Fulfillment related
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  PREPARATION_STARTED = 'PREPARATION_STARTED',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  COURIER_PICKED_UP = 'COURIER_PICKED_UP',
  IN_TRANSIT_TO_CUSTOMER = 'IN_TRANSIT_TO_CUSTOMER',
  OUT_FOR_DELIVERY_NOW = 'OUT_FOR_DELIVERY_NOW',
  SUCCESSFULLY_DELIVERED = 'SUCCESSFULLY_DELIVERED',
  
  // Cancellation related
  CUSTOMER_CANCELLED = 'CUSTOMER_CANCELLED',
  ADMIN_CANCELLED = 'ADMIN_CANCELLED',
  SYSTEM_CANCELLED = 'SYSTEM_CANCELLED',
  PAYMENT_TIMEOUT = 'PAYMENT_TIMEOUT',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  
  // Return/Refund related
  CUSTOMER_RETURN_REQUEST = 'CUSTOMER_RETURN_REQUEST',
  ITEM_DEFECTIVE = 'ITEM_DEFECTIVE',
  WRONG_ITEM_DELIVERED = 'WRONG_ITEM_DELIVERED',
  REFUND_PROCESSED = 'REFUND_PROCESSED',
  
  // System related
  MANUAL_UPDATE = 'MANUAL_UPDATE',
  WEBHOOK_UPDATE = 'WEBHOOK_UPDATE',
}

/**
 * Transition metadata interface
 */
export interface TransitionMetadata {
  reason: TransitionReason;
  notes?: string;
  triggeredBy?: string; // User ID
  triggeredAt: Date;
  additionalData?: Record<string, any>;
}

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
): boolean {
  const allowedTransitions = STATE_TRANSITIONS[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
}

/**
 * Get all allowed next states for a given status
 */
export function getAllowedNextStates(
  currentStatus: OrderStatus,
): OrderStatus[] {
  return STATE_TRANSITIONS[currentStatus] || [];
}

/**
 * Check if a state is terminal (no further transitions)
 */
export function isTerminalState(status: OrderStatus): boolean {
  const allowedTransitions = STATE_TRANSITIONS[status] || [];
  return allowedTransitions.length === 0;
}

/**
 * Check if an order can be cancelled from current state
 */
export function isCancellable(currentStatus: OrderStatus): boolean {
  const allowedTransitions = STATE_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(OrderStatus.CANCELLED);
}

/**
 * Check if an order can be returned from current state
 */
export function isReturnable(currentStatus: OrderStatus): boolean {
  const allowedTransitions = STATE_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(OrderStatus.RETURNED);
}

/**
 * Get human-readable transition description
 */
export function getTransitionDescription(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  reason?: TransitionReason,
): string {
  const transitions: Record<string, string> = {
    [`${OrderStatus.PENDING}->${OrderStatus.PAYMENT_PENDING}`]: 'Payment initiated',
    [`${OrderStatus.PAYMENT_PENDING}->${OrderStatus.CONFIRMED}`]: 'Payment completed successfully',
    [`${OrderStatus.PAYMENT_PENDING}->${OrderStatus.PAYMENT_FAILED}`]: 'Payment failed',
    [`${OrderStatus.PAYMENT_FAILED}->${OrderStatus.PAYMENT_PENDING}`]: 'Retrying payment',
    [`${OrderStatus.CONFIRMED}->${OrderStatus.PROCESSING}`]: 'Order is being prepared',
    [`${OrderStatus.PROCESSING}->${OrderStatus.READY_TO_SHIP}`]: 'Order ready for shipment',
    [`${OrderStatus.READY_TO_SHIP}->${OrderStatus.SHIPPED}`]: 'Order shipped',
    [`${OrderStatus.SHIPPED}->${OrderStatus.IN_TRANSIT}`]: 'Package in transit',
    [`${OrderStatus.IN_TRANSIT}->${OrderStatus.OUT_FOR_DELIVERY}`]: 'Out for delivery',
    [`${OrderStatus.OUT_FOR_DELIVERY}->${OrderStatus.DELIVERED}`]: 'Successfully delivered',
    [`${OrderStatus.DELIVERED}->${OrderStatus.RETURNED}`]: 'Item returned',
    [`${OrderStatus.CANCELLED}->${OrderStatus.REFUNDED}`]: 'Refund processed',
    [`${OrderStatus.RETURNED}->${OrderStatus.REFUNDED}`]: 'Return refund processed',
  };

  const key = `${fromStatus}->${toStatus}`;
  return transitions[key] || `Status changed from ${fromStatus} to ${toStatus}`;
}
