import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { BasePaymentProvider } from './base-payment.provider';
import {
  CreatePaymentIntentRequest,
  PaymentIntentResponse,
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  PaymentStatusResponse,
  CreateRefundRequest,
  RefundResponse,
  WebhookPayload,
} from '../interfaces/payment-provider.interface';
import {
  PaymentProvider,
  PaymentMethod,
  PaymentStatus,
  Currency,
} from '../enums/payment.enum';

/**
 * GCash Provider
 * 
 * Implements direct GCash payment integration:
 * - QR code generation for payments
 * - Deep linking to GCash mobile app
 * - Real-time payment confirmation via webhooks
 * - Refund processing
 * 
 * GCash Flow:
 * 1. Create payment intent → Generate QR code or deep link
 * 2. User scans QR or clicks deep link → Opens GCash app
 * 3. User confirms payment in GCash app
 * 4. Webhook notification → Update payment status
 * 5. Query payment status for confirmation
 */
@Injectable()
export class GCashProvider extends BasePaymentProvider {
  private readonly apiClient: AxiosInstance;
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly merchantId: string;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    super(PaymentProvider.GCASH);

    // Load GCash configuration
    this.apiUrl = this.configService.get<string>('gcash.apiUrl') || 'https://api.gcash.com/v1';
    this.apiKey = this.configService.get<string>('gcash.apiKey');
    this.apiSecret = this.configService.get<string>('gcash.apiSecret');
    this.merchantId = this.configService.get<string>('gcash.merchantId');
    this.webhookSecret = this.configService.get<string>('gcash.webhookSecret');

