import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Offset-based Pagination DTO (Task 1.4.1)
 *
 * Use for simple pagination where users jump between pages
 * Good for: Product listings, order history, user management
 *
 * Usage:
 * @Get()
 * findAll(@Query() paginationDto: PaginationDto) {}
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Page number (starts from 1)',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Sort by field',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  /**
   * Calculate skip value for database queries
   */
  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 10);
  }

  /**
   * Calculate take value for database queries
   */
  get take(): number {
    return this.limit ?? 10;
  }
}

/**
 * Cursor-based Pagination DTO (Task 1.4.2)
 *
 * Use for infinite scroll or when order is critical
 * More efficient for large datasets - no need to count total items
 * Good for: Sensor data streams, chat messages, activity feeds
 *
 * Usage:
 * @Get()
 * findAll(@Query() paginationDto: CursorPaginationDto) {}
 */
export class CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Cursor for pagination (ID of last item from previous page)',
    example: 'clxyz1234567890',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of items to fetch',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort by field',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

/**
 * Paginated Response DTO (Task 1.4.1)
 *
 * Standard paginated response wrapper with metadata
 */
export class PaginatedResponseDto<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    const totalPages = Math.ceil(total / limit);

    this.meta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}

/**
 * Cursor-based Paginated Response DTO (Task 1.4.2)
 *
 * Cursor-based paginated response wrapper
 * Does not include total count for better performance
 */
export class CursorPaginatedResponseDto<T> {
  data: T[];
  meta: {
    nextCursor: string | null;
    hasMore: boolean;
    count: number;
  };

  constructor(data: T[], nextCursor: string | null, hasMore: boolean) {
    this.data = data;
    this.meta = {
      nextCursor,
      hasMore,
      count: data.length,
    };
  }
}
