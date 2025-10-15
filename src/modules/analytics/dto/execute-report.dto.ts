import { IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ReportFilters } from './create-report.dto';

export class ExecuteReportDto {
  @ApiPropertyOptional({
    description: 'Override report filters for this execution',
    type: ReportFilters,
  })
  @IsOptional()
  @IsObject()
  @Type(() => ReportFilters)
  overrideFilters?: Partial<ReportFilters>;

  @ApiPropertyOptional({
    description: 'Export format for report results',
    enum: ['json', 'csv', 'excel', 'pdf'],
    example: 'json',
  })
  @IsOptional()
  @IsEnum(['json', 'csv', 'excel', 'pdf'])
  exportFormat?: 'json' | 'csv' | 'excel' | 'pdf';
}
