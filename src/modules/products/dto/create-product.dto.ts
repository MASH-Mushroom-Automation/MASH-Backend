import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export class CreateProductDto {
  @ApiProperty({
    example: 'Premium Oyster Mushroom',
    description: 'Product name',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({
    example: 'Fresh premium quality oyster mushrooms',
    description: 'Product description',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  @ApiProperty({ example: 150.5, description: 'Product price' })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  price: number;

  @ApiProperty({
    example: 100,
    description: 'Available stock quantity',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  stock?: number;

  @ApiProperty({
    example: 'oyster-mushroom',
    description: 'Product URL slug',
    required: false,
  })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({
    example: 'SKU-OYS-001',
    description: 'Stock Keeping Unit',
    required: false,
  })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({
    example: 'kg',
    description: 'Product unit of measure (kg, g, piece, pack)',
    required: false,
  })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({
    example: 1.0,
    description: 'Quantity per unit',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  weight?: number;

  @ApiProperty({
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    description: 'Product images array',
    required: false,
    type: [String],
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({
    example: 'category-id-123',
    description: 'Product category ID',
    required: false,
  })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({
    enum: ProductStatus,
    example: ProductStatus.ACTIVE,
    description: 'Product status',
    required: false,
  })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @ApiProperty({
    example: true,
    description: 'Featured product flag',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiProperty({
    example: { organic: true, localFarm: true, freshness: '24 hours' },
    description: 'Additional product metadata',
    required: false,
  })
  @IsOptional()
  metadata?: any;
}
