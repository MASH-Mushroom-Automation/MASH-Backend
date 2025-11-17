import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, Max } from 'class-validator';

/**
 * Add Priority Fee DTO
 * Priority fee helps get a driver assigned faster
 */
export class AddPriorityFeeDto {
  @ApiProperty({ 
    example: 50, 
    description: 'Priority fee amount in PHP (20-500)',
    minimum: 20,
    maximum: 500
  })
  @IsNumber()
  @Min(20)
  @Max(500)
  amount: number;
}
