import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsObject,
  ValidateNested,
  IsArray,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReportType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportFilters {
  @ApiProperty({
    description: 'Date range for the report',
    example: { start: '2025-01-01', end: '2025-12-31' },
  })
  @IsObject()
  dateRange: { start: Date; end: Date };

  @ApiPropertyOptional({
    description: 'Filter by categories',
    example: ['Electronics', 'Clothing'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Filter by product IDs',
    example: ['prod-123', 'prod-456'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  products?: string[];

  @ApiPropertyOptional({
    description: 'Filter by user IDs',
    example: ['user-123', 'user-456'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  users?: string[];

  @ApiPropertyOptional({
    description: 'Filter by status',
    example: ['COMPLETED', 'PENDING'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  status?: string[];
}

export class ReportConfiguration {
  @ApiProperty({
    description: 'Report filters',
    type: ReportFilters,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => ReportFilters)
  filters: ReportFilters;

  @ApiPropertyOptional({
    description: 'Group results by fields',
    example: ['category', 'date'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupBy?: string[];

  @ApiPropertyOptional({
    description: 'Sort configuration',
    example: { field: 'revenue', order: 'desc' },
  })
  @IsOptional()
  @IsObject()
  sortBy?: { field: string; order: 'asc' | 'desc' };

  @ApiPropertyOptional({
    description: 'Limit number of results',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiProperty({
    description: 'Metrics to include in report',
    example: ['revenue', 'orders', 'quantity'],
  })
  @IsArray()
  @IsString({ each: true })
  metrics: string[];
}

export class ReportSchedule {
  @ApiProperty({
    description: 'Report frequency',
    example: 'DAILY',
    enum: ['DAILY', 'WEEKLY', 'MONTHLY'],
  })
  @IsEnum(['DAILY', 'WEEKLY', 'MONTHLY'])
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';

  @ApiProperty({
    description: 'Execution time (24-hour format)',
    example: '09:00',
  })
  @IsString()
  time: string;

  @ApiProperty({
    description: 'Timezone',
    example: 'Asia/Manila',
  })
  @IsString()
  timezone: string;

  @ApiPropertyOptional({
    description: 'Email recipients for scheduled reports',
    example: ['admin@example.com', 'manager@example.com'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[];
}

export class CreateReportDto {
  @ApiProperty({
    description: 'Report name',
    example: 'Monthly Sales Report',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Report description',
    example: 'Comprehensive monthly sales analysis',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Report type',
    enum: ReportType,
    example: 'SALES',
  })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiProperty({
    description: 'Report configuration',
    type: ReportConfiguration,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => ReportConfiguration)
  configuration: ReportConfiguration;

  @ApiPropertyOptional({
    description: 'Report schedule (optional)',
    type: ReportSchedule,
  })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportSchedule)
  schedule?: ReportSchedule;
}
