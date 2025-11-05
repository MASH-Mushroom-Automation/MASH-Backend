import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';
import { IsNotFutureDate } from '../../../common/validators';

export class IngestSensorDataDto {
  @ApiProperty({
    description: 'Sensor reading value',
    example: 23.5,
  })
  @IsNumber()
  @IsNotEmpty()
  value!: number;

  @ApiProperty({
    description: 'Timestamp of the reading (ISO 8601, cannot be in the future)',
    example: '2025-10-04T08:30:00Z',
    required: false,
  })
  @IsDateString()
  @IsNotFutureDate({ gracePeriodMs: 300000 }) // 5 minutes grace period for clock skew
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
