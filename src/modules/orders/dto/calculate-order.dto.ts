import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsUUID,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CalculateOrderDto {
  @ApiProperty({
    description: 'Array of order items for calculation',
    type: [CreateOrderItemDto],
  })
  @IsNotEmpty({ message: 'Order items are required' })
  @IsArray({ message: 'Items must be an array' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({
    description: 'Shipping address ID for shipping cost calculation',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsNotEmpty({ message: 'Shipping address is required' })
  @IsUUID('4', { message: 'Invalid address ID format' })
  shippingAddressId: string;

  @ApiPropertyOptional({
    description: 'Coupon code for discount calculation',
    example: 'SUMMER2025',
  })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({
    description: 'Preferred shipping provider',
    example: 'LALAMOVE',
  })
  @IsOptional()
  @IsString()
  shippingProvider?: string;
}

export class CalculateOrderResponseDto {
  @ApiProperty({ example: 599.98 })
  subtotal: number;

  @ApiProperty({ example: 150.0 })
  shippingCost: number;

  @ApiProperty({ example: 71.88, description: '12% VAT' })
  taxAmount: number;

  @ApiProperty({ example: 50.0 })
  discountAmount: number;

  @ApiProperty({ example: 771.86 })
  totalAmount: number;

  @ApiProperty({ example: 'SUMMER2025' })
  appliedCoupon?: string;

  @ApiProperty({ example: 'LALAMOVE' })
  shippingProvider?: string;

  @ApiProperty({
    example: {
      subtotalBreakdown: { items: 599.98 },
      taxBreakdown: { vat: 71.88 },
      discountBreakdown: { coupon: 50.0 },
    },
  })
  breakdown: {
    subtotalBreakdown: Record<string, number>;
    taxBreakdown: Record<string, number>;
    discountBreakdown: Record<string, number>;
  };
}
