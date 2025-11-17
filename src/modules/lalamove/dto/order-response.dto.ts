import { ApiProperty } from '@nestjs/swagger';

class OrderPriceBreakdownDto {
  @ApiProperty({ example: '150.00' })
  total: string;

  @ApiProperty({ example: 'PHP' })
  currency: string;

  @ApiProperty({ example: '20.00', required: false })
  priorityFee?: string;
}

class PODDto {
  @ApiProperty({ example: 'PENDING' })
  status: string;

  @ApiProperty({ example: 'https://lalamove.com/pod/12345.jpg', required: false })
  image?: string;

  @ApiProperty({ example: 'https://lalamove.com/signature/12345.jpg', required: false })
  signature?: string;
}

class OrderStopDto {
  @ApiProperty({ example: 'stop_abc123' })
  stopId: string;

  @ApiProperty({ type: 'object', example: { lat: '14.8140', lng: '121.0452' } })
  coordinates: { lat: string; lng: string };

  @ApiProperty({ example: 'San Jose Del Monte, Bulacan' })
  address: string;

  @ApiProperty({ type: PODDto, required: false })
  POD?: PODDto;
}

export class OrderResponseDto {
  @ApiProperty({ example: 'ORD_789012' })
  orderId: string;

  @ApiProperty({ example: 'ASSIGNING_DRIVER' })
  status: string;

  @ApiProperty({ example: 'DRV_456789', required: false })
  driverId?: string;

  @ApiProperty({ example: 'https://lalamove.com/track/ORD_789012' })
  shareLink: string;

  @ApiProperty({ type: OrderPriceBreakdownDto })
  priceBreakdown: OrderPriceBreakdownDto;

  @ApiProperty({ type: [OrderStopDto] })
  stops: OrderStopDto[];

  @ApiProperty({ example: '2025-11-18T12:00:00.000Z', required: false })
  scheduleAt?: string;

  @ApiProperty({ type: 'object', example: { value: '12.5', unit: 'km' } })
  distance: { value: string; unit: string };
}
