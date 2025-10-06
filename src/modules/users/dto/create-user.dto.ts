import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
} from 'class-validator';

enum UserRole {
  USER = 'USER',
  GROWER = 'GROWER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export class CreateUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'john_doe',
    description: 'Unique username',
  })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({
    example: 'SecureP@ssw0rd',
    description: 'User password (minimum 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: 'John',
    description: 'User first name',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    example: 'USER',
    enum: UserRole,
    description: 'User role',
    default: 'USER',
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
