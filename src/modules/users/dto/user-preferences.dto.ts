import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';

enum Language {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
}

enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto',
}

export class UserPreferencesDto {
  @ApiProperty({
    example: 'en',
    enum: Language,
    description: 'Preferred language',
  })
  @IsEnum(Language)
  @IsOptional()
  language?: Language;

  @ApiProperty({
    example: 'America/New_York',
    description: 'User timezone',
  })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({
    example: true,
    description: 'Enable email notifications',
  })
  @IsBoolean()
  @IsOptional()
  emailNotifications?: boolean;

  @ApiProperty({
    example: true,
    description: 'Enable push notifications',
  })
  @IsBoolean()
  @IsOptional()
  pushNotifications?: boolean;

  @ApiProperty({
    example: 'light',
    enum: Theme,
    description: 'UI theme preference',
  })
  @IsEnum(Theme)
  @IsOptional()
  theme?: Theme;
}
