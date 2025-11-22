/**
 * Payment Enums
 * Defines all payment-related enumerations for the system
 */

export enum PaymentProvider {
  PAYMONGO = 'PAYMONGO',
  GCASH = 'GCASH',
  MAYA = 'MAYA',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH_ON_DELIVERY = 'CASH_ON_DELIVERY',
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  GCASH = 'GCASH',
  PAYMAYA = 'PAYMAYA',
  GRAB_PAY = 'GRAB_PAY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH_ON_DELIVERY = 'CASH_ON_DELIVERY',
  QR_CODE = 'QR_CODE',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentIntentStatus {
  AWAITING_PAYMENT_METHOD = 'AWAITING_PAYMENT_METHOD',
  AWAITING_NEXT_ACTION = 'AWAITING_NEXT_ACTION',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  CANCELLED = 'CANCELLED',
}

export enum WebhookEventType {
  PAYMENT_PAID = 'payment.paid',
  PAYMENT_FAILED = 'payment.failed',
  SOURCE_CHARGEABLE = 'source.chargeable',
  REFUND_UPDATED = 'refund.updated',
  PAYMENT_REFUNDED = 'payment.refunded',
  PAYMENT_REFUND_UPDATED = 'payment.refund.updated',
}

export enum Currency {
  PHP = 'PHP',
  USD = 'USD',
}

export enum RefundStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum RefundReason {
  DUPLICATE = 'duplicate',
  FRAUDULENT = 'fraudulent',
  REQUESTED_BY_CUSTOMER = 'requested_by_customer',
  OTHERS = 'others',
}
