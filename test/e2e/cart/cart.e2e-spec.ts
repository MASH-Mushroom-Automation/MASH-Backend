import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/database/prisma.service';
import { CartStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('Cart E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let productId: string;
  let cartId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `cart-test-${Date.now()}@example.com`,
        password: '$2b$10$abcdefghijklmnopqrstuv',
        firstName: 'Cart',
        lastName: 'Tester',
        role: 'USER',
      },
    });
    userId = user.id;

    // Create test product
    const seller = await prisma.user.create({
      data: {
        email: `seller-${Date.now()}@example.com`,
        password: '$2b$10$abcdefghijklmnopqrstuv',
        firstName: 'Test',
        lastName: 'Seller',
        role: 'GROWER',
      },
    });

    const category = await prisma.category.create({
      data: {
        name: `Test Category ${Date.now()}`,
        slug: `test-category-${Date.now()}`,
        description: 'Test category for cart E2E tests',
      },
    });

    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        description: 'Test product for cart E2E',
        slug: `test-product-${Date.now()}`,
        price: new Decimal(100),
        stock: 50,
        categories: [],
        images: [],
        tags: [],
        isActive: true,
        sku: `SKU-${Date.now()}`,
      },
    });
    productId = product.id;

    // Get auth token (simplified - adjust based on your auth implementation)
    // For this test, we'll use JWT signing directly
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign(
      { sub: userId, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );
  }

  async function cleanupTestData() {
    // Delete carts first (foreign keys)
    await prisma.cart.deleteMany({
      where: { userId },
    });

    // Delete products
    if (productId) {
      await prisma.product.deleteMany({
        where: { id: productId },
      });
    }

    // Delete test users
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: userId },
          { email: { contains: 'cart-test-' } },
          { email: { contains: 'seller-' } },
        ],
      },
    });

    // Delete test categories
    await prisma.category.deleteMany({
      where: {
        name: { contains: 'Test Category' },
      },
    });
  }

  describe('POST /api/v1/cart/items - Add Item to Cart', () => {
    it('should add a new item to cart', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId,
          quantity: 2,
          customization: {},
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('items');
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].productId).toBe(productId);
      expect(response.body.items[0].quantity).toBe(2);
      expect(response.body.items[0].price).toBe('100');

      cartId = response.body.id;
    });

    it('should increase quantity when adding same item again', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId,
          quantity: 3,
          customization: {},
        })
        .expect(201);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].quantity).toBe(5); // 2 + 3
    });

    it('should return 404 when product not found', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 'non-existent-id',
          quantity: 1,
        })
        .expect(404);

      expect(response.body.message).toContain('Product not found');
    });

    it('should return 400 when quantity exceeds stock', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId,
          quantity: 100, // More than available stock (50)
        })
        .expect(400);

      expect(response.body.message).toContain('Insufficient stock');
    });

    it('should return 400 for invalid quantity', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId,
          quantity: 0,
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/cart - Get Cart', () => {
    it('should return current user cart with items', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('subtotal');
      expect(response.body).toHaveProperty('tax');
      expect(response.body).toHaveProperty('shippingCost');
      expect(response.body).toHaveProperty('total');
      expect(response.body.status).toBe(CartStatus.ACTIVE);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/api/v1/cart').expect(401);
    });
  });

  describe('PATCH /api/v1/cart/items/:itemId - Update Cart Item', () => {
    let itemId: string;

    beforeAll(async () => {
      const cart = await prisma.cart.findFirst({
        where: { userId },
        include: { items: true },
      });
      itemId = cart.items[0].id;
    });

    it('should update item quantity', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 3,
        })
        .expect(200);

      expect(response.body.items[0].quantity).toBe(3);
    });

    it('should return 404 when item not found', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/cart/items/non-existent-item')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 5,
        })
        .expect(404);
    });

    it('should return 400 when quantity exceeds stock', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 100,
        })
        .expect(400);

      expect(response.body.message).toContain('Insufficient stock');
    });
  });

  describe('DELETE /api/v1/cart/items/:itemId - Remove Cart Item', () => {
    it('should remove item from cart', async () => {
      const cart = await prisma.cart.findFirst({
        where: { userId },
        include: { items: true },
      });
      const itemId = cart.items[0].id;

      await request(app.getHttpServer())
        .delete(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify item was removed
      const updatedCart = await prisma.cart.findFirst({
        where: { userId },
        include: { items: true },
      });
      expect(updatedCart.items).toHaveLength(0);
    });

    it('should return 404 when item not found', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/cart/items/non-existent-item')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/cart/calculate-shipping - Calculate Shipping', () => {
    beforeAll(async () => {
      // Add item back to cart for shipping tests
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId,
          quantity: 2,
        });
    });

    it('should calculate shipping for NCR address', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/calculate-shipping')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          region: 'NCR',
          province: 'Metro Manila',
          city: 'Quezon City',
          barangay: 'Commonwealth',
          addressLine1: '123 Main St',
        })
        .expect(200);

      expect(response.body).toHaveProperty('shippingCost');
      expect(response.body).toHaveProperty('totalWeight');
      expect(response.body).toHaveProperty('region');
      expect(response.body.region).toBe('NCR');
      expect(parseFloat(response.body.shippingCost)).toBeGreaterThan(0);
    });

    it('should calculate higher shipping for provincial address', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/calculate-shipping')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          region: 'LUZON_NORTH',
          province: 'Ilocos Norte',
          city: 'Laoag',
          barangay: 'Barangay 1',
          addressLine1: '456 North St',
        })
        .expect(200);

      expect(response.body.region).toBe('LUZON_NORTH');
      expect(parseFloat(response.body.shippingCost)).toBeGreaterThan(0);
    });

    it('should return 400 for invalid address', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cart/calculate-shipping')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          province: 'Invalid Province',
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/cart/shipping-options - Get Shipping Options', () => {
    it('should return all available shipping options', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/shipping-options')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          region: 'NCR',
          province: 'Metro Manila',
          city: 'Quezon City',
          barangay: 'Commonwealth',
          addressLine1: '123 Main St',
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Verify shipping options structure
      response.body.forEach((option) => {
        expect(option).toHaveProperty('method');
        expect(option).toHaveProperty('name');
        expect(option).toHaveProperty('estimatedDays');
        expect(option).toHaveProperty('cost');
        expect(option).toHaveProperty('description');
      });
    });

    it('should show only STANDARD for Mindanao', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/shipping-options')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          region: 'MINDANAO',
          province: 'Davao del Sur',
          city: 'Davao City',
          barangay: 'Poblacion',
          addressLine1: '789 South Ave',
        })
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].method).toBe('STANDARD');
    });
  });

  describe('GET /api/v1/cart/summary - Get Cart Summary', () => {
    it('should return cart summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/cart/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('itemCount');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('hasUnavailableItems');
      expect(response.body.itemCount).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/cart/validate - Validate Cart', () => {
    it('should validate cart items', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('valid');
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should detect out of stock items', async () => {
      // Update product stock to 0
      await prisma.product.update({
        where: { id: productId },
        data: { stock: 0 },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.items[0].isAvailable).toBe(true);
      expect(response.body.items[0].currentStock).toBe(0);

      // Restore stock
      await prisma.product.update({
        where: { id: productId },
        data: { stock: 50 },
      });
    });

    it('should detect price changes', async () => {
      // Update product price
      await prisma.product.update({
        where: { id: productId },
        data: { price: new Decimal(150) },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items[0].priceChanged).toBe(true);

      // Restore price
      await prisma.product.update({
        where: { id: productId },
        data: { price: new Decimal(100) },
      });
    });
  });

  describe('DELETE /api/v1/cart/clear - Clear Cart', () => {
    it('should clear all items from cart', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/cart/clear')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify cart is empty
      const response = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toHaveLength(0);
    });
  });

  describe('Guest Cart Flow', () => {
    it('should create guest cart with sessionId', async () => {
      const sessionId = `session-${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('x-session-id', sessionId)
        .send({
          productId,
          quantity: 1,
        })
        .expect(201);

      expect(response.body.userId).toBeNull();
      expect(response.body.sessionId).toBe(sessionId);
    });

    it('should retrieve guest cart by sessionId', async () => {
      const sessionId = `session-${Date.now()}`;

      // Add item to guest cart
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('x-session-id', sessionId)
        .send({
          productId,
          quantity: 2,
        })
        .expect(201);

      // Retrieve guest cart
      const response = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('x-session-id', sessionId)
        .expect(200);

      expect(response.body.sessionId).toBe(sessionId);
      expect(response.body.items).toHaveLength(1);
    });
  });

  describe('Cart Expiration', () => {
    it('should have appropriate expiration date', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('expiresAt');
      const expiresAt = new Date(response.body.expiresAt);
      const now = new Date();
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      // Authenticated cart should expire in ~30 days
      expect(diffDays).toBeGreaterThan(25);
      expect(diffDays).toBeLessThan(35);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple rapid cart updates', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/api/v1/cart/items')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              productId,
              quantity: 1,
            }),
        );
      }

      const responses = await Promise.all(promises);
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });
    });

    it('should complete cart operations under 500ms', async () => {
      const start = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500);
    });
  });
});
