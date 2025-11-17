import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, ShippingProvider } from '../enums/order-status.enum';

export class OrderItemResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  productId: string;

  @ApiProperty({ example: 'Oyster Mushroom Growing Kit' })
  productName: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 299.99 })
  price: number;

  @ApiProperty({ example: 599.98 })
  subtotal: number;

  @ApiPropertyOptional({ example: 'Extra packaging requested' })
  notes?: string;
}

export class AddressResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174002' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  fullName: string;

  @ApiProperty({ example: '+639171234567' })
  phone: string;

  @ApiProperty({ example: '123 Main St, Brgy. Example' })
  addressLine1: string;

  @ApiPropertyOptional({ example: 'Unit 456' })
  addressLine2?: string;

  @ApiProperty({ example: 'Quezon City' })
  city: string;

  @ApiProperty({ example: 'Metro Manila' })
  province: string;

  @ApiProperty({ example: '1100' })
  postalCode: string;

  @ApiProperty({ example: 'Philippines' })
  country: string;
}

export class OrderResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'ORD-2025-000001' })
  orderNumber: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174003' })
  userId: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING })
  status: OrderStatus;

  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PAYMENT_PENDING })
  previousStatus?: OrderStatus;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  @ApiProperty({ example: 599.98 })
  subtotal: number;

  @ApiProperty({ example: 150.0 })
  shippingCost: number;

  @ApiProperty({ example: 71.88 })
  taxAmount: number;

  @ApiProperty({ example: 50.0 })
  discountAmount: number;

  @ApiProperty({ example: 771.86 })
  totalAmount: number;

  @ApiPropertyOptional({ enum: ShippingProvider, example: ShippingProvider.LALAMOVE })
  shippingProvider?: ShippingProvider;

  @ApiPropertyOptional({ example: 'TRACK123456789' })
  trackingNumber?: string;

  @ApiProperty({ type: AddressResponseDto })
  shippingAddress: AddressResponseDto;

  @ApiPropertyOptional({ type: AddressResponseDto })
  billingAddress?: AddressResponseDto;

  @ApiPropertyOptional({ example: '2025-11-20T10:00:00Z' })
  estimatedDelivery?: Date;

  @ApiPropertyOptional({ example: '2025-11-19T14:30:00Z' })
  actualDelivery?: Date;

  @ApiPropertyOptional({ example: 'PAID' })
  paymentStatus?: string;

  @ApiProperty({ example: '2025-11-18T08:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-11-18T09:00:00Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: '2025-11-18T08:15:00Z' })
  confirmedAt?: Date;

  @ApiPropertyOptional({ example: '2025-11-18T08:30:00Z' })
  statusUpdatedAt?: Date;

  @ApiPropertyOptional({ example: 'Please deliver before 5 PM' })
  notes?: string;

  @ApiPropertyOptional({ example: { source: 'mobile-app' } })
  metadata?: Record<string, any>;
}
