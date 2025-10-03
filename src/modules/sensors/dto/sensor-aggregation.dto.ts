import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString, IsArray } from 'class-validator';

export enum AggregationType {
  AVG = 'AVG',
  MIN = 'MIN',
  MAX = 'MAX',
  SUM = 'SUM',
  COUNT = 'COUNT',
}

export class SensorAggregationDto {
  @ApiProperty({
    description: 'Aggregation types to calculate',
    example: ['AVG', 'MIN', 'MAX'],
    enum: AggregationType,
    isArray: true,
  })
  @IsArray()
  @IsEnum(AggregationType, { each: true })
  aggregations: AggregationType[];

  @ApiProperty({
    description: 'Start date for aggregation (ISO 8601)',
    example: '2025-10-01T00:00:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'End date for aggregation (ISO 8601)',
    example: '2025-10-04T23:59:59Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Group by interval (hourly, daily, weekly, monthly)',
    example: 'daily',
    enum: ['hourly', 'daily', 'weekly', 'monthly'],
    required: false,
  })
  @IsEnum(['hourly', 'daily', 'weekly', 'monthly'])
  @IsOptional()
  groupBy?: string;
}
