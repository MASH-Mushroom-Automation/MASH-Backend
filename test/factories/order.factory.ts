/**
 * Order Factory
 * 
 * Factory for creating test Order instances with realistic fake data.
 */

import { faker } from '@faker-js/faker';
import { OrderStatus } from '@prisma/client';

export interface OrderFactoryOptions {
  id?: string;
  orderNumber?: string;
  userId?: string;
  status?: OrderStatus;
  subtotal?: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  total?: number;
  currency?: string;
  notes?: string;
  shippingAddress?: any;
  billingAddress?: any;
  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
}

export class OrderFactory {
  /**
   * Create a single order with optional overrides
   */
  static create(overrides?: Partial<OrderFactoryOptions>) {
    const subtotal = overrides?.subtotal || faker.number.float({ min: 100, max: 5000, fractionDigits: 2 });
    const tax = overrides?.tax || subtotal * 0.12; // 12% VAT in Philippines
    const shipping = overrides?.shipping || faker.number.float({ min: 50, max: 200, fractionDigits: 2 });
    const discount = overrides?.discount || 0;
    const total = overrides?.total || (subtotal + tax + shipping - discount);
    
    const shippingAddress = overrides?.shippingAddress || {
      name: faker.person.fullName(),
      phone: faker.phone.number('+639#########'),
      street: faker.location.streetAddress(),
      barangay: faker.location.street(),
      city: faker.helpers.arrayElement(['Manila', 'Quezon City', 'Cebu City', 'Davao City']),
      province: faker.helpers.arrayElement(['Metro Manila', 'Cebu', 'Davao del Sur']),
      postalCode: faker.location.zipCode('####'),
      country: 'Philippines',
      isDefault: true,
    };

    return {
      id: overrides?.id || faker.string.uuid(),
      orderNumber: overrides?.orderNumber || `ORD-${faker.string.alphanumeric(10).toUpperCase()}`,
      userId: overrides?.userId || faker.string.uuid(),
      status: overrides?.status || OrderStatus.PENDING,
      subtotal,
      tax,
      shipping,
      discount,
      total,
      currency: overrides?.currency || 'PHP',
      notes: overrides?.notes || (faker.datatype.boolean() ? faker.lorem.sentence() : null),
      shippingAddress,
      billingAddress: overrides?.billingAddress || shippingAddress,
      trackingNumber: overrides?.trackingNumber || null,
      shippedAt: overrides?.shippedAt || null,
      deliveredAt: overrides?.deliveredAt || null,
      cancelledAt: overrides?.cancelledAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Create order with items
   */
  static createWithItems(itemCount: number = 3, overrides?: Partial<OrderFactoryOptions>) {
    const order = this.create(overrides);
    
    const items = Array.from({ length: itemCount }, () => ({
      id: faker.string.uuid(),
      orderId: order.id,
      productId: faker.string.uuid(),
      productName: faker.commerce.productName(),
      quantity: faker.number.int({ min: 1, max: 10 }),
      price: faker.number.float({ min: 50, max: 500, fractionDigits: 2 }),
      discount: faker.number.float({ min: 0, max: 50, fractionDigits: 2 }),
      metadata: {
        sku: `MSH-${faker.string.alphanumeric(8).toUpperCase()}`,
        weight: faker.number.float({ min: 0.1, max: 5, fractionDigits: 2 }),
        unit: 'kg',
      },
    }));

    return {
      ...order,
      orderItems: items,
    };
  }

  /**
   * Create pending order
   */
  static createPending(overrides?: Partial<OrderFactoryOptions>) {
    return this.create({
      ...overrides,
      status: OrderStatus.PENDING,
    });
  }

  /**
   * Create confirmed order
   */
  static createConfirmed(overrides?: Partial<OrderFactoryOptions>) {
    return this.create({
      ...overrides,
      status: OrderStatus.CONFIRMED,
    });
  }

  /**
   * Create processing order
   */
  static createProcessing(overrides?: Partial<OrderFactoryOptions>) {
    return this.create({
      ...overrides,
      status: OrderStatus.PROCESSING,
    });
  }

  /**
   * Create shipped order
   */
  static createShipped(overrides?: Partial<OrderFactoryOptions>) {
    return this.create({
      ...overrides,
      status: OrderStatus.SHIPPED,
      trackingNumber: `TRACK-${faker.string.alphanumeric(12).toUpperCase()}`,
      shippedAt: faker.date.recent({ days: 3 }),
    });
  }

  /**
   * Create delivered order
   */
  static createDelivered(overrides?: Partial<OrderFactoryOptions>) {
    const shippedAt = faker.date.recent({ days: 7 });
    const deliveredAt = new Date(shippedAt.getTime() + faker.number.int({ min: 1, max: 5 }) * 24 * 60 * 60 * 1000);
    
    return this.create({
      ...overrides,
      status: OrderStatus.DELIVERED,
      trackingNumber: `TRACK-${faker.string.alphanumeric(12).toUpperCase()}`,
      shippedAt,
      deliveredAt,
    });
  }

  /**
   * Create cancelled order
   */
  static createCancelled(overrides?: Partial<OrderFactoryOptions>) {
    return this.create({
      ...overrides,
      status: OrderStatus.CANCELLED,
      cancelledAt: faker.date.recent({ days: 2 }),
    });
  }

  /**
   * Create order with discount
   */
  static createWithDiscount(discountAmount?: number, overrides?: Partial<OrderFactoryOptions>) {
    const subtotal = faker.number.float({ min: 500, max: 5000, fractionDigits: 2 });
    const discount = discountAmount || subtotal * 0.15; // 15% discount
    
    return this.create({
      ...overrides,
      subtotal,
      discount,
      total: subtotal + (subtotal * 0.12) + 100 - discount, // subtotal + tax + shipping - discount
    });
  }

  /**
   * Create multiple orders
   */
  static createMany(count: number, overrides?: Partial<OrderFactoryOptions>) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create orders for a specific user
   */
  static createForUser(userId: string, count: number = 5) {
    return this.createMany(count, { userId });
  }

  /**
   * Create order set with different statuses
   */
  static createStatusSet(userId?: string) {
    const commonOverrides = userId ? { userId } : {};
    
    return {
      pending: this.createMany(3, { ...commonOverrides, status: OrderStatus.PENDING }),
      confirmed: this.createMany(2, { ...commonOverrides, status: OrderStatus.CONFIRMED }),
      processing: this.createMany(2, { ...commonOverrides, status: OrderStatus.PROCESSING }),
      shipped: this.createMany(4, {
        ...commonOverrides,
        status: OrderStatus.SHIPPED,
        trackingNumber: `TRACK-${faker.string.alphanumeric(12).toUpperCase()}`,
      }),
      delivered: this.createMany(10, {
        ...commonOverrides,
        status: OrderStatus.DELIVERED,
        deliveredAt: faker.date.recent({ days: 30 }),
      }),
      cancelled: this.createMany(1, {
        ...commonOverrides,
        status: OrderStatus.CANCELLED,
        cancelledAt: faker.date.recent({ days: 7 }),
      }),
    };
  }

  /**
   * Create high-value order (for testing limits)
   */
  static createHighValue(overrides?: Partial<OrderFactoryOptions>) {
    const subtotal = faker.number.float({ min: 10000, max: 50000, fractionDigits: 2 });
    
    return this.create({
      ...overrides,
      subtotal,
      total: subtotal + (subtotal * 0.12) + 500, // High shipping for high-value order
    });
  }

  /**
   * Create bulk order (for growers)
   */
  static createBulkOrder(overrides?: Partial<OrderFactoryOptions>) {
    const subtotal = faker.number.float({ min: 5000, max: 20000, fractionDigits: 2 });
    const discount = subtotal * 0.10; // 10% bulk discount
    
    return this.createWithItems(10, {
      ...overrides,
      subtotal,
      discount,
      total: subtotal + (subtotal * 0.12) + 300 - discount,
      notes: 'Bulk order - Grower purchase',
    });
  }
}
