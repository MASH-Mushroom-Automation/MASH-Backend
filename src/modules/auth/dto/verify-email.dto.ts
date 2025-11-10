import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

/**
 * DTO for email verification with token
 */
export class VerifyEmailDto {
  @ApiProperty({
    example: '3f4a8b9c1e2d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
    description: 'Verification token received in email (64 characters)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(64)
  token: string;
}

/**
 * DTO for email verification with code (alternative method)
 */
export class VerifyEmailWithCodeDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address to verify',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit verification code sent to email',
  })
  @IsString()
  @Length(6, 6)
  code: string;
}

/**
 * DTO for resending verification email
 */
export class ResendVerificationDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address to resend verification email to',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

