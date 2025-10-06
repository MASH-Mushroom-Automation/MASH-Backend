import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, Min } from 'class-validator';

export class UpdatePriceDto {
  @ApiProperty({ example: 199.99, description: 'New product price' })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  price: number;
}
