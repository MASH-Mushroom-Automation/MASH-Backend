import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  IsObject,
} from 'class-validator';
import { RefundReason } from '../enums/payment.enum';

/**
 * Create Refund DTO
 */
export class CreateRefundDto {
  @ApiProperty({
    description: 'Payment ID to refund',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @ApiPropertyOptional({
    description: 'Refund amount in centavos (omit for full refund)',
    example: 50000,
    minimum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(100, { message: 'Refund amount must be at least ₱1.00 (100 centavos)' })
  amount?: number;

  @ApiProperty({
    description: 'Reason for refund',
    enum: RefundReason,
    example: RefundReason.REQUESTED_BY_CUSTOMER,
  })
  @IsEnum(RefundReason)
  reason: RefundReason;

  @ApiPropertyOptional({
    description: 'Additional notes about the refund',
    example: 'Customer requested refund due to wrong size',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { support_ticket: 'TKT-12345' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
