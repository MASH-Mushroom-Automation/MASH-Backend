import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Sort DTO
 *
 * Common DTO for sorting query parameters
 *
 * Usage:
 * @Get()
 * findAll(@Query() sortDto: SortDto) {}
 */
export class SortDto {
  @ApiPropertyOptional({
    description: 'Field to sort by',
    default: 'createdAt',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order (asc or desc)',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  /**
   * Convert to Prisma orderBy clause
   */
  toOrderBy(): any {
    return {
      [this.sortBy ?? 'createdAt']: this.sortOrder ?? 'desc',
    };
  }
}
