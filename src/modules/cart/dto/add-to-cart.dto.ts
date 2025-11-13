import { IsString, IsInt, Min, Max, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({
    description: 'Product ID to add to cart',
    example: 'clxxx123456789',
  })
  @IsString()
  productId: string;

  @ApiProperty({
    description: 'Quantity of the product',
    example: 2,
    minimum: 1,
    maximum: 1000,
  })
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Custom options for the product (e.g., gift message, special instructions)',
    example: { giftMessage: 'Happy Birthday!', specialInstructions: 'Handle with care' },
  })
  @IsOptional()
  @IsObject()
  customization?: Record<string, any>;
}
