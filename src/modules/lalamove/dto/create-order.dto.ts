import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, IsBoolean, IsPhoneNumber } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Sender/Recipient contact DTO
 */
export class ContactDto {
  @ApiProperty({ example: 'Juan Dela Cruz', description: 'Contact person name' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+639123456789', description: 'Contact phone number' })
  @IsPhoneNumber('PH')
  phone: string;
}

/**
 * Stop details for order creation
 */
export class OrderStopDto {
  @ApiProperty({ example: 'stop_abc123', description: 'Stop ID from quotation' })
  @IsString()
  stopId: string;

  @ApiProperty({ 
    type: ContactDto,
    description: 'Contact person at this stop' 
  })
  @ValidateNested()
  @Type(() => ContactDto)
  contact: ContactDto;

  @ApiProperty({ 
    example: 'Unit 123, Floor 4', 
    description: 'Additional address details',
    required: false
  })
  @IsString()
  @IsOptional()
  remarks?: string;
}

/**
 * Sender information DTO
 */
export class SenderDto extends ContactDto {
  @ApiProperty({ 
    example: 'stop_pickup_123', 
    description: 'Pickup stop ID from quotation' 
  })
  @IsString()
  stopId: string;

  @ApiProperty({ 
    example: 'Leave at reception', 
    description: 'Pickup instructions',
    required: false
  })
  @IsString()
  @IsOptional()
  remarks?: string;
}

/**
 * Recipient information DTO
 */
export class RecipientDto extends ContactDto {
  @ApiProperty({ 
    example: 'stop_dropoff_456', 
    description: 'Dropoff stop ID from quotation' 
  })
  @IsString()
  stopId: string;

  @ApiProperty({ 
    example: 'Call upon arrival', 
    description: 'Delivery instructions',
    required: false
  })
  @IsString()
  @IsOptional()
  remarks?: string;
}

/**
 * Create Order DTO
 */
export class CreateOrderDto {
  @ApiProperty({ 
    example: 'QUO_123456', 
    description: 'Quotation ID to create order from' 
  })
  @IsString()
  quotationId: string;

  @ApiProperty({ 
    type: SenderDto,
    description: 'Sender/pickup contact information' 
  })
  @ValidateNested()
  @Type(() => SenderDto)
  sender: SenderDto;

  @ApiProperty({ 
    type: [RecipientDto],
    description: 'Recipients/dropoff contact information (one per stop after pickup)' 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients: RecipientDto[];

  @ApiProperty({ 
    example: false, 
    description: 'Whether Proof of Delivery (POD) is required',
    default: false,
    required: false
  })
  @IsBoolean()
  @IsOptional()
  isPODEnabled?: boolean;

  @ApiProperty({ 
    example: 'ORD-12345', 
    description: 'Your internal order reference',
    required: false
  })
  @IsString()
  @IsOptional()
  orderReference?: string;

  @ApiProperty({ 
    example: 'Fragile items, please handle with care', 
    description: 'Special delivery instructions',
    required: false
  })
  @IsString()
  @IsOptional()
  specialRequests?: string;
}
