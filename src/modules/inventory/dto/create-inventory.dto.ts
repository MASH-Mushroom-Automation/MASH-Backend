import { IsString, IsInt, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateInventoryDto {
  @IsString()
  itemName: string;

  @IsString()
  @IsOptional()
  sku?: string; // stock-keeping unit, optional unique identifier

  @IsInt()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  warehouseLocation?: string;

  @IsString()
  @IsOptional()
  supplierName?: string;
}
