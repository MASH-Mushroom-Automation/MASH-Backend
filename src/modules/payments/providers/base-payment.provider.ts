import { Logger } from '@nestjs/common';
import {
  IPaymentProvider,
  CreatePaymentIntentRequest,
  PaymentIntentResponse,
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  PaymentStatusResponse,
  CreateRefundRequest,
  RefundResponse,
  WebhookPayload,
} from '../interfaces/payment-provider.interface';

/**
 * Base Payment Provider
 * Abstract class with common functionality for all payment providers
 */
export abstract class BasePaymentProvider implements IPaymentProvider {
  protected readonly logger: Logger;

  constructor(public readonly name: string) {
    this.logger = new Logger(`${name}Provider`);
  }

  /**
   * Create payment intent - must be implemented by provider
   */
  abstract createPaymentIntent(
    request: CreatePaymentIntentRequest,
  ): Promise<PaymentIntentResponse>;

  /**
   * Confirm payment - must be implemented by provider
   */
  abstract confirmPayment(
    request: ConfirmPaymentRequest,
  ): Promise<ConfirmPaymentResponse>;

  /**
   * Get payment status - must be implemented by provider
   */
  abstract getPaymentStatus(
    paymentId: string,
  ): Promise<PaymentStatusResponse>;

  /**
   * Cancel payment - must be implemented by provider
   */
  abstract cancelPayment(paymentId: string): Promise<PaymentStatusResponse>;

  /**
   * Create refund - must be implemented by provider
   */
  abstract createRefund(
    request: CreateRefundRequest,
  ): Promise<RefundResponse>;

  /**
   * Get refund status - must be implemented by provider
   */
  abstract getRefundStatus(refundId: string): Promise<RefundResponse>;

  /**
   * Verify webhook signature - must be implemented by provider
   */
  abstract verifyWebhookSignature(
    payload: string,
    signature: string,
  ): boolean;

  /**
   * Process webhook - must be implemented by provider
   */
  abstract processWebhook(payload: WebhookPayload): Promise<void>;

  /**
   * Helper: Convert amount from PHP to centavos
   */
  protected toCentavos(amount: number): number {
    return Math.round(amount * 100);
  }

  /**
   * Helper: Convert amount from centavos to PHP
   */
  protected toPHP(centavos: number): number {
    return centavos / 100;
  }

  /**
   * Helper: Log provider action
   */
  protected logAction(action: string, details: any): void {
    this.logger.log(`[${this.name}] ${action}: ${JSON.stringify(details)}`);
  }

  /**
   * Helper: Log provider error
   */
  protected logError(action: string, error: Error): void {
    this.logger.error(
      `[${this.name}] ${action} failed: ${error.message}`,
      error.stack,
    );
  }
}
