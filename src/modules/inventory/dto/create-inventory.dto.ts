import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateInventoryDto {
  @IsString()
  @ApiProperty({
    example: 'Premium Oyster Mushroom',
    description: 'Inventory item name',
  })
  itemName: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'SKU-OYS-001',
    description: 'Stock Keeping Unit',
    required: false,
  })
  sku?: string; // stock-keeping unit, optional unique identifier

  @IsInt()
  @Min(0)
  @ApiProperty({ example: 100, description: 'Available quantity in stock' })
  quantity: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @ApiProperty({ example: 150.5, description: 'Unit price', required: false })
  price?: number;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'Warehouse A - Shelf 5',
    description: 'Warehouse location',
    required: false,
  })
  warehouseLocation?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'Local Farm Co.',
    description: 'Supplier name',
    required: false,
  })
  supplierName?: string;
}
