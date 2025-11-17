import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsArray,
  IsEnum,
  IsString,
  IsOptional,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { OrderStatus } from '../enums/order-status.enum';

export class BulkUpdateStatusDto {
  @ApiProperty({
    description: 'Array of order IDs to update',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001',
    ],
  })
  @IsNotEmpty({ message: 'Order IDs are required' })
  @IsArray({ message: 'Order IDs must be an array' })
  @ArrayMinSize(1, { message: 'At least one order ID is required' })
  orderIds: string[];

  @ApiProperty({
    description: 'New status for all orders',
    enum: OrderStatus,
    example: OrderStatus.PROCESSING,
  })
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(OrderStatus, { message: 'Invalid order status' })
  status: OrderStatus;

  @ApiPropertyOptional({
    description: 'Reason for bulk status change',
    example: 'Batch processing by warehouse team',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'User or system that triggered the change',
    example: 'warehouse-manager-id',
  })
  @IsOptional()
  @IsString()
  triggeredBy?: string;
}

export class BulkUpdateStatusResponseDto {
  @ApiProperty({ example: 15 })
  successCount: number;

  @ApiProperty({ example: 2 })
  failureCount: number;

  @ApiProperty({
    example: [
      { orderId: '123e4567-e89b-12d3-a456-426614174000', success: true },
      {
        orderId: '123e4567-e89b-12d3-a456-426614174001',
        success: false,
        error: 'Invalid state transition',
      },
    ],
  })
  results: Array<{
    orderId: string;
    success: boolean;
    error?: string;
  }>;
}
