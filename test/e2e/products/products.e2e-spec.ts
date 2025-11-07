import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/database/prisma.service';
import { ErrorAnalyzer } from '../../utils/error-analyzer';
import { ProgressTracker } from '../../utils/progress-tracker';
import { getAuthToken } from '../../utils/auth.helper';

describe('Products Module - Automated Testing', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let errorAnalyzer: ErrorAnalyzer;
  let progressTracker: ProgressTracker;
  let sellerAccessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['/'],
    });
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
    progressTracker = new ProgressTracker('products');

    // Get authentication token for SELLER user
    sellerAccessToken = await getAuthToken(app, 'SELLER');
  });

  afterAll(async () => {
    await progressTracker.generateReport();
    await app.close();
  });

  // ==================== GET /api/v1/products - LIST PRODUCTS ====================

  describe('GET /api/v1/products - List Products', () => {
    it('Should list all products', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      progressTracker.recordSuccess('GET /products', responseTime, 'List products');
    });

    it('Should filter products by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ category: 'mushrooms' })
        .expect(200);

      progressTracker.recordSuccess('GET /products', 0, 'Filter by category');
    });

    it('Should search products by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ search: 'oyster mushroom' })
        .expect(200);

      progressTracker.recordSuccess('GET /products', 0, 'Search by name');
    });

    it('Should sort products by price', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ sortBy: 'price', order: 'asc' })
        .expect(200);

      progressTracker.recordSuccess('GET /products', 0, 'Sort by price');
    });
  });

  // ==================== POST /api/v1/products - CREATE PRODUCT ====================

  describe('POST /api/v1/products - Create Product', () => {
    it('Should create new product', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send({
          name: 'Fresh Oyster Mushrooms',
          description: 'Organic oyster mushrooms grown locally',
          price: 15.99,
          stock: 100,
          category: 'mushrooms',
          images: ['image1.jpg', 'image2.jpg'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Fresh Oyster Mushrooms');

      progressTracker.recordSuccess('POST /products', 0, 'Create product');
    });

    it('Should reject invalid price', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send({
          name: 'Test Product',
          price: -10, // Invalid negative price
          stock: 100,
        })
        .expect(400);

      progressTracker.recordSuccess('POST /products', 0, 'Invalid price rejected');
    });

    it('Should reject unauthorized product creation', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Test Product',
          price: 10,
          stock: 100,
        })
        .expect(401);

      progressTracker.recordSuccess('POST /products', 0, 'Unauthorized rejected');
    });
  });

  // ==================== PATCH /api/v1/products/:id - UPDATE PRODUCT ====================

  describe('PATCH /api/v1/products/:id - Update Product', () => {
    it('Should update product', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/products/test-product-id')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send({
          price: 19.99,
          stock: 150,
        })
        .expect(200);

      progressTracker.recordSuccess('PATCH /products/:id', 0, 'Update product');
    });

    it('Should reject stock below zero', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/products/test-product-id')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send({
          stock: -5,
        })
        .expect(400);

      progressTracker.recordSuccess('PATCH /products/:id', 0, 'Negative stock rejected');
    });
  });

  // ==================== DELETE /api/v1/products/:id - DELETE PRODUCT ====================

  describe('DELETE /api/v1/products/:id - Delete Product', () => {
    it('Should delete product', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/products/test-product-id')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .expect(204);

      progressTracker.recordSuccess('DELETE /products/:id', 0, 'Delete product');
    });
  });

  // ==================== PRODUCT INVENTORY TESTS ====================

  describe('📦 Inventory Management', () => {
    it('Should mark product as out of stock when stock is 0', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/products/test-product-id')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send({
          stock: 0,
        })
        .expect(200);

      expect(response.body.inStock).toBe(false);

      progressTracker.recordSuccess('PATCH /products/:id', 0, 'Out of stock handling');
    });
  });
});
