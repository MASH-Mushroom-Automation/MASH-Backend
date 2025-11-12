import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Device Information DTO (for tracking OAuth login source)
 */
export class DeviceInfoDto {
  @ApiPropertyOptional({
    example: 'device_abc123',
    description: 'Unique device identifier',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    example: 'ios',
    description: 'Platform type',
    enum: ['ios', 'android', 'web'],
  })
  @IsOptional()
  @IsEnum(['ios', 'android', 'web'])
  platform?: string;

  @ApiPropertyOptional({
    example: '1.0.0',
    description: 'App version',
  })
  @IsOptional()
  @IsString()
  appVersion?: string;
}

/**
 * Google Login DTO
 * Request body for POST /auth/google/login
 */
export class GoogleLoginDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjU5NjU...',
    description: 'Google ID token (JWT) obtained from Google Sign-In SDK',
  })
  @IsString()
  idToken: string;

  @ApiPropertyOptional({
    description: 'Device information (optional)',
    type: DeviceInfoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  deviceInfo?: DeviceInfoDto;
}

/**
 * Facebook Login DTO
 * Request body for POST /auth/facebook/login
 */
export class FacebookLoginDto {
  @ApiProperty({
    example: 'EAABwzLixnjYBO6Df8BNCMl8Qs...',
    description: 'Facebook access token obtained from Facebook Login SDK',
  })
  @IsString()
  accessToken: string;

  @ApiPropertyOptional({
    description: 'Device information (optional)',
    type: DeviceInfoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  deviceInfo?: DeviceInfoDto;
}

/**
 * Link Google Account DTO
 * Request body for POST /auth/social/link/google
 */
export class LinkGoogleAccountDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjU5NjU...',
    description: 'Google ID token to link to current user',
  })
  @IsString()
  idToken: string;
}

/**
 * Link Facebook Account DTO
 * Request body for POST /auth/social/link/facebook
 */
export class LinkFacebookAccountDto {
  @ApiProperty({
    example: 'EAABwzLixnjYBO6Df8BNCMl8Qs...',
    description: 'Facebook access token to link to current user',
  })
  @IsString()
  accessToken: string;
}
