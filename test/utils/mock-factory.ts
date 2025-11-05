/**
 * Mock Factory using Faker
 * Provides realistic mock data for testing
 */

import { faker } from '@faker-js/faker';

export class MockFactory {
  /**
   * Generate mock user data
   */
  static createMockUser(overrides?: Partial<any>) {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      phone: faker.phone.number(),
      role: faker.helpers.arrayElement(['BUYER', 'SELLER', 'ADMIN']),
      isActive: true,
      isVerified: faker.datatype.boolean(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Generate mock product data
   */
  static createMockProduct(overrides?: Partial<any>) {
    return {
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      price: parseFloat(faker.commerce.price()),
      stock: faker.number.int({ min: 0, max: 1000 }),
      sku: faker.string.alphanumeric(10).toUpperCase(),
      categoryId: faker.string.uuid(),
      sellerId: faker.string.uuid(),
      images: [faker.image.url(), faker.image.url()],
      isActive: true,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Generate mock order data
   */
  static createMockOrder(overrides?: Partial<any>) {
    return {
      id: faker.string.uuid(),
      orderNumber: faker.string.alphanumeric(12).toUpperCase(),
      buyerId: faker.string.uuid(),
      sellerId: faker.string.uuid(),
      status: faker.helpers.arrayElement([
        'PENDING',
        'CONFIRMED',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
      ]),
      totalAmount: parseFloat(faker.commerce.price({ min: 100, max: 10000 })),
      shippingAddress: MockFactory.createMockAddress(),
      items: [MockFactory.createMockOrderItem()],
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Generate mock order item data
   */
  static createMockOrderItem(overrides?: Partial<any>) {
    return {
      id: faker.string.uuid(),
      productId: faker.string.uuid(),
      productName: faker.commerce.productName(),
      quantity: faker.number.int({ min: 1, max: 10 }),
      unitPrice: parseFloat(faker.commerce.price()),
      totalPrice: parseFloat(faker.commerce.price({ min: 100, max: 1000 })),
      ...overrides,
    };
  }

  /**
   * Generate mock address data
   */
  static createMockAddress(overrides?: Partial<any>) {
    return {
      id: faker.string.uuid(),
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      country: faker.location.country(),
      postalCode: faker.location.zipCode(),
      isDefault: faker.datatype.boolean(),
      ...overrides,
    };
  }

  /**
   * Generate mock category data
   */
  static createMockCategory(overrides?: Partial<any>) {
    return {
      id: faker.string.uuid(),
      name: faker.commerce.department(),
      slug: faker.helpers.slugify(faker.commerce.department()).toLowerCase(),
      description: faker.lorem.sentence(),
      parentId: null,
      isActive: true,
      order: faker.number.int({ min: 1, max: 100 }),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Generate mock payment data
   */
  static createMockPayment(overrides?: Partial<any>) {
    return {
      id: faker.string.uuid(),
      orderId: faker.string.uuid(),
      amount: parseFloat(faker.commerce.price({ min: 100, max: 10000 })),
      currency: 'PHP',
      method: faker.helpers.arrayElement([
        'CREDIT_CARD',
        'DEBIT_CARD',
        'GCASH',
        'PAYMAYA',
        'BANK_TRANSFER',
      ]),
      status: faker.helpers.arrayElement([
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED',
        'REFUNDED',
      ]),
      transactionId: faker.string.alphanumeric(16).toUpperCase(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Generate mock review data
   */
  static createMockReview(overrides?: Partial<any>) {
    return {
      id: faker.string.uuid(),
      productId: faker.string.uuid(),
      userId: faker.string.uuid(),
      rating: faker.number.int({ min: 1, max: 5 }),
      comment: faker.lorem.paragraph(),
      isVerifiedPurchase: faker.datatype.boolean(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Generate mock notification data
   */
  static createMockNotification(overrides?: Partial<any>) {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      title: faker.lorem.sentence(),
      message: faker.lorem.paragraph(),
      type: faker.helpers.arrayElement(['ORDER', 'PAYMENT', 'SHIPPING', 'PROMOTION', 'SYSTEM']),
      isRead: faker.datatype.boolean(),
      createdAt: faker.date.past(),
      ...overrides,
    };
  }

  /**
   * Generate mock seller profile data
   */
  static createMockSellerProfile(overrides?: Partial<any>) {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      businessName: faker.company.name(),
      businessType: faker.helpers.arrayElement(['INDIVIDUAL', 'CORPORATION', 'PARTNERSHIP']),
      description: faker.company.catchPhrase(),
      logo: faker.image.url(),
      rating: faker.number.float({ min: 1, max: 5, multipleOf: 0.1 }),
      totalSales: faker.number.int({ min: 0, max: 100000 }),
      isVerified: faker.datatype.boolean(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Generate mock cart data
   */
  static createMockCart(overrides?: Partial<any>) {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      items: [MockFactory.createMockCartItem()],
      totalAmount: parseFloat(faker.commerce.price({ min: 100, max: 5000 })),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Generate mock cart item data
   */
  static createMockCartItem(overrides?: Partial<any>) {
    return {
      id: faker.string.uuid(),
      cartId: faker.string.uuid(),
      productId: faker.string.uuid(),
      quantity: faker.number.int({ min: 1, max: 10 }),
      price: parseFloat(faker.commerce.price()),
      ...overrides,
    };
  }

  /**
   * Generate an array of mock data
   */
  static createMockArray<T>(
    factory: () => T,
    count: number = faker.number.int({ min: 1, max: 10 }),
  ): T[] {
    return Array.from({ length: count }, factory);
  }

  /**
   * Generate mock pagination metadata
   */
  static createMockPaginationMeta(overrides?: Partial<any>) {
    const page = overrides?.page || 1;
    const limit = overrides?.limit || 10;
    const total = overrides?.total || faker.number.int({ min: 50, max: 500 });

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
      ...overrides,
    };
  }

  /**
   * Generate mock API response
   */
  static createMockApiResponse<T>(data: T, overrides?: Partial<any>) {
    return {
      success: true,
      statusCode: 200,
      timestamp: new Date().toISOString(),
      data,
      ...overrides,
    };
  }

  /**
   * Generate mock error response
   */
  static createMockErrorResponse(overrides?: Partial<any>) {
    return {
      success: false,
      statusCode: 400,
      timestamp: new Date().toISOString(),
      path: '/api/v1/test',
      method: 'GET',
      error: {
        type: 'BadRequestException',
        code: 'BAD_REQUEST',
        message: 'Bad Request',
        details: [],
      },
      ...overrides,
    };
  }
}
