import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({
    description: 'User active status',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
