import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for linking Google account to existing user
 */
export class LinkGoogleAccountDto {
  @ApiProperty({
    description: 'Google ID token from Google Sign-In',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

/**
 * Response DTO for successful Google account linking
 */
export class GoogleLinkResponseDto {
  @ApiProperty({ 
    example: true,
    description: 'Indicates if the operation was successful',
  })
  success: boolean;

  @ApiProperty({ 
    example: 'Google account linked successfully',
    description: 'Human-readable success message',
  })
  message: string;

  @ApiProperty({
    description: 'Linked Google account data',
    example: {
      googleId: '1234567890',
      email: 'user@gmail.com',
      linkedAt: '2025-11-15T10:30:00Z',
    },
  })
  data: {
    googleId: string;
    email: string;
    linkedAt: Date;
  };
}

/**
 * Response DTO for successful Google account unlinking
 */
export class GoogleUnlinkResponseDto {
  @ApiProperty({ 
    example: true,
    description: 'Indicates if the operation was successful',
  })
  success: boolean;

  @ApiProperty({ 
    example: 'Google account unlinked successfully',
    description: 'Human-readable success message',
  })
  message: string;
}
