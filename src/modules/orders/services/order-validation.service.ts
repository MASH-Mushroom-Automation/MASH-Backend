import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

/**
 * Order Validation Service
 * 
 * Implements business rules and validation logic for orders:
 * - Stock availability
 * - Address validation
 * - Payment method validation
 * - Business rules (min/max order amounts, item limits, etc.)
 */
@Injectable()
export class OrderValidationService {
  private readonly logger = new Logger(OrderValidationService.name);

  // Business rules configuration
  private readonly BUSINESS_RULES = {
    MIN_ORDER_AMOUNT: 100, // Minimum 100 PHP
    MAX_ORDER_AMOUNT: 100000, // Maximum 100,000 PHP
    MAX_ITEMS_PER_ORDER: 50,
    MAX_QUANTITY_PER_ITEM: 999,
    MIN_QUANTITY_PER_ITEM: 1,
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate order amount
   */
  validateOrderAmount(amount: number): void {
    if (amount < this.BUSINESS_RULES.MIN_ORDER_AMOUNT) {
      throw new BadRequestException(
        `Order amount must be at least ₱${this.BUSINESS_RULES.MIN_ORDER_AMOUNT}`,
      );
    }

    if (amount > this.BUSINESS_RULES.MAX_ORDER_AMOUNT) {
      throw new BadRequestException(
        `Order amount cannot exceed ₱${this.BUSINESS_RULES.MAX_ORDER_AMOUNT}`,
      );
    }
  }

  /**
   * Validate number of items in order
   */
  validateItemCount(itemCount: number): void {
    if (itemCount === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    if (itemCount > this.BUSINESS_RULES.MAX_ITEMS_PER_ORDER) {
      throw new BadRequestException(
        `Order cannot have more than ${this.BUSINESS_RULES.MAX_ITEMS_PER_ORDER} items`,
      );
    }
  }

  /**
   * Validate item quantity
   */
  validateItemQuantity(quantity: number, productName: string = 'Product'): void {
    if (quantity < this.BUSINESS_RULES.MIN_QUANTITY_PER_ITEM) {
      throw new BadRequestException(
        `${productName} quantity must be at least ${this.BUSINESS_RULES.MIN_QUANTITY_PER_ITEM}`,
      );
    }

    if (quantity > this.BUSINESS_RULES.MAX_QUANTITY_PER_ITEM) {
      throw new BadRequestException(
        `${productName} quantity cannot exceed ${this.BUSINESS_RULES.MAX_QUANTITY_PER_ITEM}`,
      );
    }
  }

  /**
   * Validate stock availability for multiple products
   */
  async validateStockAvailability(
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<void> {
    const productIds = items.map(item => item.productId);

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        name: true,
        stock: true,
        isActive: true,
      },
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }

      if (!product.isActive) {
        throw new BadRequestException(`Product "${product.name}" is not available for purchase`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`,
        );
      }
    }

    this.logger.debug(`Stock validation passed for ${items.length} items`);
  }

  /**
   * Validate shipping address
   */
  validateShippingAddress(address: any): void {
    const requiredFields = ['region', 'province', 'city', 'barangay', 'addressLine1'];

    for (const field of requiredFields) {
      if (!address || !address[field] || address[field].trim() === '') {
        throw new BadRequestException(
          `Shipping address is incomplete: ${field} is required`,
        );
      }
    }

    // Validate Philippines regions
    const validRegions = [
      'NCR',
      'CAR',
      'REGION I',
      'REGION II',
      'REGION III',
      'REGION IV-A',
      'REGION IV-B',
      'REGION V',
      'REGION VI',
      'REGION VII',
      'REGION VIII',
      'REGION IX',
      'REGION X',
      'REGION XI',
      'REGION XII',
      'REGION XIII',
      'BARMM',
    ];

    if (!validRegions.includes(address.region.toUpperCase())) {
      throw new BadRequestException(
        `Invalid region: ${address.region}. Must be a valid Philippines region.`,
      );
    }

    this.logger.debug('Shipping address validation passed');
  }

  /**
   * Validate billing address
   */
  validateBillingAddress(address: any): void {
    // Same validation as shipping address
    this.validateShippingAddress(address);
  }

  /**
   * Validate payment method
   */
  validatePaymentMethod(paymentMethod: string): void {
    const validMethods = [
      'CREDIT_CARD',
      'DEBIT_CARD',
      'GCASH',
      'PAYMAYA',
      'BANK_TRANSFER',
      'COD',
      'PAYPAL',
      'PAYMONGO',
    ];

    if (!validMethods.includes(paymentMethod)) {
      throw new BadRequestException(
        `Invalid payment method: ${paymentMethod}. Valid methods are: ${validMethods.join(', ')}`,
      );
    }

    this.logger.debug(`Payment method validation passed: ${paymentMethod}`);
  }

  /**
   * Validate user can create order
   */
  async validateUserCanCreateOrder(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.isActive) {
      throw new BadRequestException('User account is inactive');
    }

    if (!user.emailVerified) {
      throw new BadRequestException('Email verification required before placing orders');
    }

    this.logger.debug(`User ${userId} can create orders`);
  }

  /**
   * Validate product is active and available
   */
  async validateProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        isActive: true,
        stock: true,
      },
    });

    if (!product) {
      throw new BadRequestException(`Product ${productId} not found`);
    }

    if (!product.isActive) {
      throw new BadRequestException('Product is not available for purchase');
    }

    if (product.stock === 0) {
      throw new BadRequestException('Product is out of stock');
    }
  }

  /**
   * Validate coupon code (placeholder)
   * TODO: Implement coupon validation when CouponService is created
   */
  async validateCouponCode(code: string, userId: string, orderAmount: number): Promise<any> {
    this.logger.warn('Coupon validation not implemented yet');
    return null;
  }

  /**
   * Validate complete order before creation
   */
  async validateOrderCreation(orderData: any): Promise<void> {
    // 1. Validate item count
    this.validateItemCount(orderData.items.length);

    // 2. Validate each item quantity
    for (const item of orderData.items) {
      this.validateItemQuantity(item.quantity);
    }

    // 3. Validate stock availability
    await this.validateStockAvailability(orderData.items);

    // 4. Validate order amount
    const totalAmount = orderData.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    this.validateOrderAmount(totalAmount);

    // 5. Validate user
    await this.validateUserCanCreateOrder(orderData.userId);

    // 6. Validate addresses if provided
    if (orderData.shippingAddress) {
      this.validateShippingAddress(orderData.shippingAddress);
    }

    if (orderData.billingAddress) {
      this.validateBillingAddress(orderData.billingAddress);
    }

    // 7. Validate payment method if provided
    if (orderData.paymentMethod) {
      this.validatePaymentMethod(orderData.paymentMethod);
    }

    this.logger.log('Order validation passed successfully');
  }

  /**
   * Validate order can be cancelled
   */
  async validateOrderCancellation(orderId: string, userId: string, userRole: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    // Only order owner or admin can cancel
    if (order.userId !== userId && !['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      throw new BadRequestException('You are not authorized to cancel this order');
    }

    // Check if order can be cancelled based on status
    const cancellableStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING'];

    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be cancelled in ${order.status} status`,
      );
    }

    this.logger.debug(`Order ${orderId} can be cancelled`);
  }

  /**
   * Validate order can be updated
   */
  async validateOrderUpdate(orderId: string, userId: string, userRole: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    // Only order owner or admin can update
    if (order.userId !== userId && !['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      throw new BadRequestException('You are not authorized to update this order');
    }

    // Check if order can be updated based on status
    const updatableStatuses = ['PENDING'];

    if (!updatableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be updated in ${order.status} status. Only PENDING orders can be modified.`,
      );
    }

    this.logger.debug(`Order ${orderId} can be updated`);
  }

  /**
   * Get business rules configuration
   */
  getBusinessRules() {
    return { ...this.BUSINESS_RULES };
  }
}
