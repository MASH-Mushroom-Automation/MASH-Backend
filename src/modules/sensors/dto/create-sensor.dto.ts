import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsObject, Min, Max } from 'class-validator';

export class CreateSensorDto {
  @ApiProperty({
    description: 'Device ID this sensor belongs to',
    example: 'device-uuid-123',
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({
    description: 'Sensor type',
    example: 'TEMPERATURE',
    enum: ['TEMPERATURE', 'HUMIDITY', 'CO2', 'LIGHT', 'PH', 'MOISTURE', 'PRESSURE'],
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    description: 'Sensor name',
    example: 'Temperature Sensor 1',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Unit of measurement',
    example: '°C',
  })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({
    description: 'Minimum valid value',
    example: -50,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  minValue?: number;

  @ApiProperty({
    description: 'Maximum valid value',
    example: 100,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  maxValue?: number;

  @ApiProperty({
    description: 'Reading interval in seconds',
    example: 60,
    minimum: 5,
    maximum: 3600,
  })
  @IsNumber()
  @Min(5)
  @Max(3600)
  readingInterval: number;

  @ApiProperty({
    description: 'Sensor calibration data',
    example: { offset: 0, scale: 1 },
    required: false,
  })
  @IsObject()
  @IsOptional()
  calibration?: any;
}
