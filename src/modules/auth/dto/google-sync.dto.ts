import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsUrl } from 'class-validator';

export class GoogleSyncDto {
  @ApiProperty({
    example: 'google_1234567890',
    description: 'Google user ID (from Firebase UID)',
  })
  @IsString()
  googleId: string;

  @ApiProperty({
    example: 'john.doe@gmail.com',
    description: 'User email from Google account',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'John',
    description: 'First name from Google profile',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Last name from Google profile',
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    example: 'https://lh3.googleusercontent.com/a/photo.jpg',
    description: 'Google profile photo URL',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  photoURL?: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'Optional username (auto-generated if not provided)',
    required: false,
  })
  @IsOptional()
  @IsString()
  username?: string;
}
