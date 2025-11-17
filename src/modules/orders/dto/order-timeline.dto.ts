import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../enums/order-status.enum';

export class TimelineEventDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.CONFIRMED })
  status: OrderStatus;

  @ApiProperty({ example: 'Order Confirmed' })
  title: string;

  @ApiProperty({ example: 'Your order has been confirmed and is being prepared' })
  description: string;

  @ApiProperty({ example: '2025-11-18T08:15:00Z' })
  timestamp: Date;

  @ApiPropertyOptional({ example: 'warehouse-staff-001' })
  performedBy?: string;

  @ApiPropertyOptional({ example: 'Payment verified via PayMongo' })
  notes?: string;

  @ApiPropertyOptional({ example: 'Quezon City Warehouse' })
  location?: string;

  @ApiProperty({ example: true })
  isCompleted: boolean;

  @ApiProperty({ example: false })
  isCurrentState: boolean;
}

export class OrderTimelineDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  orderId: string;

  @ApiProperty({ example: 'ORD-2025-000001' })
  orderNumber: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.IN_TRANSIT })
  currentStatus: OrderStatus;

  @ApiProperty({ type: [TimelineEventDto] })
  timeline: TimelineEventDto[];

  @ApiProperty({ example: 7 })
  totalEvents: number;

  @ApiProperty({ example: 5 })
  completedEvents: number;

  @ApiProperty({ example: 65, description: 'Progress percentage (0-100)' })
  progressPercentage: number;

  @ApiProperty({ example: '2025-11-18T08:00:00Z' })
  orderCreatedAt: Date;

  @ApiProperty({ example: '2025-11-19T14:30:00Z' })
  lastUpdatedAt: Date;
}