    // Initialize axios client with auth
    this.apiClient = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      timeout: 30000, // 30 seconds
    });

    // Add request interceptor for HMAC signature
    this.apiClient.interceptors.request.use((config) => {
      const timestamp = Date.now().toString();
      const signature = this.generateSignature(
        config.method.toUpperCase(),
        config.url,
        timestamp,
        JSON.stringify(config.data || ''),
      );

      config.headers['X-Timestamp'] = timestamp;
      config.headers['X-Signature'] = signature;

      return config;
    });

    this.logger.log('GCash Provider initialized');
  }

  /**
   * Create payment intent with GCash
   * Generates QR code or deep link URL
   */
  async createPaymentIntent(
    request: CreatePaymentIntentRequest,
  ): Promise<PaymentIntentResponse> {
    this.logAction('createPaymentIntent', { amount: request.amount });

    try {
      const response = await this.apiClient.post('/payments/create', {
        merchantId: this.merchantId,
        amount: request.amount,
        currency: request.currency,
        referenceId: request.metadata?.orderId || 'N/A',
        description: request.description || 'GCash Payment',
        metadata: request.metadata,
        redirectUrl: `${process.env.FRONTEND_URL}/payment/callback`,
        notificationUrl: `${process.env.BACKEND_URL}/api/v1/payments/webhooks/gcash`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      });

      const { data } = response.data;

      return {
        id: data.paymentId,
        status: this.mapGCashStatus(data.status),
        amount: request.amount,
        currency: request.currency,
        paymentMethod: PaymentMethod.GCASH,
        clientSecret: null, // GCash doesn't use client secrets
        qrCodeUrl: data.qrCodeUrl,
        redirectUrl: data.deepLink,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        metadata: {
          qrCode: data.qrCode, // Base64 QR code image
          deepLink: data.deepLink, // gcash://pay?payment_id=xxx
          merchantId: this.merchantId,
        },
      };
    } catch (error) {
      this.logError('createPaymentIntent', error);
      throw new Error(`GCash payment creation failed: ${error.message}`);
    }
  }

  /**
   * Confirm payment (not used for GCash - payment is confirmed via webhook)
   * This method checks payment status instead
   */
  async confirmPayment(
    request: ConfirmPaymentRequest,
  ): Promise<ConfirmPaymentResponse> {
    this.logAction('confirmPayment', { paymentIntentId: request.paymentIntentId });

    try {
      // For GCash, confirmation happens automatically via webhook
      // This method queries the payment status
      const statusResponse = await this.getPaymentStatus(request.paymentIntentId);

      return {
        id: statusResponse.id,
        status: statusResponse.status,
        nextAction: statusResponse.status === PaymentStatus.PENDING ? {
          type: 'redirect',
          url: statusResponse.metadata?.redirectUrl,
          qrCode: statusResponse.metadata?.qrCode,
        } : undefined,
      };
    } catch (error) {
      this.logError('confirmPayment', error);
      throw new Error(`GCash payment confirmation failed: ${error.message}`);
    }
  }

  /**
   * Get payment status from GCash
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    this.logAction('getPaymentStatus', { paymentId });

    try {
      const response = await this.apiClient.get(`/payments/${paymentId}`);
      const { data } = response.data;

      return {
        id: data.paymentId,
        status: this.mapGCashStatus(data.status),
        amount: data.amount,
        currency: data.currency,
        paymentMethod: PaymentMethod.GCASH,
        metadata: {
          gcashTransactionId: data.transactionId,
          gcashReferenceNo: data.referenceNo,
          paidAt: data.paidAt,
          expiresAt: data.expiresAt,
          merchantId: data.merchantId,
        },
      };
    } catch (error) {
      this.logError('getPaymentStatus', error);
      throw new Error(`Failed to get GCash payment status: ${error.message}`);
    }
  }

  /**
   * Cancel payment (if not yet paid)
   */
  async cancelPayment(paymentId: string): Promise<PaymentStatusResponse> {
    this.logAction('cancelPayment', { paymentId });

    try {
      await this.apiClient.post(`/payments/${paymentId}/cancel`, {
        merchantId: this.merchantId,
        reason: 'Cancelled by merchant',
      });

      this.logger.log(`GCash payment ${paymentId} cancelled successfully`);

      // Return updated status
      return await this.getPaymentStatus(paymentId);
    } catch (error) {
      this.logError('cancelPayment', error);
      throw new Error(`Failed to cancel GCash payment: ${error.message}`);
    }
  }

  /**
   * Create refund for GCash payment
   */
  async createRefund(request: CreateRefundRequest): Promise<RefundResponse> {
    this.logAction('createRefund', {
      paymentId: request.paymentId,
      amount: request.amount,
    });

    try {
      const response = await this.apiClient.post('/refunds/create', {
        merchantId: this.merchantId,
        paymentId: request.paymentId,
        amount: request.amount,
        reason: request.reason,
        notes: request.notes,
        metadata: request.metadata,
      });

      const { data } = response.data;

      return {
        id: data.refundId,
        paymentId: request.paymentId,
        amount: data.amount,
        currency: Currency.PHP,
        status: this.mapGCashRefundStatus(data.status),
        reason: request.reason,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        metadata: {
          gcashRefundId: data.refundId,
          gcashTransactionId: data.transactionId,
          refundedAt: data.refundedAt,
          estimatedArrival: data.estimatedArrival,
        },
      };
    } catch (error) {
      this.logError('createRefund', error);
      throw new Error(`GCash refund creation failed: ${error.message}`);
    }
  }

  /**
   * Get refund status
   */
  async getRefundStatus(refundId: string): Promise<RefundResponse> {
    this.logAction('getRefundStatus', { refundId });

    try {
      const response = await this.apiClient.get(`/refunds/${refundId}`);
      const { data } = response.data;

      return {
        id: data.refundId,
        paymentId: data.paymentId,
        amount: data.amount,
        currency: Currency.PHP,
        status: this.mapGCashRefundStatus(data.status),
        reason: data.reason,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        metadata: {
          gcashRefundId: data.refundId,
          gcashTransactionId: data.transactionId,
          refundedAt: data.refundedAt,
          estimatedArrival: data.estimatedArrival,
        },
      };
    } catch (error) {
      this.logError('getRefundStatus', error);
      throw new Error(`Failed to get GCash refund status: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature from GCash
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error);
      return false;
    }
  }

  /**
   * Process webhook from GCash
   * 
   * Webhook events:
   * - payment.success: Payment completed
   * - payment.failed: Payment failed
   * - payment.expired: Payment expired
   * - refund.completed: Refund completed
   */
  async processWebhook(payload: WebhookPayload): Promise<void> {
    this.logAction('processWebhook', { type: payload.type });

    try {
      switch (payload.type) {
        case 'payment.success':
          await this.handlePaymentSuccess(payload.data);
          break;

        case 'payment.failed':
          await this.handlePaymentFailed(payload.data);
          break;

        case 'payment.expired':
          await this.handlePaymentExpired(payload.data);
          break;

        case 'refund.completed':
          await this.handleRefundCompleted(payload.data);
          break;

        default:
          this.logger.warn(`Unhandled GCash webhook event: ${payload.type}`);
      }
    } catch (error) {
      this.logError('processWebhook', error);
      throw error;
    }
  }

  /**
   * Handle successful payment webhook
   */
  private async handlePaymentSuccess(data: any): Promise<void> {
    this.logger.log(`GCash payment success: ${data.paymentId}`);
    
    // Payment status will be updated by PaymentService
    // This is just logging the webhook receipt
  }

  /**
   * Handle failed payment webhook
   */
  private async handlePaymentFailed(data: any): Promise<void> {
    this.logger.warn(`GCash payment failed: ${data.paymentId}`, {
      reason: data.failureReason,
    });
  }

  /**
   * Handle expired payment webhook
   */
  private async handlePaymentExpired(data: any): Promise<void> {
    this.logger.warn(`GCash payment expired: ${data.paymentId}`);
  }

  /**
   * Handle refund completed webhook
   */
  private async handleRefundCompleted(data: any): Promise<void> {
    this.logger.log(`GCash refund completed: ${data.refundId}`);
  }

  /**
   * Generate HMAC signature for API requests
   */
  private generateSignature(
    method: string,
    url: string,
    timestamp: string,
    body: string,
  ): string {
    const message = `${method}|${url}|${timestamp}|${body}`;
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');
  }

  /**
   * Map GCash status to internal PaymentStatus
   */
  private mapGCashStatus(gcashStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      pending: PaymentStatus.PENDING,
      processing: PaymentStatus.PROCESSING,
      success: PaymentStatus.COMPLETED,
      completed: PaymentStatus.COMPLETED,
      failed: PaymentStatus.FAILED,
      cancelled: PaymentStatus.CANCELLED,
      expired: PaymentStatus.EXPIRED,
      refunded: PaymentStatus.REFUNDED,
      partial_refund: PaymentStatus.PARTIALLY_REFUNDED,
    };

    return statusMap[gcashStatus.toLowerCase()] || PaymentStatus.PENDING;
  }

  /**
   * Map GCash refund status to internal PaymentStatus
   */
  private mapGCashRefundStatus(gcashStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      pending: PaymentStatus.PROCESSING,
      processing: PaymentStatus.PROCESSING,
      completed: PaymentStatus.REFUNDED,
      success: PaymentStatus.REFUNDED,
      failed: PaymentStatus.FAILED,
    };

    return statusMap[gcashStatus.toLowerCase()] || PaymentStatus.PROCESSING;
  }
}
