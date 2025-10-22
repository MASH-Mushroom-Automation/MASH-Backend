import { IsOptional, IsString, IsNumber, IsArray, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchProductsDto {
  @ApiPropertyOptional({ 
    description: 'Search query string',
    example: 'shiitake mushroom'
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ 
    description: 'Page number',
    minimum: 1,
    default: 1,
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ 
    description: 'Results per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // Filtering
  @ApiPropertyOptional({ 
    description: 'Minimum price',
    example: 10.00
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @ApiPropertyOptional({ 
    description: 'Maximum price',
    example: 100.00
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional({ 
    description: 'Filter by categories',
    type: [String],
    example: ['Fresh Mushrooms', 'Dried Mushrooms']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ 
    description: 'Minimum rating',
    minimum: 0,
    maximum: 5,
    example: 4.0
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ 
    description: 'Only show products in stock',
    example: true
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ 
    description: 'Filter by tags',
    type: [String],
    example: ['organic', 'premium']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // Sorting
  @ApiPropertyOptional({ 
    description: 'Sort field',
    enum: ['relevance', 'price', 'rating', 'createdAt', 'name'],
    default: 'relevance',
    example: 'price'
  })
  @IsOptional()
  @IsString()
  sortBy?: 'relevance' | 'price' | 'rating' | 'createdAt' | 'name' = 'relevance';

  @ApiPropertyOptional({ 
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'asc'
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  // Facets
  @ApiPropertyOptional({ 
    description: 'Include facets in response',
    default: false,
    example: true
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeFacets?: boolean = false;
}
