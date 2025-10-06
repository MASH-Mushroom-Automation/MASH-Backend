import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, Min } from 'class-validator';

export class UpdateStockDto {
  @ApiProperty({ example: 50, description: 'New stock quantity' })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  quantity: number;
}
