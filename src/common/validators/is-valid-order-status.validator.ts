import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Order status enum (should match Prisma schema)
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

/**
 * Valid order status transitions
 * Maps current status -> allowed next statuses
 */
const VALID_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED, // In case of return during shipping
  ],
  [OrderStatus.DELIVERED]: [
    OrderStatus.REFUNDED, // Only refund after delivery
  ],
  [OrderStatus.CANCELLED]: [], // Terminal state
  [OrderStatus.REFUNDED]: [], // Terminal state
};

@ValidatorConstraint({ name: 'isValidOrderStatus', async: false })
export class IsValidOrderStatusConstraint
  implements ValidatorConstraintInterface
{
  validate(newStatus: string, args: ValidationArguments): boolean {
    if (!newStatus || typeof newStatus !== 'string') {
      return false;
    }

    // Check if newStatus is a valid OrderStatus enum value
    if (!Object.values(OrderStatus).includes(newStatus as OrderStatus)) {
      return false;
    }

    // If no current status is provided, any status is valid (for creation)
    const object = args.object as any;
    const currentStatus = object.currentStatus;

    if (!currentStatus) {
      return true; // Allow any status for new orders
    }

    // Validate status transition
    const allowedTransitions =
      VALID_STATUS_TRANSITIONS[currentStatus as OrderStatus];
    if (!allowedTransitions) {
      return false; // Invalid current status
    }

    return allowedTransitions.includes(newStatus as OrderStatus);
  }

  defaultMessage(args: ValidationArguments): string {
    const object = args.object as any;
    const currentStatus = object.currentStatus;

    if (!currentStatus) {
      return `Order status must be one of: ${Object.values(OrderStatus).join(', ')}`;
    }

    const allowedTransitions =
      VALID_STATUS_TRANSITIONS[currentStatus as OrderStatus];
    if (!allowedTransitions || allowedTransitions.length === 0) {
      return `Cannot change status from ${currentStatus} (terminal state)`;
    }

    return `Invalid status transition from ${currentStatus}. Allowed transitions: ${allowedTransitions.join(', ')}`;
  }
}

/**
 * Validates order status and status transitions
 * Ensures that orders follow the correct state machine workflow
 *
 * @example
 * ```typescript
 * class UpdateOrderStatusDto {
 *   @IsValidOrderStatus()
 *   status: OrderStatus;
 *
 *   // Optional: current status for transition validation
 *   currentStatus?: OrderStatus;
 * }
 * ```
 */
export function IsValidOrderStatus(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsValidOrderStatusConstraint,
    });
  };
}
