import { ApiProperty } from '@nestjs/swagger';

class PriceBreakdownDto {
  @ApiProperty({ example: '150.00' })
  total: string;

  @ApiProperty({ example: 'PHP' })
  currency: string;

  @ApiProperty({ example: '120.00' })
  base: string;

  @ApiProperty({ example: '30.00', required: false })
  surge?: string;
}

class DistanceDto {
  @ApiProperty({ example: '12.5' })
  value: string;

  @ApiProperty({ example: 'km' })
  unit: string;
}

class StopResponseDto {
  @ApiProperty({ example: 'stop_abc123' })
  stopId: string;

  @ApiProperty({ 
    example: { lat: '14.8140', lng: '121.0452' },
    description: 'Stop coordinates'
  })
  coordinates: { lat: string; lng: string };

  @ApiProperty({ example: 'San Jose Del Monte, Bulacan' })
  address: string;
}

export class QuotationResponseDto {
  @ApiProperty({ example: 'QUO_123456' })
  quotationId: string;

  @ApiProperty({ example: 'MOTORCYCLE' })
  serviceType: string;

  @ApiProperty({ type: PriceBreakdownDto })
  priceBreakdown: PriceBreakdownDto;

  @ApiProperty({ type: DistanceDto })
  distance: DistanceDto;

  @ApiProperty({ example: '2025-11-18T10:05:00.000Z' })
  expiresAt: string;

  @ApiProperty({ type: [StopResponseDto] })
  stops: StopResponseDto[];

  @ApiProperty({ example: '2025-11-18T12:00:00.000Z', required: false })
  scheduleAt?: string;

  @ApiProperty({ example: true })
  isRouteOptimized: boolean;
}
