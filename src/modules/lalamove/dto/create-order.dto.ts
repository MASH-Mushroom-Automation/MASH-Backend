import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ValidateNested, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class SenderDto {
  @ApiProperty({ description: 'Stop ID from quotation', example: 'stop_abc123' })
  @IsString()
  stopId: string;

  @ApiProperty({ example: 'J5 Pharmacy', description: 'Sender name' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+639123456789', description: 'Sender phone (E.164 format)' })
  @IsString()
  phone: string;
}

export class RecipientDto {
  @ApiProperty({ description: 'Stop ID from quotation', example: 'stop_def456' })
  @IsString()
  stopId: string;

  @ApiProperty({ example: 'John Doe', description: 'Recipient name' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+639987654321', description: 'Recipient phone (E.164 format)' })
  @IsString()
  phone: string;

  @ApiProperty({
    example: 'Order #12345\nMedicines (3 items)\nHandle with care\nCall upon arrival',
    description: 'Delivery remarks/instructions',
    required: false,
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Lalamove quotation ID', example: 'QUO_123456' })
  @IsString()
  quotationId: string;

  @ApiProperty({ description: 'MASH order ID to link', example: 'cm3abc123xyz' })
  @IsString()
  orderId: string;

  @ApiProperty({ type: SenderDto, description: 'Sender/pickup details' })
  @ValidateNested()
  @Type(() => SenderDto)
  sender: SenderDto;

  @ApiProperty({
    type: [RecipientDto],
    description: 'Recipients/delivery stops',
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients: RecipientDto[];

  @ApiProperty({
    example: true,
    description: 'Enable Proof of Delivery (POD)',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isPODEnabled?: boolean;

  @ApiProperty({
    example: { orderId: '12345', branch: 'SJDM', itemCount: '3' },
    description: 'Custom metadata for tracking',
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
