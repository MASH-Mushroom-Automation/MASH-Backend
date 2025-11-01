import { IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TriggerAlertDto {
  @ApiProperty({
    example: 'sensor.temperature',
    description: 'Type of event that triggered the alert',
  })
  @IsString()
  eventType: string;

  @ApiProperty({
    example: { deviceId: '123', temperature: 35, threshold: 30 },
    description: 'Event data payload',
  })
  @IsObject()
  data: Record<string, any>;

  @ApiProperty({
    example: { location: 'Warehouse A', sensor: 'TMP-001' },
    description: 'Additional metadata',
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
