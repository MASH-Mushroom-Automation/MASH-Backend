import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  Min,
  Max,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @ApiProperty({
    description: 'User ID placing the order',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'User ID is required' })
  @IsUUID('4', { message: 'Invalid user ID format' })
  userId: string;

  @ApiProperty({
    description: 'Array of order items',
    type: [CreateOrderItemDto],
    example: [
      {
        productId: '123e4567-e89b-12d3-a456-426614174001',
        quantity: 2,
        price: 299.99,
      },
    ],
  })
  @IsNotEmpty({ message: 'Order items are required' })
  @IsArray({ message: 'Order items must be an array' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  @ArrayMinSize(1, { message: 'Order must have at least 1 item' })
  @ArrayMaxSize(50, { message: 'Order cannot have more than 50 items' })
  items: CreateOrderItemDto[];

  @ApiProperty({
    description: 'Shipping address ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsNotEmpty({ message: 'Shipping address is required' })
  @IsUUID('4', { message: 'Invalid address ID format' })
  shippingAddressId: string;

  @ApiPropertyOptional({
    description: 'Billing address ID (defaults to shipping address)',
    example: '123e4567-e89b-12d3-a456-426614174003',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid billing address ID format' })
  billingAddressId?: string;

  @ApiPropertyOptional({
    description: 'Payment method ID',
    example: '123e4567-e89b-12d3-a456-426614174004',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid payment method ID format' })
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description: 'Coupon code for discount',
    example: 'SUMMER2025',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-_]+$/i, {
    message: 'Invalid coupon code format',
  })
  couponCode?: string;

  @ApiPropertyOptional({
    description: 'Special instructions or notes for the order',
    example: 'Please deliver before 5 PM',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Max(500, { message: 'Notes cannot exceed 500 characters' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Preferred shipping provider',
    enum: ['LALAMOVE', 'LBC', 'JNT', 'NINJAVAN', 'GRAB_EXPRESS'],
    example: 'LALAMOVE',
  })
  @IsOptional()
  @IsEnum(['LALAMOVE', 'LBC', 'JNT', 'NINJAVAN', 'GRAB_EXPRESS'], {
    message: 'Invalid shipping provider',
  })
  shippingProvider?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the order',
    example: { source: 'mobile-app', campaign: 'flash-sale' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
