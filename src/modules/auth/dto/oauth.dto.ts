import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl } from 'class-validator';

export class OAuthCallbackDto {
  @ApiProperty({
    example: 'google',
    description: 'OAuth provider (google, github, facebook)',
  })
  @IsString()
  provider: string;

  @ApiProperty({
    example: 'authorization_code_value',
    description: 'OAuth authorization code',
  })
  @IsString()
  code: string;

  @ApiProperty({
    example: 'random_state_value',
    description: 'OAuth state parameter for CSRF protection',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    example: 'https://app.example.com/dashboard',
    description: 'Redirect URL after OAuth flow',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  redirectUrl?: string;
}

export class OAuthInitiateDto {
  @ApiProperty({
    example: 'https://app.example.com/auth/callback',
    description: 'URL to redirect after OAuth flow',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  redirectUrl?: string;
}
