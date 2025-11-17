import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsUUID,
  Min,
  Max,
  IsOptional,
} from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsNotEmpty({ message: 'Product ID is required' })
  @IsUUID('4', { message: 'Invalid product ID format' })
  productId: string;

  @ApiProperty({
    description: 'Quantity of the product',
    example: 2,
    minimum: 1,
    maximum: 999,
  })
  @IsNotEmpty({ message: 'Quantity is required' })
  @IsNumber({}, { message: 'Quantity must be a number' })
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(999, { message: 'Quantity cannot exceed 999' })
  quantity: number;

  @ApiProperty({
    description: 'Price per unit at time of order',
    example: 299.99,
    minimum: 0,
  })
  @IsNotEmpty({ message: 'Price is required' })
  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0, { message: 'Price cannot be negative' })
  price: number;

  @ApiPropertyOptional({
    description: 'Special instructions for this item',
    example: 'Extra packaging',
    maxLength: 200,
  })
  @IsOptional()
  notes?: string;
}
