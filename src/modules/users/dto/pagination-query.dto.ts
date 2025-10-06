import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, IsEnum, IsOptional } from 'class-validator';

enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class PaginationQueryDto {
  @ApiProperty({
    example: 1,
    description: 'Page number',
    default: 1,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    example: 10,
    description: 'Items per page',
    default: 10,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({
    example: 'createdAt',
    description: 'Field to sort by',
    required: false,
  })
  @IsOptional()
  sortBy?: string;

  @ApiProperty({
    example: 'desc',
    enum: SortOrder,
    description: 'Sort order',
    required: false,
  })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder;
}
