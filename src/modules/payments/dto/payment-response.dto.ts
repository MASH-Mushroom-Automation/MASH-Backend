import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, PaymentMethod, Currency } from '../enums/payment.enum';

/**
 * Next Action Response DTO
 */
export class NextActionResponseDto {
  @ApiProperty({
    description: 'Type of next action required',
    example: 'redirect',
  })
  type: string;

  @ApiPropertyOptional({
    description: 'URL to redirect to',
    example: 'https://paymongo.com/checkout/abc123',
  })
  url?: string;

  @ApiPropertyOptional({
    description: 'QR code URL or data',
    example: 'https://api.paymongo.com/qr/xyz789.png',
  })
  qrCode?: string;
}

/**
 * Payment Intent Response DTO
 */
export class PaymentIntentResponseDto {
  @ApiProperty({
    description: 'Payment intent ID',
    example: 'pi_1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @ApiProperty({
    description: 'Payment amount in centavos',
    example: 150000,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency',
    enum: Currency,
    example: Currency.PHP,
  })
  currency: Currency;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.GCASH,
  })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Client secret for client-side SDK',
    example: 'pi_1234567890_secret_abc123',
  })
  clientSecret?: string;

  @ApiPropertyOptional({
    description: 'Checkout URL',
    example: 'https://paymongo.com/checkout/abc123',
  })
  checkoutUrl?: string;

  @ApiPropertyOptional({
    description: 'QR code URL',
    example: 'https://api.paymongo.com/qr/xyz789.png',
  })
  qrCodeUrl?: string;

  @ApiPropertyOptional({
    description: 'Redirect URL',
    example: 'https://mash.com/payment/redirect',
  })
  redirectUrl?: string;

  @ApiPropertyOptional({
    description: 'Payment intent expiration time',
    example: '2025-11-18T12:00:00Z',
  })
  expiresAt?: Date;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { orderId: 'ORD-20251118-00001' },
  })
  metadata?: Record<string, any>;
}

/**
 * Payment Status Response DTO
 */
export class PaymentStatusResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.COMPLETED,
  })
  status: PaymentStatus;

  @ApiProperty({
    description: 'Payment amount in centavos',
    example: 150000,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency',
    enum: Currency,
    example: Currency.PHP,
  })
  currency: Currency;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.GCASH,
  })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Payment completion timestamp',
    example: '2025-11-18T10:30:00Z',
  })
  paidAt?: Date;

  @ApiPropertyOptional({
    description: 'Payment failure timestamp',
    example: '2025-11-18T10:35:00Z',
  })
  failedAt?: Date;

  @ApiPropertyOptional({
    description: 'Failure reason',
    example: 'Insufficient funds',
  })
  failureReason?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { orderId: 'ORD-20251118-00001' },
  })
  metadata?: Record<string, any>;
}

/**
 * Refund Response DTO
 */
export class RefundResponseDto {
  @ApiProperty({
    description: 'Refund ID',
    example: 're_1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Original payment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  paymentId: string;

  @ApiProperty({
    description: 'Refund amount in centavos',
    example: 50000,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency',
    enum: Currency,
    example: Currency.PHP,
  })
  currency: Currency;

  @ApiProperty({
    description: 'Refund status',
    enum: PaymentStatus,
    example: PaymentStatus.COMPLETED,
  })
  status: PaymentStatus;

  @ApiProperty({
    description: 'Refund reason',
    example: 'requested_by_customer',
  })
  reason: string;

  @ApiProperty({
    description: 'Refund creation timestamp',
    example: '2025-11-18T11:00:00Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { support_ticket: 'TKT-12345' },
  })
  metadata?: Record<string, any>;
}
