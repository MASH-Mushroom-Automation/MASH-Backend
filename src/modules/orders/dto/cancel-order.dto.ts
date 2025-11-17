import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, MaxLength, IsOptional } from 'class-validator';

export enum CancellationReason {
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  FRAUDULENT_ORDER = 'FRAUDULENT_ORDER',
  DELIVERY_ISSUES = 'DELIVERY_ISSUES',
  DUPLICATE_ORDER = 'DUPLICATE_ORDER',
  PRICING_ERROR = 'PRICING_ERROR',
  OTHER = 'OTHER',
}

export class CancelOrderDto {
  @ApiProperty({
    description: 'Reason for order cancellation',
    enum: CancellationReason,
    example: CancellationReason.CUSTOMER_REQUEST,
  })
  @IsNotEmpty({ message: 'Cancellation reason is required' })
  @IsEnum(CancellationReason, { message: 'Invalid cancellation reason' })
  reason: CancellationReason;

  @ApiPropertyOptional({
    description: 'Additional notes about the cancellation',
    example: 'Customer requested cancellation via phone',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Notes cannot exceed 1000 characters' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Whether to initiate automatic refund',
    example: true,
    default: true,
  })
  @IsOptional()
  initiateRefund?: boolean;
}
