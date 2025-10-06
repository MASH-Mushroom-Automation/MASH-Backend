import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class SensorDataQueryDto {
  @ApiProperty({
    description: 'Start date for data retrieval (ISO 8601)',
    example: '2025-10-01T00:00:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'End date for data retrieval (ISO 8601)',
    example: '2025-10-04T23:59:59Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Number of data points to return',
    example: 100,
    minimum: 1,
    maximum: 10000,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  limit?: number;

  @ApiProperty({
    description: 'Aggregation interval in minutes',
    example: 60,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  interval?: number;
}
