import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDecimal } from 'class-validator';

export class AddPriorityFeeDto {
  @ApiProperty({
    example: '20.00',
    description: 'Priority fee amount in PHP (tip for faster driver matching)',
  })
  @IsString()
  priorityFee: string;
}
