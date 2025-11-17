import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject } from 'class-validator';

export class WebhookEventDto {
  @ApiProperty({ example: 'ORD_789012' })
  @IsString()
  orderId: string;

  @ApiProperty({ example: 'ORDER.PICKED_UP', description: 'Event type from Lalamove' })
  @IsString()
  eventType: string;

  @ApiProperty({ example: '2025-11-18T10:30:00.000Z' })
  @IsString()
  timestamp: string;

  @ApiProperty({
    description: 'Event data including driver info, coordinates, POD, etc.',
    example: {
      status: 'PICKED_UP',
      driverId: 'DRV_123',
      driver: {
        id: 'DRV_123',
        name: 'Juan Dela Cruz',
        phone: '+639123456789',
        photo: 'https://lalamove.com/photo.jpg',
        plateNumber: 'ABC-1234'
      }
    }
  })
  @IsObject()
  data: {
    status?: string;
    driverId?: string;
    driverName?: string;
    driverPhone?: string;
    driver?: {
      id: string;
      name: string;
      phone: string;
      photo?: string;
      plateNumber?: string;
    };
    coordinates?: {
      lat: string;
      lng: string;
    };
    stopId?: string;
    POD?: {
      status: string;
      image?: string;
      signature?: string;
    };
    proofOfDelivery?: {
      images?: string[];
    };
    cancellationReason?: string;
  };
}

export class SetupWebhookDto {
  @ApiProperty({
    example: 'https://mash-backend.herokuapp.com/api/v1/lalamove/webhook',
    description: 'Webhook URL to receive events',
  })
  @IsString()
  webhookUrl: string;
}
