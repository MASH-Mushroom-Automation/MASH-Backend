import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsObject, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum EntityType {
  PRODUCT = 'PRODUCT',
  ORDER = 'ORDER',
  USER = 'USER',
  CATEGORY = 'CATEGORY',
  SELLER = 'SELLER',
  BUYER = 'BUYER',
  TRANSACTION = 'TRANSACTION',
  INVENTORY = 'INVENTORY',
}

export enum FileFormat {
  CSV = 'CSV',
  EXCEL = 'EXCEL',
  JSON = 'JSON',
  XML = 'XML',
}

export enum JobPriority {
  URGENT = 'URGENT',
  NORMAL = 'NORMAL',
  LOW = 'LOW',
}

export class ImportOptionsDto {
  @ApiPropertyOptional({
    description: 'CSV delimiter character',
    example: ',',
    default: ',',
  })
  @IsString()
  @IsOptional()
  delimiter?: string;

  @ApiPropertyOptional({
    description: 'Number of header rows to skip',
    example: 1,
    default: 1,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  skipRows?: number;

  @ApiPropertyOptional({
    description: 'Whether to validate data before import',
    example: true,
    default: true,
  })
  @IsOptional()
  validateData?: boolean;

  @ApiPropertyOptional({
    description: 'Whether to skip invalid records',
    example: false,
    default: false,
  })
  @IsOptional()
  skipInvalid?: boolean;

  @ApiPropertyOptional({
    description: 'Batch size for database inserts',
    example: 1000,
    default: 1000,
  })
  @IsInt()
  @Min(100)
  @Max(10000)
  @IsOptional()
  batchSize?: number;
}

export class StartImportDto {
  @ApiProperty({
    description: 'Type of entity to import',
    enum: EntityType,
    example: EntityType.PRODUCT,
  })
  @IsEnum(EntityType)
  entityType: EntityType;

  @ApiProperty({
    description: 'File format',
    enum: FileFormat,
    example: FileFormat.CSV,
  })
  @IsEnum(FileFormat)
  fileFormat: FileFormat;

  @ApiPropertyOptional({
    description: 'Job priority',
    enum: JobPriority,
    default: JobPriority.NORMAL,
  })
  @IsEnum(JobPriority)
  @IsOptional()
  priority?: JobPriority;

  @ApiPropertyOptional({
    description: 'Import options',
    type: ImportOptionsDto,
  })
  @IsObject()
  @IsOptional()
  @Type(() => ImportOptionsDto)
  options?: ImportOptionsDto;
}

export class ExportOptionsDto {
  @ApiPropertyOptional({
    description: 'CSV delimiter character',
    example: ',',
    default: ',',
  })
  @IsString()
  @IsOptional()
  delimiter?: string;

  @ApiPropertyOptional({
    description: 'Whether to include header row',
    example: true,
    default: true,
  })
  @IsOptional()
  includeHeaders?: boolean;

  @ApiPropertyOptional({
    description: 'Date format for date fields',
    example: 'YYYY-MM-DD',
    default: 'YYYY-MM-DD',
  })
  @IsString()
  @IsOptional()
  dateFormat?: string;

  @ApiPropertyOptional({
    description: 'Excel sheet name',
    example: 'Sheet1',
    default: 'Sheet1',
  })
  @IsString()
  @IsOptional()
  sheetName?: string;
}

export class StartExportDto {
  @ApiProperty({
    description: 'Type of entity to export',
    enum: EntityType,
    example: EntityType.PRODUCT,
  })
  @IsEnum(EntityType)
  entityType: EntityType;

  @ApiProperty({
    description: 'File format',
    enum: FileFormat,
    example: FileFormat.CSV,
  })
  @IsEnum(FileFormat)
  fileFormat: FileFormat;

  @ApiPropertyOptional({
    description: 'Job priority',
    enum: JobPriority,
    default: JobPriority.NORMAL,
  })
  @IsEnum(JobPriority)
  @IsOptional()
  priority?: JobPriority;

  @ApiPropertyOptional({
    description: 'Filters to apply (JSON object)',
    example: { status: 'ACTIVE', category: 'Electronics' },
  })
  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Export options',
    type: ExportOptionsDto,
  })
  @IsObject()
  @IsOptional()
  @Type(() => ExportOptionsDto)
  options?: ExportOptionsDto;
}

export class GetJobsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by entity type',
    enum: EntityType,
  })
  @IsEnum(EntityType)
  @IsOptional()
  entityType?: EntityType;

  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'COMPLETED',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    default: 20,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
