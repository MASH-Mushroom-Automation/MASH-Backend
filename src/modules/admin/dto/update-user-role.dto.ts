import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export enum UserRole {
  USER = 'USER',
  GROWER = 'GROWER',
  BUYER = 'BUYER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'New role for the user',
    enum: UserRole,
    example: UserRole.GROWER,
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}
