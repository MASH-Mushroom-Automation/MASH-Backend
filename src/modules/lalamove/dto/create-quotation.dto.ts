import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Coordinates DTO
 */
export class CoordinatesDto {
  @ApiProperty({ example: '14.8140', description: 'Latitude' })
  @IsString()
  lat: string;

  @ApiProperty({ example: '121.0452', description: 'Longitude' })
  @IsString()
  lng: string;
}

/**
 * Item DTO for quotation
 */
export class ItemDto {
  @ApiProperty({ example: '5', description: 'Item quantity' })
  @IsString()
  quantity: string;

  @ApiProperty({ example: '1.5', description: 'Weight in kg' })
  @IsString()
  weight: string;

  @ApiProperty({ 
    example: ['L', 'W', 'H'], 
    description: 'Item categories (e.g., FOOD, DOCUMENTS, PARCELS)',
    required: false 
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];

  @ApiProperty({ 
    example: ['FRAGILE'], 
    description: 'Special handling instructions',
    required: false 
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  handlingInstructions?: string[];
}

/**
 * Stop DTO for quotation
 */
export class StopDto {
  @ApiProperty({ 
    type: CoordinatesDto,
    description: 'Stop coordinates (lat/lng)' 
  })
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates: CoordinatesDto;

  @ApiProperty({ 
    example: 'San Jose Del Monte, Bulacan', 
    description: 'Full address of the stop' 
  })
  @IsString()
  address: string;
}

/**
 * Create Quotation DTO
 */
export class CreateQuotationDto {
  @ApiProperty({ 
    example: 'MOTORCYCLE', 
    description: 'Service type (MOTORCYCLE, SEDAN, MPV, VAN, PICKUP, TRUCK_330, TRUCK_550)',
    enum: ['MOTORCYCLE', 'SEDAN', 'MPV', 'VAN', 'PICKUP', 'TRUCK_330', 'TRUCK_550']
  })
  @IsString()
  @IsEnum(['MOTORCYCLE', 'SEDAN', 'MPV', 'VAN', 'PICKUP', 'TRUCK_330', 'TRUCK_550'])
  serviceType: string;

  @ApiProperty({ 
    type: [StopDto],
    description: 'List of stops (minimum 2: pickup and dropoff)',
    minItems: 2
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StopDto)
  stops: StopDto[];

  @ApiProperty({ 
    example: 'en_PH', 
    description: 'Language preference',
    default: 'en_PH',
    required: false
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({ 
    example: false, 
    description: 'Whether this is a scheduled delivery',
    default: false,
    required: false
  })
  @IsBoolean()
  @IsOptional()
  isScheduled?: boolean;

  @ApiProperty({ 
    example: '2025-11-18T14:00:00.000Z', 
    description: 'Scheduled pickup time (required if isScheduled is true)',
    required: false
  })
  @IsDateString()
  @IsOptional()
  scheduleAt?: string;

  @ApiProperty({ 
    type: [ItemDto],
    description: 'Items to be delivered',
    required: false
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  @IsOptional()
  items?: ItemDto[];

  @ApiProperty({ 
    example: 'Please handle with care', 
    description: 'Special instructions for the driver',
    required: false
  })
  @IsString()
  @IsOptional()
  specialRequests?: string;
}
