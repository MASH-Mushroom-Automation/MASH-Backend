import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    example: 'John',
    description: 'User first name',
    required: false,
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    example: 'Software developer passionate about mushroom farming',
    description: 'User bio',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'User phone number',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;
}
