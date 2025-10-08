import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Filter DTO
 *
 * Common DTO for filtering query parameters
 *
 * Usage:
 * @Get()
 * findAll(@Query() filterDto: FilterDto) {}
 */
export class FilterDto {
  @ApiPropertyOptional({
    description: 'Search term for text search',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by start date (ISO 8601)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by end date (ISO 8601)',
    example: '2025-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'active',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by category',
    example: 'electronics',
  })
  @IsOptional()
  @IsString()
  category?: string;

  /**
   * Convert to Prisma where clause
   */
  toWhereClause(): any {
    const where: any = {};

    if (this.search) {
      where.OR = [
        { name: { contains: this.search, mode: 'insensitive' } },
        { description: { contains: this.search, mode: 'insensitive' } },
      ];
    }

    if (this.startDate || this.endDate) {
      where.createdAt = {};
      if (this.startDate) {
        where.createdAt.gte = new Date(this.startDate);
      }
      if (this.endDate) {
        where.createdAt.lte = new Date(this.endDate);
      }
    }

    if (this.status) {
      where.status = this.status;
    }

    if (this.category) {
      where.category = this.category;
    }

    return where;
  }
}
