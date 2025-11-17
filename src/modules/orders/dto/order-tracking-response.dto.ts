import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, ShippingProvider } from '../enums/order-status.enum';

export class TrackingEventDto {
  @ApiProperty({ example: '2025-11-18T08:00:00Z' })
  timestamp: Date;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.CONFIRMED })
  status: OrderStatus;

  @ApiProperty({ example: 'Order confirmed by seller' })
  description: string;

  @ApiPropertyOptional({ example: 'Quezon City Warehouse' })
  location?: string;

  @ApiPropertyOptional({ example: 'warehouse-staff-001' })
  performedBy?: string;
}

export class ShippingDetailsDto {
  @ApiPropertyOptional({ enum: ShippingProvider, example: ShippingProvider.LALAMOVE })
  provider?: ShippingProvider;

  @ApiPropertyOptional({ example: 'TRACK123456789' })
  trackingNumber?: string;

  @ApiPropertyOptional({ example: 'https://lalamove.com/track/TRACK123456789' })
  trackingUrl?: string;

  @ApiPropertyOptional({ example: '2025-11-20T10:00:00Z' })
  estimatedDelivery?: Date;

  @ApiPropertyOptional({ example: '2025-11-19T14:30:00Z' })
  actualDelivery?: Date;

  @ApiPropertyOptional({ example: 'Juan Dela Cruz' })
  courierName?: string;

  @ApiPropertyOptional({ example: '+639171234567' })
  courierPhone?: string;
}

export class OrderTrackingResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  orderId: string;

  @ApiProperty({ example: 'ORD-2025-000001' })
  orderNumber: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.IN_TRANSIT })
  currentStatus: OrderStatus;

  @ApiProperty({ example: 'Your order is on the way!' })
  statusDescription: string;

  @ApiProperty({ type: [TrackingEventDto] })
  timeline: TrackingEventDto[];

  @ApiPropertyOptional({ type: ShippingDetailsDto })
  shippingDetails?: ShippingDetailsDto;

  @ApiProperty({ example: '2025-11-18T08:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-11-19T10:30:00Z' })
  lastUpdatedAt: Date;

  @ApiProperty({ example: 65, description: 'Progress percentage (0-100)' })
  progressPercentage: number;

  @ApiProperty({ example: false })
  isCompleted: boolean;

  @ApiProperty({ example: true })
  canBeCancelled: boolean;

  @ApiProperty({ example: false })
  canBeReturned: boolean;
}
