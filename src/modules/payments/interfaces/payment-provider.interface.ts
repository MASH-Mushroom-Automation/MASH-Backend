/**
 * Payment Provider Interface
 * Base interface that all payment providers must implement
 */

import {
  PaymentMethod,
  PaymentStatus,
  Currency,
  RefundReason,
} from '../enums/payment.enum';

/**
 * Payment Intent Request
 */
export interface CreatePaymentIntentRequest {
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethod;
  description?: string;
  metadata?: Record<string, any>;
  customerInfo?: {
    name: string;
    email: string;
    phone?: string;
  };
  billingDetails?: {
    name: string;
    email: string;
    phone?: string;
    address?: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
}

/**
 * Payment Intent Response
 */
export interface PaymentIntentResponse {
  id: string;
  status: PaymentStatus;
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethod;
  clientSecret?: string;
  checkoutUrl?: string;
  qrCodeUrl?: string;
  redirectUrl?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Payment Confirmation Request
 */
export interface ConfirmPaymentRequest {
  paymentIntentId: string;
  paymentMethodId?: string;
  returnUrl?: string;
}

/**
 * Payment Confirmation Response
 */
export interface ConfirmPaymentResponse {
  id: string;
  status: PaymentStatus;
  nextAction?: {
    type: string;
    url?: string;
    qrCode?: string;
  };
}

/**
 * Payment Status Query Response
 */
export interface PaymentStatusResponse {
  id: string;
  status: PaymentStatus;
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethod;
  paidAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  metadata?: Record<string, any>;
}

/**
 * Refund Request
 */
export interface CreateRefundRequest {
  paymentId: string;
  amount?: number; // If not provided, full refund
  reason: RefundReason;
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * Refund Response
 */
export interface RefundResponse {
  id: string;
  paymentId: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  reason: RefundReason;
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Webhook Payload
 */
export interface WebhookPayload {
  id: string;
  type: string;
  data: any;
  createdAt: Date;
}

/**
 * Payment Provider Interface
 * All payment providers must implement this interface
 */
export interface IPaymentProvider {
  /**
   * Provider name (PAYMONGO, GCASH, MAYA, etc.)
   */
  readonly name: string;

  /**
   * Create a payment intent
   */
  createPaymentIntent(
    request: CreatePaymentIntentRequest,
  ): Promise<PaymentIntentResponse>;

  /**
   * Confirm a payment
   */
  confirmPayment(
    request: ConfirmPaymentRequest,
  ): Promise<ConfirmPaymentResponse>;

  /**
   * Get payment status
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse>;

  /**
   * Cancel a payment
   */
  cancelPayment(paymentId: string): Promise<PaymentStatusResponse>;

  /**
   * Create a refund
   */
  createRefund(request: CreateRefundRequest): Promise<RefundResponse>;

  /**
   * Get refund status
   */
  getRefundStatus(refundId: string): Promise<RefundResponse>;

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean;

  /**
   * Process webhook payload
   */
  processWebhook(payload: WebhookPayload): Promise<void>;
}
