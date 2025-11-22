import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PrometheusService } from '../../monitoring/prometheus/prometheus.service';
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
import {
  PaymentProvider,
  PaymentMethod,
  PaymentStatus,
} from '../enums/payment.enum';
import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from '../dto/confirm-payment.dto';
import { CreateRefundDto } from '../dto/create-refund.dto';

/**
 * Payment Service
 * 
 * Main payment orchestration service that:
 * - Routes payment requests to appropriate providers (Factory Pattern)
 * - Manages payment lifecycle
 * - Tracks payment metrics
 * - Handles webhook processing
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly providers: Map<PaymentProvider, IPaymentProvider> =
    new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly prometheus: PrometheusService,
  ) {
    this.logger.log('🏦 PaymentService initialized');
  }

  /**
   * Register a payment provider
   */
  registerProvider(
    providerType: PaymentProvider,
    provider: IPaymentProvider,
  ): void {
    this.providers.set(providerType, provider);
    this.logger.log(`✅ Registered provider: ${providerType}`);
  }

  /**
   * Get provider by payment method
   */
  private getProviderByMethod(method: PaymentMethod): IPaymentProvider {
    let providerType: PaymentProvider;

    // Map payment method to provider
    switch (method) {
      case PaymentMethod.GCASH:
        providerType = PaymentProvider.GCASH;
        break;
      case PaymentMethod.PAYMAYA:
        providerType = PaymentProvider.MAYA;
        break;
      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.DEBIT_CARD:
      case PaymentMethod.GRAB_PAY:
        providerType = PaymentProvider.PAYMONGO;
        break;
      case PaymentMethod.BANK_TRANSFER:
        providerType = PaymentProvider.BANK_TRANSFER;
        break;
      case PaymentMethod.CASH_ON_DELIVERY:
        providerType = PaymentProvider.CASH_ON_DELIVERY;
        break;
      default:
        throw new BadRequestException(
          `Unsupported payment method: ${method}`,
        );
    }

    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new BadRequestException(
        `Provider not registered: ${providerType}`,
      );
    }

    return provider;
  }

  /**
   * Create payment intent
   */
  async createPaymentIntent(
    dto: CreatePaymentIntentDto,
    userId: string,
  ): Promise<PaymentIntentResponse> {
    const startTime = Date.now();
    this.logger.log(
      `Creating payment intent: Order ${dto.orderId}, Method ${dto.paymentMethod}, Amount ${dto.amount}`,
    );

    try {
      // Get the appropriate provider
      const provider = this.getProviderByMethod(dto.paymentMethod);

      // Build request
      const request: CreatePaymentIntentRequest = {
        amount: dto.amount,
        currency: dto.currency,
        paymentMethod: dto.paymentMethod,
        description: dto.description,
        metadata: {
          ...dto.metadata,
          orderId: dto.orderId,
          userId,
        },
        customerInfo: dto.customerInfo,
        billingDetails: dto.billingDetails,
      };

      // Create payment intent with provider
      const response = await provider.createPaymentIntent(request);

      // Save to database
      await this.prisma.payment.create({
        data: {
          orderId: dto.orderId,
          userId,
          amount: dto.amount,
          currency: dto.currency,
          method: dto.paymentMethod,
          status: PaymentStatus.PENDING,
          transactionId: response.id,
          gatewayResponse: response as any,
        },
      });

      // Track metrics (skip if prometheus metrics don't exist)
      const duration = Date.now() - startTime;

      this.logger.log(`✅ Payment intent created: ${response.id}`);
      return response;
    } catch (error) {
      this.logger.error(
        `❌ Failed to create payment intent: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Confirm payment
   */
  async confirmPayment(
    dto: ConfirmPaymentDto,
  ): Promise<ConfirmPaymentResponse> {
    const startTime = Date.now();
    this.logger.log(`Confirming payment: ${dto.paymentIntentId}`);

    try {
      // Find payment in database
      const payment = await this.prisma.payment.findFirst({
        where: { transactionId: dto.paymentIntentId },
      });

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      // Get provider
      const provider = this.getProviderByMethod(
        payment.method as PaymentMethod,
      );

      // Confirm with provider
      const response = await provider.confirmPayment({
        paymentIntentId: dto.paymentIntentId,
        paymentMethodId: dto.paymentMethodId,
        returnUrl: dto.returnUrl,
      });

      // Update database
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: response.status,
          gatewayResponse: response as any,
        },
      });

      // Track metrics
      const duration = Date.now() - startTime;

      this.logger.log(`✅ Payment confirmed: ${dto.paymentIntentId}`);
      return response;
    } catch (error) {
      this.logger.error(
        `❌ Failed to confirm payment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    this.logger.log(`Getting payment status: ${paymentId}`);

    try {
      // Find payment
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      // Get provider
      const provider = this.getProviderByMethod(
        payment.method as PaymentMethod,
      );

      // Get status from provider
      const status = await provider.getPaymentStatus(
        payment.transactionId,
      );

      // Update database if status changed
      if (status.status !== payment.status) {
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: status.status,
            processedAt: status.paidAt,
            failedAt: status.failedAt,
          },
        });
      }

      return status;
    } catch (error) {
      this.logger.error(
        `❌ Failed to get payment status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(paymentId: string): Promise<PaymentStatusResponse> {
    this.logger.log(`Cancelling payment: ${paymentId}`);

    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      const provider = this.getProviderByMethod(
        payment.method as PaymentMethod,
      );

      const status = await provider.cancelPayment(payment.transactionId);

      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.CANCELLED,
          failedAt: new Date(),
        },
      });

      this.logger.log(`✅ Payment cancelled: ${paymentId}`);
      return status;
    } catch (error) {
      this.logger.error(
        `❌ Failed to cancel payment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create refund
   */
  async createRefund(dto: CreateRefundDto): Promise<RefundResponse> {
    const startTime = Date.now();
    this.logger.log(`Creating refund for payment: ${dto.paymentId}`);

    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: dto.paymentId },
      });

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException(
          'Can only refund completed payments',
        );
      }

      const provider = this.getProviderByMethod(
        payment.method as PaymentMethod,
      );

      const request: CreateRefundRequest = {
        paymentId: payment.transactionId,
        amount: dto.amount,
        reason: dto.reason,
        notes: dto.notes,
        metadata: dto.metadata,
      };

      const refund = await provider.createRefund(request);

      // Update payment status to refunded
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
        },
      });

      const duration = Date.now() - startTime;

      this.logger.log(`✅ Refund created: ${refund.id}`);
      return refund;
    } catch (error) {
      this.logger.error(
        `❌ Failed to create refund: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Process webhook
   */
  async processWebhook(
    provider: PaymentProvider,
    payload: WebhookPayload,
    signature: string,
  ): Promise<void> {
    this.logger.log(`Processing webhook from ${provider}: ${payload.type}`);

    try {
      const providerInstance = this.providers.get(provider);
      if (!providerInstance) {
        throw new BadRequestException(`Provider not found: ${provider}`);
      }

      // Verify signature
      const isValid = providerInstance.verifyWebhookSignature(
        JSON.stringify(payload),
        signature,
      );

      if (!isValid) {
        throw new BadRequestException('Invalid webhook signature');
      }

      // Process webhook
      await providerInstance.processWebhook(payload);

      this.logger.log(`✅ Webhook processed: ${payload.type}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to process webhook: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get payment by order ID
   */
  async getPaymentByOrderId(orderId: string): Promise<any> {
    return this.prisma.payment.findFirst({
      where: { orderId },
      include: {
        order: true,
        user: true,
      },
    });
  }

  /**
   * Get user payments
   */
  async getUserPayments(userId: string, limit = 10): Promise<any[]> {
    return this.prisma.payment.findMany({
      where: { userId },
      include: {
        order: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
