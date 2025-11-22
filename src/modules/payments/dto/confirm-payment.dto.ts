import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

/**
 * Confirm Payment DTO
 */
export class ConfirmPaymentDto {
  @ApiProperty({
    description: 'Payment intent ID to confirm',
    example: 'pi_1234567890',
  })
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;

  @ApiPropertyOptional({
    description: 'Payment method ID (for card payments)',
    example: 'pm_1234567890',
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description: 'Return URL after payment',
    example: 'https://mash.com/orders/success',
  })
  @IsOptional()
  @IsString()
  returnUrl?: string;
}
