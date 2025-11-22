import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ThrottleEndpoint } from '../../common/decorators/throttle-endpoint.decorator';
import { PaymentService } from './payment.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import {
  PaymentIntentResponseDto,
  PaymentStatusResponseDto,
  RefundResponseDto,
} from './dto/payment-response.dto';
import { PaymentProvider } from './enums/payment.enum';
import { Request } from 'express';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ThrottleEndpoint('STANDARD')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create payment intent
   */
  @Post('intents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create payment intent',
    description:
      'Create a payment intent for an order. Returns checkout URL or QR code based on payment method.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment intent created successfully',
    type: PaymentIntentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async createPaymentIntent(
    @Body() dto: CreatePaymentIntentDto,
      @CurrentUser('id') userId: string,
  ): Promise<PaymentIntentResponseDto> {
    return this.paymentService.createPaymentIntent(dto, userId);
  }

  /**
   * Confirm payment
   */
  @Post('intents/:intentId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm payment',
    description:
      'Confirm a payment intent. Used for card payments that require confirmation.',
  })
  @ApiParam({
    name: 'intentId',
    description: 'Payment intent ID',
    example: 'pi_1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid payment intent' })
  @ApiResponse({ status: 404, description: 'Payment intent not found' })
  async confirmPayment(
    @Param('intentId') intentId: string,
    @Body() dto: Partial<ConfirmPaymentDto>,
  ) {
    return this.paymentService.confirmPayment({
      paymentIntentId: intentId,
      ...dto,
    });
  }

  /**
   * Get payment status
   */
  @Get(':paymentId/status')
  @ApiOperation({
    summary: 'Get payment status',
    description: 'Get the current status of a payment',
  })
  @ApiParam({
    name: 'paymentId',
    description: 'Payment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment status retrieved successfully',
    type: PaymentStatusResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentStatus(
    @Param('paymentId') paymentId: string,
  ): Promise<PaymentStatusResponseDto> {
    return this.paymentService.getPaymentStatus(paymentId);
  }

  /**
   * Cancel payment
   */
  @Post(':paymentId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel payment',
    description: 'Cancel a pending payment',
  })
  @ApiParam({
    name: 'paymentId',
    description: 'Payment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment cancelled successfully',
    type: PaymentStatusResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Payment cannot be cancelled' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async cancelPayment(
    @Param('paymentId') paymentId: string,
  ): Promise<PaymentStatusResponseDto> {
    return this.paymentService.cancelPayment(paymentId);
  }

  /**
   * Create refund
   */
  @Post('refunds')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Create refund',
    description: 'Create a refund for a completed payment (Admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Refund created successfully',
    type: RefundResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid refund request' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async createRefund(@Body() dto: CreateRefundDto): Promise<RefundResponseDto> {
    return this.paymentService.createRefund(dto);
  }

  /**
   * Get payment by order
   */
  @Get('orders/:orderId')
  @ApiOperation({
    summary: 'Get payment by order',
    description: 'Get payment information for a specific order',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentByOrder(@Param('orderId') orderId: string) {
    return this.paymentService.getPaymentByOrderId(orderId);
  }

  /**
   * Get user payments
   */
  @Get('my-payments')
  @ApiOperation({
    summary: 'Get my payments',
    description: 'Get current user payment history',
  })
  @ApiResponse({
    status: 200,
    description: 'Payments retrieved successfully',
  })
  async getMyPayments(@CurrentUser('id') userId: string) {
    return this.paymentService.getUserPayments(userId);
  }

  /**
   * PayMongo webhook endpoint
   */
  @Post('webhooks/paymongo')
  @HttpCode(HttpStatus.OK)
  @ThrottleEndpoint('UNRESTRICTED')
  @ApiOperation({
    summary: 'PayMongo webhook',
    description: 'Handle PayMongo webhook events',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handlePayMongoWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('paymongo-signature') signature: string,
  ) {
    const payload = req.body;
    return this.paymentService.processWebhook(
      PaymentProvider.PAYMONGO,
      payload as any,
      signature,
    );
  }

  /**
   * GCash webhook endpoint
   */
  @Post('webhooks/gcash')
  @HttpCode(HttpStatus.OK)
  @ThrottleEndpoint('UNRESTRICTED')
  @ApiOperation({
    summary: 'GCash webhook',
    description: 'Handle GCash webhook events',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleGCashWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-gcash-signature') signature: string,
  ) {
    const payload = req.body;
    return this.paymentService.processWebhook(
      PaymentProvider.GCASH,
      payload as any,
      signature,
    );
  }

  /**
   * Maya webhook endpoint
   */
  @Post('webhooks/maya')
  @HttpCode(HttpStatus.OK)
  @ThrottleEndpoint('UNRESTRICTED')
  @ApiOperation({
    summary: 'Maya webhook',
    description: 'Handle Maya webhook events',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleMayaWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-maya-signature') signature: string,
  ) {
    const payload = req.body;
    return this.paymentService.processWebhook(
      PaymentProvider.MAYA,
      payload as any,
      signature,
    );
  }
}
