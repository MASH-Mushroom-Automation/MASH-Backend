import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject, MaxLength } from 'class-validator';

// Use Prisma enum directly
export enum DeviceType {
  MUSHROOM_CHAMBER = 'MUSHROOM_CHAMBER',
  ENVIRONMENTAL_SENSOR = 'ENVIRONMENTAL_SENSOR',
  IRRIGATION_SYSTEM = 'IRRIGATION_SYSTEM',
  HVAC_CONTROLLER = 'HVAC_CONTROLLER',
  CAMERA = 'CAMERA',
  pH_SENSOR = 'pH_SENSOR',
  HUMIDITY_CONTROLLER = 'HUMIDITY_CONTROLLER',
}

export class CreateDeviceDto {
  @ApiProperty({
    description: 'Device name',
    example: 'Mushroom Farm Sensor 01',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Device type',
    enum: DeviceType,
    example: DeviceType.ENVIRONMENTAL_SENSOR,
  })
  @IsEnum(DeviceType)
  @IsNotEmpty()
  type: DeviceType;

  @ApiProperty({
    description: 'Device description',
    example: 'Temperature and humidity sensor for growing room A',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Device location',
    example: 'Growing Room A - Shelf 3',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  location?: string;

  @ApiProperty({
    description: 'Device configuration as JSON object',
    example: {
      readingInterval: 60,
      alertThresholds: {
        temperature: { min: 18, max: 24 },
        humidity: { min: 85, max: 95 },
      },
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  configuration?: any;

  @ApiProperty({
    description: 'User ID who owns this device',
    example: 'user-uuid-123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
