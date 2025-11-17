import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional } from 'class-validator';

export class WebhookEventDto {
  @ApiProperty({ example: 'ORD_789012' })
  @IsString()
  orderId: string;

  @ApiProperty({ example: 'PICKED_UP' })
  @IsString()
  status: string;

  @ApiProperty({ example: '2025-11-18T10:30:00.000Z' })
  @IsString()
  timestamp: string;

  @ApiProperty({
    type: 'object',
    description: 'Event data including driver info, coordinates, POD, etc.',
  })
  @IsObject()
  data: {
    driverId?: string;
    driverName?: string;
    driverPhone?: string;
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
