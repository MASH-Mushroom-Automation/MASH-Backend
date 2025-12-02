import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, MinLength, Matches } from 'class-validator';

/**
 * DTO for email verification with 64-character token (web/email links)
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
 * DTO for email verification with 6-digit code (mobile/app)
 */
export class VerifyEmailCodeDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address to verify',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit verification code sent to email',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Verification code must contain only numbers' })
  code: string;
}

/**
 * DTO for resending verification code
 */
export class ResendVerificationCodeDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address to resend verification code to',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

/**
 * DTO for resending verification email (legacy token-based system)
 * Alias for backward compatibility
 */
export class ResendVerificationDto extends ResendVerificationCodeDto {}

