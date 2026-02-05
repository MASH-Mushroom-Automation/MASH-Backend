import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AssignDeviceDto {
  @ApiProperty({
    description: 'User ID to assign the device to',
    example: 'cmjbr0wmj0004nn7wwdjqc0yx',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
