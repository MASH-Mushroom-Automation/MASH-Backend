import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DeviceHealthMetricsDto {
  @ApiPropertyOptional({
    description: 'CPU usage percentage',
    example: 85.5,
    type: 'number',
  })
  @IsOptional()
  cpuUsage?: number;

  @ApiPropertyOptional({
    description: 'Memory usage percentage',
    example: 72.3,
    type: 'number',
  })
  @IsOptional()
  memoryUsage?: number;

  @ApiPropertyOptional({
    description: 'Device temperature in Celsius',
    example: 65.0,
    type: 'number',
  })
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Last seen timestamp in ISO format',
    example: '2025-01-27T10:30:00.000Z',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  lastSeen?: string;
}

export class SendDeviceHealthAlertDto {
  @ApiProperty({
    description: 'User ID to send the alert to',
    example: 'user-12345',
    type: 'string',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Device ID that triggered the alert',
    example: 'device-67890',
    type: 'string',
  })
  @IsString()
  deviceId: string;

  @ApiProperty({
    description: 'Health status of the device',
    example: 'CRITICAL',
    enum: ['HEALTHY', 'WARNING', 'CRITICAL', 'OFFLINE'],
  })
  @IsEnum(['HEALTHY', 'WARNING', 'CRITICAL', 'OFFLINE'])
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE';

  @ApiPropertyOptional({
    description: 'Device metrics and sensor data',
    type: DeviceHealthMetricsDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DeviceHealthMetricsDto)
  metrics?: DeviceHealthMetricsDto;
}

export class DeviceHealthAlertResponseDto {
  @ApiProperty({
    description: 'Success status of the operation',
    example: true,
    type: 'boolean',
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Device health alert sent',
    type: 'string',
  })
  message: string;
}