import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class DeviceConfigurationDto {
  @ApiProperty({
    description: 'Sensor reading interval in seconds',
    example: 60,
    minimum: 10,
    maximum: 3600,
    required: false,
  })
  @IsNumber()
  @Min(10)
  @Max(3600)
  @IsOptional()
  readingInterval?: number;

  @ApiProperty({
    description: 'Alert thresholds for sensor values',
    example: {
      temperature: { min: 18, max: 24 },
      humidity: { min: 85, max: 95 },
      co2: { min: 800, max: 1200 },
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  alertThresholds?: any;

  @ApiProperty({
    description: 'Device operation settings',
    example: {
      mode: 'auto',
      schedule: '0 */6 * * *',
      timezone: 'Asia/Manila',
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  operationSettings?: any;

  @ApiProperty({
    description: 'Notification preferences',
    example: {
      email: true,
      sms: false,
      push: true,
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  notificationSettings?: any;
}
