import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';

export class CartItemResponseDto {
  @ApiProperty({ description: 'Cart item ID' })
  id: string;

  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Quantity of the product' })
  quantity: number;

  @ApiProperty({ description: 'Price at time of adding to cart' })
  price: number | Decimal;

  @ApiPropertyOptional({ description: 'Original price for comparison' })
  originalPrice?: number | Decimal;

  @ApiProperty({ description: 'Subtotal (quantity * price)' })
  subtotal: number | Decimal;

  @ApiProperty({ description: 'Discount amount' })
  discount: number | Decimal;

  @ApiProperty({ description: 'Total (subtotal - discount)' })
  total: number | Decimal;

  @ApiPropertyOptional({ description: 'Product snapshot at time of adding' })
  productSnapshot?: any;

  @ApiPropertyOptional({ description: 'Custom options' })
  customization?: any;

  @ApiProperty({ description: 'Whether the product is available' })
  isAvailable: boolean;

  @ApiPropertyOptional({ description: 'Reason if product is unavailable' })
  unavailableReason?: string;

  @ApiProperty({ description: 'When item was added' })
  addedAt: Date;

  @ApiProperty({ description: 'Last update time' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Product details (if included)' })
  product?: {
    id: string;
    name: string;
    slug: string;
    images: any[];
    stock: number;
    price: number | Decimal;
  };
}

export class CartResponseDto {
  @ApiProperty({ description: 'Cart ID' })
  id: string;

  @ApiPropertyOptional({ description: 'User ID (null for guest carts)' })
  userId?: string;

  @ApiPropertyOptional({ description: 'Session ID (for guest carts)' })
  sessionId?: string;

  @ApiProperty({ description: 'Cart status' })
  status: string;

  @ApiProperty({ description: 'Subtotal amount' })
  subtotal: number | Decimal;

  @ApiProperty({ description: 'Tax amount' })
  tax: number | Decimal;

  @ApiProperty({ description: 'Shipping amount' })
  shipping: number | Decimal;

  @ApiProperty({ description: 'Discount amount' })
  discount: number | Decimal;

  @ApiProperty({ description: 'Total amount' })
  total: number | Decimal;

  @ApiProperty({ description: 'Currency code' })
  currency: string;

  @ApiProperty({ description: 'Number of items in cart' })
  itemCount: number;

  @ApiProperty({ description: 'Cart items', type: [CartItemResponseDto] })
  items: CartItemResponseDto[];

  @ApiPropertyOptional({ description: 'Cart expiration date' })
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'When cart was converted (guest to user)' })
  convertedAt?: Date;

  @ApiPropertyOptional({ description: 'When cart was abandoned' })
  abandonedAt?: Date;

  @ApiProperty({ description: 'Last activity timestamp' })
  lastActivityAt: Date;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: any;

  @ApiProperty({ description: 'Cart creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}

export class CartSummaryResponseDto {
  @ApiProperty({ description: 'Number of items in cart' })
  itemCount: number;

  @ApiProperty({ description: 'Total cart value' })
  total: number | Decimal;

  @ApiProperty({ description: 'Whether cart has unavailable items' })
  hasUnavailableItems: boolean;
}
