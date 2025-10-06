import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsArray, IsDateString, IsEnum } from 'class-validator';
import { PaginationQueryDto } from '../../users/dto/pagination-query.dto';

export enum AnalyticsMetric {
  UPTIME = 'UPTIME',
  RESPONSE_TIME = 'RESPONSE_TIME',
  DATA_RATE = 'DATA_RATE',
  ERROR_RATE = 'ERROR_RATE',
  COMMAND_SUCCESS_RATE = 'COMMAND_SUCCESS_RATE',
}

export class DeviceAnalyticsQueryDto extends PaginationQueryDto {
  @ApiProperty({
    description: 'Start date for analytics period',
    example: '2025-10-01T00:00:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'End date for analytics period',
    example: '2025-10-31T23:59:59Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Metrics to include in analytics',
    enum: AnalyticsMetric,
    isArray: true,
    required: false,
  })
  @IsArray()
  @IsEnum(AnalyticsMetric, { each: true })
  @IsOptional()
  metrics?: AnalyticsMetric[];
}
