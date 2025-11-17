import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsArray, ValidateNested, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import {
  LALAMOVE_SERVICE_TYPES,
  LALAMOVE_ITEM_WEIGHTS,
  LALAMOVE_ITEM_CATEGORIES,
  LALAMOVE_HANDLING_INSTRUCTIONS,
} from '../constants/lalamove.constants';

export class CoordinatesDto {
  @ApiProperty({ example: '14.8140', description: 'Latitude' })
  @IsString()
  lat: string;

  @ApiProperty({ example: '121.0452', description: 'Longitude' })
  @IsString()
  lng: string;
}

export class StopDto {
  @ApiProperty({ type: CoordinatesDto })
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates: CoordinatesDto;

  @ApiProperty({ example: 'San Jose Del Monte, Bulacan' })
  @IsString()
  address: string;
}

export class ItemDto {
  @ApiProperty({ example: '1', description: 'Number of items' })
  @IsString()
  quantity: string;

  @ApiProperty({
    enum: Object.values(LALAMOVE_ITEM_WEIGHTS),
    example: 'LESS_THAN_3_KG',
    description: 'Item weight category',
  })
  @IsEnum(LALAMOVE_ITEM_WEIGHTS)
  weight: string;

  @ApiProperty({
    example: ['FOOD_DELIVERY'],
    description: 'Item categories',
    isArray: true,
    enum: Object.values(LALAMOVE_ITEM_CATEGORIES),
  })
  @IsArray()
  @IsString({ each: true })
  categories: string[];

  @ApiProperty({
    example: ['KEEP_UPRIGHT'],
    description: 'Handling instructions',
    isArray: true,
    enum: Object.values(LALAMOVE_HANDLING_INSTRUCTIONS),
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  handlingInstructions?: string[];
}

export class CreateQuotationDto {
  @ApiProperty({
    enum: Object.values(LALAMOVE_SERVICE_TYPES),
    example: 'MOTORCYCLE',
    description: 'Vehicle service type',
  })
  @IsEnum(LALAMOVE_SERVICE_TYPES)
  serviceType: string;

  @ApiProperty({
    type: [StopDto],
    description: 'Pickup and delivery stops (min 2, max 10)',
    minItems: 2,
    maxItems: 10,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StopDto)
  stops: StopDto[];

  @ApiProperty({ type: ItemDto, description: 'Item details' })
  @ValidateNested()
  @Type(() => ItemDto)
  item: ItemDto;

  @ApiProperty({
    example: 'ORDER-12345',
    description: 'Optional MASH order ID to link quotation',
    required: false,
  })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({
    example: '2025-11-18T12:00:00.000Z',
    description: 'Schedule time for delivery (ISO 8601 format, at least 2 hours from now)',
    required: false,
  })
  @IsOptional()
  @IsString()
  scheduleAt?: string;
}
