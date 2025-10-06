import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject } from 'class-validator';

export class SensorCalibrationDto {
  @ApiProperty({
    description: 'Sensor ID to calibrate',
    example: 'sensor-uuid-123',
  })
  @IsString()
  @IsNotEmpty()
  sensorId: string;

  @ApiProperty({
    description: 'Calibration data as JSON object',
    example: {
      offset: 0.5,
      multiplier: 1.02,
      referenceValue: 23.5,
      calibrationDate: '2025-10-04T00:00:00Z',
    },
  })
  @IsObject()
  @IsNotEmpty()
  calibrationData: any;
}
