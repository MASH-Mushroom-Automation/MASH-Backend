import { IsEnum, IsOptional, IsString, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
  PDF = 'pdf',
  JSON = 'json',
}

export class ExportConfigDto {
  @ApiProperty({
    enum: ExportFormat,
    description: 'Export format',
    example: ExportFormat.CSV,
  })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiPropertyOptional({
    description: 'Custom filename (without extension)',
    example: 'sales-report-2025-q1',
  })
  @IsString()
  @IsOptional()
  filename?: string;

  @ApiPropertyOptional({
    description: 'Report type to export',
    example: 'SALES',
  })
  @IsString()
  @IsOptional()
  reportType?: string;

  @ApiPropertyOptional({
    description: 'Date range filter',
    example: { startDate: '2025-01-01', endDate: '2025-12-31' },
  })
  @IsObject()
  @IsOptional()
  filters?: {
    startDate?: Date;
    endDate?: Date;
    [key: string]: any;
  };

  @ApiPropertyOptional({
    description: 'Include charts in PDF export',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  includeCharts?: boolean;

  @ApiPropertyOptional({
    description: 'Column configuration for export',
    example: ['id', 'name', 'total', 'createdAt'],
  })
  @IsOptional()
  columns?: string[];

  @ApiPropertyOptional({
    description: 'Upload to S3 storage',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  uploadToS3?: boolean;
}

export class ExportResponseDto {
  @ApiProperty({
    description: 'Export job ID',
    example: 'exp_abc123',
  })
  id: string;

  @ApiProperty({
    description: 'Export status',
    example: 'COMPLETED',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
  })
  status: string;

  @ApiProperty({
    description: 'File download URL',
    example: '/exports/sales-report-2025-q1.csv',
  })
  fileUrl: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 102400,
  })
  fileSize: number;

  @ApiProperty({
    description: 'Number of rows exported',
    example: 1500,
  })
  rowCount: number;

  @ApiProperty({
    description: 'Export creation timestamp',
    example: '2025-10-14T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Export completion timestamp',
    example: '2025-10-14T10:31:45Z',
  })
  completedAt?: Date;
}
