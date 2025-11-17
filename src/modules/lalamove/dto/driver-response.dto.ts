import { ApiProperty } from '@nestjs/swagger';

class DriverCoordinatesDto {
  @ApiProperty({ example: '14.8140' })
  lat: string;

  @ApiProperty({ example: '121.0452' })
  lng: string;

  @ApiProperty({ example: '2025-11-18T10:30:00.000Z' })
  updatedAt: string;
}

export class DriverResponseDto {
  @ApiProperty({ example: 'DRV_456789' })
  driverId: string;

  @ApiProperty({ example: 'Juan Dela Cruz' })
  name: string;

  @ApiProperty({ example: '+639123456789' })
  phone: string;

  @ApiProperty({ example: 'ABC-1234' })
  plateNumber: string;

  @ApiProperty({ example: 'https://lalamove.com/driver/photo.jpg', required: false })
  photo?: string;

  @ApiProperty({ type: DriverCoordinatesDto, required: false })
  coordinates?: DriverCoordinatesDto;
}
