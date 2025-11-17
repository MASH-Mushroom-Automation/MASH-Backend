import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsString,
  Min,
  Max,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { RefundMethod } from '../enums/order-status.enum';

export class RefundOrderDto {
  @ApiProperty({
    description: 'Refund amount',
    example: 750.0,
    minimum: 0,
  })
  @IsNotEmpty({ message: 'Refund amount is required' })
  @IsNumber({}, { message: 'Refund amount must be a number' })
  @Min(0, { message: 'Refund amount cannot be negative' })
  amount: number;

  @ApiProperty({
    description: 'Refund method',
    enum: RefundMethod,
    example: RefundMethod.ORIGINAL_PAYMENT,
  })
  @IsNotEmpty({ message: 'Refund method is required' })
  @IsEnum(RefundMethod, { message: 'Invalid refund method' })
  method: RefundMethod;

  @ApiPropertyOptional({
    description: 'Reason for refund',
    example: 'Return approved - defective product',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Reason cannot exceed 500 characters' })
  reason?: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the refund',
    example: 'Customer agreed to store credit option',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
  notes?: string;
}

export class RefundOrderResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  refundId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  orderId: string;

  @ApiProperty({ example: 'ORD-2025-000001' })
  orderNumber: string;

  @ApiProperty({ example: 750.0 })
  refundAmount: number;

  @ApiProperty({ enum: RefundMethod, example: RefundMethod.ORIGINAL_PAYMENT })
  refundMethod: RefundMethod;

  @ApiProperty({ example: 'PROCESSING' })
  status: string;

  @ApiProperty({ example: 'Return approved - defective product' })
  reason: string;

  @ApiProperty({ example: '2025-11-18T10:00:00Z' })
  createdAt: Date;

  @ApiPropertyOptional({ example: '2025-11-20T10:00:00Z' })
  processedAt?: Date;

  @ApiPropertyOptional({ example: 'REF-PAYMONGO-123456' })
  externalRefundId?: string;

  @ApiPropertyOptional({ example: '2025-11-23T10:00:00Z' })
  estimatedCompletionDate?: Date;
}
