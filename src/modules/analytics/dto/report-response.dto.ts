import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportType, ExecutionStatus } from '@prisma/client';
import { ReportConfiguration, ReportSchedule } from './create-report.dto';

export class ReportResponseDto {
  @ApiProperty({ description: 'Report ID' })
  id: string;

  @ApiProperty({ description: 'Report name' })
  name: string;

  @ApiPropertyOptional({ description: 'Report description' })
  description?: string;

  @ApiProperty({ description: 'Report type', enum: ReportType })
  type: ReportType;

  @ApiProperty({ description: 'Report configuration' })
  configuration: ReportConfiguration;

  @ApiPropertyOptional({ description: 'Report schedule' })
  schedule?: ReportSchedule;

  @ApiProperty({ description: 'Is report active' })
  isActive: boolean;

  @ApiProperty({ description: 'User who created the report' })
  createdBy: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Total execution count' })
  executionCount: number;
}

export class ReportExecutionResponseDto {
  @ApiProperty({ description: 'Execution ID' })
  id: string;

  @ApiProperty({ description: 'Report ID' })
  reportId: string;

  @ApiProperty({ description: 'Execution status', enum: ExecutionStatus })
  status: ExecutionStatus;

  @ApiProperty({ description: 'Execution start time' })
  startedAt: Date;

  @ApiPropertyOptional({ description: 'Execution completion time' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Execution duration in milliseconds' })
  duration?: number;

  @ApiPropertyOptional({ description: 'Report result data' })
  resultData?: any;

  @ApiPropertyOptional({ description: 'URL to download report results' })
  resultUrl?: string;

  @ApiPropertyOptional({ description: 'Error message if execution failed' })
  errorMessage?: string;

  @ApiProperty({ description: 'User who executed the report' })
  executedBy: string;
}
