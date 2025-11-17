import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsEnum } from 'class-validator';

export enum AnalyticsPeriod {
  TODAY = 'TODAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
  CUSTOM = 'CUSTOM',
}

export class OrderAnalyticsQueryDto {
  @ApiPropertyOptional({
    enum: AnalyticsPeriod,
    example: AnalyticsPeriod.MONTH,
    default: AnalyticsPeriod.MONTH,
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({
    example: '2025-11-01T00:00:00Z',
    description: 'Start date for CUSTOM period',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2025-11-30T23:59:59Z',
    description: 'End date for CUSTOM period',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class OrderAnalyticsDto {
  @ApiProperty({ example: 1250 })
  totalOrders: number;

  @ApiProperty({ example: 987500.5 })
  totalRevenue: number;

  @ApiProperty({ example: 790.0 })
  averageOrderValue: number;

  @ApiProperty({
    example: {
      PENDING: 45,
      CONFIRMED: 120,
      PROCESSING: 85,
      SHIPPED: 200,
      DELIVERED: 750,
      CANCELLED: 40,
      RETURNED: 10,
    },
  })
  ordersByStatus: Record<string, number>;

  @ApiProperty({
    example: {
      LALAMOVE: 500,
      LBC: 300,
      JNT: 250,
      NINJAVAN: 150,
      GRAB_EXPRESS: 50,
    },
  })
  ordersByShippingProvider: Record<string, number>;

  @ApiProperty({
    example: {
      '2025-11-01': 45,
      '2025-11-02': 52,
      '2025-11-03': 48,
    },
  })
  ordersOverTime: Record<string, number>;

  @ApiProperty({
    example: {
      '2025-11-01': 35600.5,
      '2025-11-02': 41200.75,
      '2025-11-03': 38100.25,
    },
  })
  revenueOverTime: Record<string, number>;

  @ApiProperty({ example: 3.2 })
  cancellationRate: number;

  @ApiProperty({ example: 0.8 })
  returnRate: number;

  @ApiProperty({ example: 95.5 })
  fulfillmentRate: number;

  @ApiProperty({ example: 2.5, description: 'Average days from order to delivery' })
  averageDeliveryTime: number;

  @ApiProperty({
    example: [
      { productId: '123', productName: 'Oyster Mushroom Kit', orderCount: 150 },
      { productId: '456', productName: 'Shiitake Mushroom Kit', orderCount: 120 },
    ],
  })
  topProducts: Array<{
    productId: string;
    productName: string;
    orderCount: number;
  }>;

  @ApiProperty({ example: '2025-11-01T00:00:00Z' })
  periodStart: Date;

  @ApiProperty({ example: '2025-11-30T23:59:59Z' })
  periodEnd: Date;
}
