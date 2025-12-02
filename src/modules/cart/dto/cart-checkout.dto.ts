import { IsString, IsNotEmpty, IsEnum, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ShippingAddressDto {
  @ApiProperty({
    description: 'Region name (e.g., NCR, CALABARZON, VISAYAS)',
    example: 'NCR',
  })
  @IsString()
  @IsNotEmpty()
  region: string;

  @ApiProperty({
    description: 'Province name',
    example: 'Metro Manila',
  })
  @IsString()
  @IsNotEmpty()
  province: string;

  @ApiProperty({
    description: 'City/Municipality',
    example: 'Quezon City',
  })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({
    description: 'Barangay',
    example: 'Barangay Commonwealth',
  })
  @IsString()
  @IsNotEmpty()
  barangay: string;

  @ApiProperty({
    description: 'Address line 1 (Street address)',
    example: '123 Commonwealth Avenue',
  })
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @ApiPropertyOptional({
    description: 'Address line 2 (Apartment, suite, unit, etc.)',
    example: 'Unit 404',
  })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiPropertyOptional({
    description: 'Postal code',
    example: '1121',
  })
  @IsString()
  @IsOptional()
  postalCode?: string;
}

export class EstimateShippingDto {
  @ApiProperty({
    description: 'Shipping address for estimation',
    type: ShippingAddressDto,
  })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  address: ShippingAddressDto;

  @ApiPropertyOptional({
    description: 'Preferred shipping method',
    enum: ['STANDARD', 'EXPRESS', 'SAME_DAY'],
    example: 'STANDARD',
  })
  @IsEnum(['STANDARD', 'EXPRESS', 'SAME_DAY'])
  @IsOptional()
  method?: 'STANDARD' | 'EXPRESS' | 'SAME_DAY';
}

export class CreateOrderFromCartDto {
  @ApiProperty({
    description: 'Payment method for the order',
    enum: ['GCASH', 'CREDIT_CARD', 'DEBIT_CARD', 'COD', 'BANK_TRANSFER', 'MAYA', 'PAYPAL'],
    example: 'GCASH',
  })
  @IsEnum(['GCASH', 'CREDIT_CARD', 'DEBIT_CARD', 'COD', 'BANK_TRANSFER', 'MAYA', 'PAYPAL'])
  @IsNotEmpty()
  paymentMethod: 'GCASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'COD' | 'BANK_TRANSFER' | 'MAYA' | 'PAYPAL';

  @ApiProperty({
    description: 'Shipping address for the order',
    type: ShippingAddressDto,
  })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @ApiPropertyOptional({
    description: 'Billing address (defaults to shipping address if not provided)',
    type: ShippingAddressDto,
  })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  @IsOptional()
  billingAddress?: ShippingAddressDto;

  @ApiPropertyOptional({
    description: 'Shipping method',
    enum: ['STANDARD', 'EXPRESS', 'SAME_DAY'],
    example: 'STANDARD',
  })
  @IsEnum(['STANDARD', 'EXPRESS', 'SAME_DAY'])
  @IsOptional()
  shippingMethod?: 'STANDARD' | 'EXPRESS' | 'SAME_DAY';

  @ApiPropertyOptional({
    description: 'Order notes/instructions',
    example: 'Please call before delivery',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
