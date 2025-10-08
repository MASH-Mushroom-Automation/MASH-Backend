import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto',
}

class NotificationPreferences {
  @ApiPropertyOptional({
    description: 'Enable email notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @ApiPropertyOptional({
    description: 'Enable push notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @ApiPropertyOptional({
    description: 'Enable SMS notifications',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  sms?: boolean;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: 'UI theme preference',
    enum: Theme,
    example: 'dark',
  })
  @IsOptional()
  @IsEnum(Theme, { message: 'Theme must be light, dark, or auto' })
  theme?: Theme;

  @ApiPropertyOptional({
    description: 'Language preference (ISO 639-1 code)',
    example: 'en',
    pattern: '^[a-z]{2}$',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'Timezone (IANA timezone identifier)',
    example: 'America/New_York',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Notification preferences',
    type: NotificationPreferences,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationPreferences)
  notifications?: NotificationPreferences;
}
