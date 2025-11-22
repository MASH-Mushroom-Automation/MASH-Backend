import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsString, IsOptional, MaxLength } from 'class-validator';
import { OrderStatus } from '../enums/order-status.enum';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'New order status',
    enum: OrderStatus,
    example: OrderStatus.CONFIRMED,
  })
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(OrderStatus, { message: 'Invalid order status' })
  status: OrderStatus;

  @ApiPropertyOptional({
    description: 'Reason for status change',
    example: 'Payment confirmed by PayMongo',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'User or system that triggered the status change',
    example: 'admin-user-id or system',
  })
  @IsOptional()
  @IsString()
  triggeredBy?: string;
}
