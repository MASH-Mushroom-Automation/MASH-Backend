import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty } from 'class-validator';
import { IngestSensorDataDto } from './ingest-sensor-data.dto';

export class BatchIngestDto {
  @ApiProperty({
    description: 'Array of sensor data readings',
    type: [IngestSensorDataDto],
    example: [
      { value: 23.5, timestamp: '2025-10-04T08:30:00Z' },
      { value: 24.1, timestamp: '2025-10-04T08:31:00Z' },
    ],
  })
  @IsArray()
  @IsNotEmpty()
  data: IngestSensorDataDto[];
}
