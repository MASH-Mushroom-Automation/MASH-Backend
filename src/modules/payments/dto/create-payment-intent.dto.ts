import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsEmail,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, Currency } from '../enums/payment.enum';

/**
 * Customer Information DTO
 */
export class CustomerInfoDto {
  @ApiProperty({ example: 'Juan Dela Cruz' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+639171234567' })
  @IsOptional()
  @IsString()
  phone?: string;
}

/**
 * Billing Address DTO
 */
export class BillingAddressDto {
  @ApiProperty({ example: '123 Main Street' })
  @IsString()
  @IsNotEmpty()
  line1: string;

  @ApiPropertyOptional({ example: 'Unit 5B' })
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiProperty({ example: 'Quezon City' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Metro Manila' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ example: '1100' })
  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @ApiProperty({ example: 'PH' })
  @IsString()
  @IsNotEmpty()
  country: string;
}

/**
 * Billing Details DTO
 */
export class BillingDetailsDto {
  @ApiProperty({ example: 'Juan Dela Cruz' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+639171234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ type: BillingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillingAddressDto)
  address?: BillingAddressDto;
}

/**
 * Create Payment Intent DTO
 */
export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'Order ID to process payment for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'Payment amount in centavos (PHP)',
    example: 150000,
    minimum: 100,
  })
  @IsNumber()
  @Min(100, { message: 'Amount must be at least ₱1.00 (100 centavos)' })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    enum: Currency,
    example: Currency.PHP,
  })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.GCASH,
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Payment description',
    example: 'Order #ORD-20251118-00001',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Customer information',
    type: CustomerInfoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerInfoDto)
  customerInfo?: CustomerInfoDto;

  @ApiPropertyOptional({
    description: 'Billing details',
    type: BillingDetailsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillingDetailsDto)
  billingDetails?: BillingDetailsDto;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { source: 'mobile_app', campaign: 'summer_sale' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
