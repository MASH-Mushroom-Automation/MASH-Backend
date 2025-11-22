import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { OrderStatus } from '../enums/order-status.enum';
import {
  STATE_TRANSITIONS,
  TransitionReason,
  TransitionMetadata,
  isValidTransition,
  getAllowedNextStates,
  isTerminalState,
  isCancellable,
  isReturnable,
  getTransitionDescription,
} from './state-transitions';

/**
 * Order State Machine Service
 * 
 * Manages order status transitions with validation and business rules.
 * Ensures orders can only move through valid state transitions.
 */
@Injectable()
export class OrderStateMachineService {
  private readonly logger = new Logger(OrderStateMachineService.name);

  /**
   * Validate if a state transition is allowed
   * 
   * @param fromStatus - Current order status
   * @param toStatus - Desired next status
   * @throws BadRequestException if transition is invalid
   */
  validateTransition(fromStatus: OrderStatus, toStatus: OrderStatus): void {
    // Check if transition is valid
    if (!isValidTransition(fromStatus, toStatus)) {
      const allowed = getAllowedNextStates(fromStatus);
      throw new BadRequestException(
        `Invalid status transition from ${fromStatus} to ${toStatus}. ` +
        `Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}`,
      );
    }

    // Check if current state is terminal
    if (isTerminalState(fromStatus) && fromStatus !== toStatus) {
      throw new BadRequestException(
        `Cannot transition from terminal state ${fromStatus}`,
      );
    }

    this.logger.log(
      `Validated transition: ${fromStatus} → ${toStatus}`,
    );
  }

  /**
   * Get allowed next states for an order
   * 
   * @param currentStatus - Current order status
   * @returns Array of allowed next states
   */
  getAllowedNextStates(currentStatus: OrderStatus): OrderStatus[] {
    return getAllowedNextStates(currentStatus);
  }

  /**
   * Check if order can be cancelled
   * 
   * @param currentStatus - Current order status
   * @returns true if order can be cancelled
   */
  canBeCancelled(currentStatus: OrderStatus): boolean {
    return isCancellable(currentStatus);
  }

  /**
   * Check if order can be returned
   * 
   * @param currentStatus - Current order status
   * @returns true if order can be returned
   */
  canBeReturned(currentStatus: OrderStatus): boolean {
    return isReturnable(currentStatus);
  }

  /**
   * Check if order is in terminal state
   * 
   * @param currentStatus - Current order status
   * @returns true if state is terminal
   */
  isTerminalState(currentStatus: OrderStatus): boolean {
    return isTerminalState(currentStatus);
  }

  /**
   * Get transition description for logging/notifications
   * 
   * @param fromStatus - Previous status
   * @param toStatus - New status
   * @param reason - Optional transition reason
   * @returns Human-readable description
   */
  getTransitionDescription(
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    reason?: TransitionReason,
  ): string {
    return getTransitionDescription(fromStatus, toStatus, reason);
  }

  /**
   * Determine next automatic transition based on business logic
   * 
   * @param currentStatus - Current order status
   * @returns Next status to transition to, or null if manual action required
   */
  getNextAutomaticTransition(currentStatus: OrderStatus): OrderStatus | null {
    const automaticTransitions: Partial<Record<OrderStatus, OrderStatus>> = {
      [OrderStatus.PAYMENT_PENDING]: null, // Wait for payment webhook
      [OrderStatus.CONFIRMED]: OrderStatus.PROCESSING, // Auto-start processing
      [OrderStatus.SHIPPED]: OrderStatus.IN_TRANSIT, // Auto-update from courier
      [OrderStatus.CANCELLED]: OrderStatus.REFUNDED, // Auto-process refund
      [OrderStatus.RETURNED]: OrderStatus.REFUNDED, // Auto-process refund
    };

    return automaticTransitions[currentStatus] ?? null;
  }

  /**
   * Create transition metadata
   * 
   * @param reason - Transition reason
   * @param triggeredBy - User ID who triggered transition
   * @param notes - Optional notes
   * @param additionalData - Additional context
   * @returns TransitionMetadata object
   */
  createTransitionMetadata(
    reason: TransitionReason,
    triggeredBy?: string,
    notes?: string,
    additionalData?: Record<string, any>,
  ): TransitionMetadata {
    return {
      reason,
      notes,
      triggeredBy,
      triggeredAt: new Date(),
      additionalData,
    };
  }

  /**
   * Validate transition with business rules
   * 
   * @param fromStatus - Current status
   * @param toStatus - Desired status
   * @param orderData - Order data for validation
   * @throws BadRequestException if business rules fail
   */
  async validateBusinessRules(
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    orderData: {
      paymentStatus?: string;
      hasShippingInfo?: boolean;
      hasFulfillmentData?: boolean;
      returnWindowExpired?: boolean;
    },
  ): Promise<void> {
    // Payment confirmation requires successful payment
    if (
      toStatus === OrderStatus.CONFIRMED &&
      orderData.paymentStatus !== 'COMPLETED'
    ) {
      throw new BadRequestException(
        'Cannot confirm order without successful payment',
      );
    }

    // Shipping requires shipping information
    if (
      toStatus === OrderStatus.SHIPPED &&
      !orderData.hasShippingInfo
    ) {
      throw new BadRequestException(
        'Cannot ship order without shipping information',
      );
    }

    // Returns cannot be processed after return window
    if (
      toStatus === OrderStatus.RETURNED &&
      orderData.returnWindowExpired
    ) {
      throw new BadRequestException(
        'Return window has expired for this order',
      );
    }

    this.logger.log(
      `Business rules validated for transition: ${fromStatus} → ${toStatus}`,
    );
  }

  /**
   * Get transition timeline for order tracking
   * 
   * @param statusHistory - Array of status history records
   * @returns Timeline with descriptions
   */
  getOrderTimeline(
    statusHistory: Array<{
      fromStatus: OrderStatus | null;
      toStatus: OrderStatus;
      changedAt: Date;
      notes?: string;
    }>,
  ): Array<{
    status: OrderStatus;
    description: string;
    timestamp: Date;
    notes?: string;
  }> {
    return statusHistory.map((record) => ({
      status: record.toStatus,
      description: this.getTransitionDescription(
        record.fromStatus || OrderStatus.PENDING,
        record.toStatus,
      ),
      timestamp: record.changedAt,
      notes: record.notes,
    }));
  }
}
