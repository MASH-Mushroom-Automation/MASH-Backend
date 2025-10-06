import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class NotificationPreferencesDto {
  @ApiProperty({ description: 'Enable email notifications', required: false })
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @ApiProperty({ description: 'Enable push notifications', required: false })
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @ApiProperty({ description: 'Enable SMS notifications', required: false })
  @IsOptional()
  @IsBoolean()
  sms?: boolean;

  @ApiProperty({ description: 'Enable in-app notifications', required: false })
  @IsOptional()
  @IsBoolean()
  inApp?: boolean;

  @ApiProperty({ description: 'Enable order notifications', required: false })
  @IsOptional()
  @IsBoolean()
  orders?: boolean;

  @ApiProperty({ description: 'Enable device notifications', required: false })
  @IsOptional()
  @IsBoolean()
  devices?: boolean;

  @ApiProperty({ description: 'Enable sensor alerts', required: false })
  @IsOptional()
  @IsBoolean()
  sensors?: boolean;

  @ApiProperty({ description: 'Enable system notifications', required: false })
  @IsOptional()
  @IsBoolean()
  system?: boolean;
}
