import { ApiProperty } from '@nestjs/swagger';

/**
 * Driver information response DTO
 */
export class DriverResponseDto {
  @ApiProperty({ example: 'DRV_123456', description: 'Driver ID' })
  driverId: string;

  @ApiProperty({ example: 'Juan Dela Cruz', description: 'Driver name' })
  name: string;

  @ApiProperty({ example: '+639123456789', description: 'Driver phone number' })
  phone: string;

  @ApiProperty({ 
    example: 'https://lalamove.com/driver-photo.jpg', 
    description: 'Driver photo URL',
    required: false
  })
  photo?: string;

  @ApiProperty({ example: 'ABC-1234', description: 'Vehicle plate number' })
  plateNumber: string;

  @ApiProperty({ 
    example: { lat: '14.8140', lng: '121.0452' },
    description: 'Current driver location',
    required: false
  })
  location?: {
    lat: string;
    lng: string;
  };

  @ApiProperty({ 
    example: 4.8, 
    description: 'Driver rating (0-5)',
    required: false
  })
  rating?: number;

  @ApiProperty({ 
    example: 250, 
    description: 'Total completed deliveries',
    required: false
  })
  totalDeliveries?: number;
}
