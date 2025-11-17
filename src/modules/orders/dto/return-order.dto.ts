import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsEnum,
  IsString,
  IsNumber,
  IsArray,
  MaxLength,
  Min,
  IsOptional,
} from 'class-validator';
import { ReturnReason, RefundMethod } from '../enums/order-status.enum';

export class ReturnOrderDto {
  @ApiProperty({
    description: 'Reason for return',
    enum: ReturnReason,
    example: ReturnReason.DEFECTIVE,
  })
  @IsNotEmpty({ message: 'Return reason is required' })
  @IsEnum(ReturnReason, { message: 'Invalid return reason' })
  reason: ReturnReason;

  @ApiProperty({
    description: 'Detailed description of the return reason',
    example: 'Product arrived damaged, packaging was torn',
    maxLength: 1000,
  })
  @IsNotEmpty({ message: 'Description is required' })
  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description: string;

  @ApiPropertyOptional({
    description: 'Array of item IDs to return (if partial return)',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
  })
  @IsOptional()
  @IsArray()
  itemIds?: string[];

  @ApiPropertyOptional({
    description: 'Preferred refund method',
    enum: RefundMethod,
    example: RefundMethod.ORIGINAL_PAYMENT,
  })
  @IsOptional()
  @IsEnum(RefundMethod, { message: 'Invalid refund method' })
  refundMethod?: RefundMethod;

  @ApiPropertyOptional({
    description: 'Array of image URLs showing the issue',
    example: ['https://storage.example.com/returns/img1.jpg'],
  })
  @IsOptional()
  @IsArray()
  images?: string[];

  @ApiPropertyOptional({
    description: 'Customer contact number for return pickup',
    example: '+639171234567',
  })
  @IsOptional()
  @IsString()
  contactNumber?: string;
}

export class ReturnOrderResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  returnId: string;

  @ApiProperty({ example: 'RET-2025-000001' })
  returnNumber: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  orderId: string;

  @ApiProperty({ example: 'ORD-2025-000001' })
  orderNumber: string;

  @ApiProperty({ enum: ReturnReason, example: ReturnReason.DEFECTIVE })
  reason: ReturnReason;

  @ApiProperty({ example: 'Product arrived damaged' })
  description: string;

  @ApiProperty({ example: 'PENDING_APPROVAL' })
  status: string;

  @ApiProperty({ example: 750.0 })
  refundAmount: number;

  @ApiProperty({ enum: RefundMethod, example: RefundMethod.ORIGINAL_PAYMENT })
  refundMethod: RefundMethod;

  @ApiProperty({ example: '2025-11-18T10:00:00Z' })
  createdAt: Date;

  @ApiPropertyOptional({ example: '2025-11-20T14:00:00Z' })
  estimatedRefundDate?: Date;
}
