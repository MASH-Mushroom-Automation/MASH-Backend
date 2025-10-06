import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsNotEmpty,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class IngestSensorDataDto {
  @ApiProperty({
    description: 'Sensor reading value',
    example: 23.5,
  })
  @IsNumber()
  @IsNotEmpty()
  value: number;

  @ApiProperty({
    description: 'Timestamp of the reading (ISO 8601)',
    example: '2025-10-04T08:30:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  timestamp?: string;

  @ApiProperty({
    description: 'Additional metadata',
    example: { quality: 'good', batteryLevel: 85 },
    required: false,
  })
  @IsOptional()
  metadata?: any;
}
