import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

enum UserRole {
  USER = 'USER',
  GROWER = 'GROWER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export class UserFilterQueryDto extends PaginationQueryDto {
  @ApiProperty({
    example: 'USER',
    enum: UserRole,
    description: 'Filter by user role',
    required: false,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({
    example: 'ACTIVE',
    enum: UserStatus,
    description: 'Filter by user status',
    required: false,
  })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiProperty({
    example: 'john',
    description: 'Search in email, username, first name, last name',
    required: false,
  })
  @IsString()
  @IsOptional()
  search?: string;
}
