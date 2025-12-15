import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FirebaseSyncDto {
  @ApiProperty({
    description: 'Firebase ID token from Google Sign-In',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFlOWdkay...',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiPropertyOptional({
    description: 'Optional device information for session tracking',
    example: {
      userAgent: 'Mozilla/5.0...',
      platform: 'web',
      ipAddress: '192.168.1.1',
    },
  })
  @IsOptional()
  @IsObject()
  deviceInfo?: any;
}
