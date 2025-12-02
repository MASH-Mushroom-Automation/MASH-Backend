import { IsInt, Min, Max, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCartItemDto {
  @ApiProperty({
    description: 'New quantity for the cart item',
    example: 3,
    minimum: 1,
    maximum: 1000,
  })
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Update custom options for the product',
    example: { giftMessage: 'Updated message', specialInstructions: 'New instructions' },
  })
  @IsOptional()
  @IsObject()
  customization?: Record<string, any>;
}
