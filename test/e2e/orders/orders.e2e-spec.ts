import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/database/prisma.service';
import { ErrorAnalyzer } from '../../utils/error-analyzer';
import { ProgressTracker } from '../../utils/progress-tracker';

describe('Orders Module - Automated Testing', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let errorAnalyzer: ErrorAnalyzer;
  let progressTracker: ProgressTracker;
  let buyerAccessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    errorAnalyzer = new ErrorAnalyzer();
    progressTracker = new ProgressTracker('orders');

    // Get buyer token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'buyer@mash.com',
        password: 'BuyerPass123!',
      });

    if (loginResponse.body.accessToken) {
      buyerAccessToken = loginResponse.body.accessToken;
    }
  });

  afterAll(async () => {
    await progressTracker.generateReport();
    await app.close();
  });

  // ==================== POST /api/v1/orders - CREATE ORDER ====================

  describe('POST /api/v1/orders - Create Order', () => {
    it('Should create new order', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          items: [
            {
              productId: 'product-1',
              quantity: 5,
              price: 15.99,
            },
            {
              productId: 'product-2',
              quantity: 3,
              price: 25.99,
            },
          ],
          shippingAddress: {
            street: '123 Main St',
            city: 'Manila',
            province: 'Metro Manila',
            postalCode: '1000',
            country: 'Philippines',
          },
          paymentMethod: 'credit_card',
        })
        .expect(201);

      const responseTime = Date.now() - startTime;

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('orderNumber');
      expect(response.body.status).toBe('PENDING');

      progressTracker.recordSuccess('POST /orders', responseTime, 'Create order');
    });

    it('Should calculate correct total amount', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          items: [
            { productId: 'product-1', quantity: 2, price: 10.0 },
            { productId: 'product-2', quantity: 3, price: 15.0 },
          ],
          shippingAddress: {
            street: '123 Main St',
            city: 'Manila',
            province: 'Metro Manila',
            postalCode: '1000',
          },
          paymentMethod: 'credit_card',
        })
        .expect(201);

      const expectedTotal = 2 * 10.0 + 3 * 15.0; // 65.0
      expect(response.body.totalAmount).toBe(expectedTotal);

      progressTracker.recordSuccess('POST /orders', 0, 'Correct total calculation');
    });

    it('Should reject empty order items', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          items: [],
          shippingAddress: {
            street: '123 Main St',
            city: 'Manila',
          },
          paymentMethod: 'credit_card',
        })
        .expect(400);

      progressTracker.recordSuccess('POST /orders', 0, 'Empty items rejected');
    });

    it('Should reject invalid quantity', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          items: [{ productId: 'product-1', quantity: 0, price: 10.0 }],
          shippingAddress: { street: '123 Main St', city: 'Manila' },
          paymentMethod: 'credit_card',
        })
        .expect(400);

      progressTracker.recordSuccess('POST /orders', 0, 'Invalid quantity rejected');
    });
  });

  // ==================== GET /api/v1/orders - LIST ORDERS ====================

  describe('GET /api/v1/orders - List Orders', () => {
    it('Should list user orders', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      progressTracker.recordSuccess('GET /orders', 0, 'List orders');
    });

    it('Should filter orders by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .query({ status: 'PENDING' })
        .expect(200);

      progressTracker.recordSuccess('GET /orders', 0, 'Filter by status');
    });
  });

  // ==================== GET /api/v1/orders/:id - GET ORDER BY ID ====================

  describe('GET /api/v1/orders/:id - Get Order by ID', () => {
    it('Should get order details', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders/test-order-id')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('items');

      progressTracker.recordSuccess('GET /orders/:id', 0, 'Get order details');
    });

    it('Should return 404 for non-existent order', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders/non-existent-id')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .expect(404);

      progressTracker.recordSuccess('GET /orders/:id', 0, 'Non-existent order 404');
    });
  });

  // ==================== PATCH /api/v1/orders/:id/status - UPDATE ORDER STATUS ====================

  describe('PATCH /api/v1/orders/:id/status - Update Order Status', () => {
    it('Should update order status', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/orders/test-order-id/status')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          status: 'CONFIRMED',
        })
        .expect(200);

      expect(response.body.status).toBe('CONFIRMED');

      progressTracker.recordSuccess('PATCH /orders/:id/status', 0, 'Update status');
    });

    it('Should reject invalid status transition', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/orders/test-order-id/status')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          status: 'INVALID_STATUS',
        })
        .expect(400);

      progressTracker.recordSuccess('PATCH /orders/:id/status', 0, 'Invalid status rejected');
    });
  });

  // ==================== POST /api/v1/orders/:id/cancel - CANCEL ORDER ====================

  describe('POST /api/v1/orders/:id/cancel - Cancel Order', () => {
    it('Should cancel pending order', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders/test-order-id/cancel')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');

      progressTracker.recordSuccess('POST /orders/:id/cancel', 0, 'Cancel order');
    });

    it('Should reject canceling shipped order', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders/shipped-order-id/cancel')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .expect(400);

      progressTracker.recordSuccess('POST /orders/:id/cancel', 0, 'Shipped order cancel rejected');
    });
  });

  // ==================== ORDER WORKFLOW TESTS ====================

  describe('📦 Order Workflow', () => {
    it('Should complete full order lifecycle', async () => {
      // Create order
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({
          items: [{ productId: 'product-1', quantity: 2, price: 10.0 }],
          shippingAddress: { street: '123 Main St', city: 'Manila' },
          paymentMethod: 'credit_card',
        })
        .expect(201);

      const orderId = createResponse.body.id;

      // Confirm order
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      // Ship order
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({ status: 'SHIPPED' })
        .expect(200);

      // Complete order
      const completeResponse = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${buyerAccessToken}`)
        .send({ status: 'DELIVERED' })
        .expect(200);

      expect(completeResponse.body.status).toBe('DELIVERED');

      progressTracker.recordSuccess('POST /orders', 0, 'Full order lifecycle');
    });
  });
});
