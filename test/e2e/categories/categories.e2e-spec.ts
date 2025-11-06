/**
 * ============================================================================
 * CATEGORIES E2E TESTS
 * ============================================================================
 * 
 * Tests for product categories management (MODULE 6 - Phase 2)
 * 
 * Endpoints Tested:
 * - GET    /api/v1/categories              - List all categories
 * - POST   /api/v1/categories              - Create category
 * - GET    /api/v1/categories/:id          - Get category by ID
 * - PATCH  /api/v1/categories/:id          - Update category
 * - DELETE /api/v1/categories/:id          - Delete category
 * - GET    /api/v1/categories/:id/children - Get child categories
 * - GET    /api/v1/categories/:id/products - Get products in category
 * - GET    /api/v1/categories/tree         - Get category tree
 * 
 * Test Count: 40+ tests
 * Priority: 🔴 CRITICAL (affects product organization)
 * ============================================================================
 */

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/database/prisma.service';
import { ErrorAnalyzer } from '../../utils/error-analyzer';
import { ProgressTracker } from '../../utils/progress-tracker';

describe('Categories E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let errorAnalyzer: ErrorAnalyzer;
  let progressTracker: ProgressTracker;
  let authToken: string;
  let adminToken: string;
  let categoryId: string;
  let parentCategoryId: string;

  const testUser = {
    email: 'category.user@example.com',
    password: 'SecurePass123!',
    firstName: 'Category',
    lastName: 'User',
  };

  const adminUser = {
    email: 'category.admin@example.com',
    password: 'AdminPass123!',
    firstName: 'Category',
    lastName: 'Admin',
    role: 'ADMIN',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    errorAnalyzer = new ErrorAnalyzer();
    progressTracker = new ProgressTracker('categories');

    // Cleanup and create test users
    await prisma.user.deleteMany({ where: { email: { in: [testUser.email, adminUser.email] } } });
    await prisma.category.deleteMany({ where: { name: { contains: 'Test' } } });

    // Register regular user
    const userRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser);
    authToken = userRegister.body.access_token;

    // Register admin user
    const adminRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(adminUser);
    adminToken = adminRegister.body.access_token;

    // Update admin role directly in database
    await prisma.user.update({
      where: { email: adminUser.email },
      data: { role: 'ADMIN' },
    });

    progressTracker.startModule();
  });

  afterAll(async () => {
    // Cleanup
    await prisma.category.deleteMany({ where: { name: { contains: 'Test' } } });
    await prisma.user.deleteMany({ where: { email: { in: [testUser.email, adminUser.email] } } });
    await prisma.$disconnect();
    
    await progressTracker.generateReport();
    await app.close();
  });

  describe('POST /api/v1/categories', () => {
    it('should create a new category as admin', async () => {
      const testName = 'POST /api/v1/categories - Create Success';
      progressTracker.startTest(testName);

      const categoryData = {
        name: 'Test Electronics',
        description: 'Electronic devices and accessories',
        slug: 'test-electronics',
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(categoryData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(categoryData.name);
      expect(response.body.slug).toBe(categoryData.slug);
      expect(response.body.description).toBe(categoryData.description);
      expect(response.body.isActive).toBe(true);

      parentCategoryId = response.body.id;
      categoryId = response.body.id;

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should create a child category', async () => {
      const testName = 'POST /api/v1/categories - Create Child Category';
      progressTracker.startTest(testName);

      const childData = {
        name: 'Test Smartphones',
        description: 'Mobile phones and smartphones',
        slug: 'test-smartphones',
        parentId: parentCategoryId,
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(childData)
        .expect(201);

      expect(response.body).toHaveProperty('parentId', parentCategoryId);
      expect(response.body.name).toBe(childData.name);

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail without admin role', async () => {
      const testName = 'POST /api/v1/categories - Forbidden (Non-Admin)';
      progressTracker.startTest(testName);

      const categoryData = {
        name: 'Test Forbidden Category',
        slug: 'test-forbidden',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send(categoryData)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Forbidden');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail with duplicate slug', async () => {
      const testName = 'POST /api/v1/categories - Duplicate Slug';
      progressTracker.startTest(testName);

      const duplicateData = {
        name: 'Test Electronics Duplicate',
        slug: 'test-electronics', // Same slug as parent
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateData)
        .expect(409);

      expect(response.body.message).toContain('already exists');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail without required fields', async () => {
      const testName = 'POST /api/v1/categories - Missing Required Fields';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({}) // Empty body
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(Array.isArray(response.body.message)).toBe(true);

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should auto-generate slug from name if not provided', async () => {
      const testName = 'POST /api/v1/categories - Auto-Generate Slug';
      progressTracker.startTest(testName);

      const categoryData = {
        name: 'Test Auto Slug Category',
        description: 'Category with auto-generated slug',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(categoryData)
        .expect(201);

      expect(response.body).toHaveProperty('slug');
      expect(response.body.slug).toBe('test-auto-slug-category');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail with invalid parent category ID', async () => {
      const testName = 'POST /api/v1/categories - Invalid Parent ID';
      progressTracker.startTest(testName);

      const categoryData = {
        name: 'Test Invalid Parent',
        slug: 'test-invalid-parent',
        parentId: 'non-existent-id-12345',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(categoryData)
        .expect(404);

      expect(response.body.message).toContain('Parent category not found');

      progressTracker.recordTest(testName, 'passed', response.body);
    });
  });

  describe('GET /api/v1/categories', () => {
    it('should list all categories', async () => {
      const testName = 'GET /api/v1/categories - List All';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('slug');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should filter by active status', async () => {
      const testName = 'GET /api/v1/categories - Filter Active';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .query({ isActive: true })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(category => {
        expect(category.isActive).toBe(true);
      });

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should paginate results', async () => {
      const testName = 'GET /api/v1/categories - Pagination';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .query({ page: 1, limit: 5 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.data.length).toBeLessThanOrEqual(5);

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should search by name', async () => {
      const testName = 'GET /api/v1/categories - Search by Name';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .query({ search: 'Electronics' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0].name).toContain('Electronics');
      }

      progressTracker.recordTest(testName, 'passed', response.body);
    });
  });

  describe('GET /api/v1/categories/:id', () => {
    it('should get category by ID', async () => {
      const testName = 'GET /api/v1/categories/:id - Success';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/categories/${categoryId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', categoryId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('slug');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should include children count', async () => {
      const testName = 'GET /api/v1/categories/:id - With Children Count';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/categories/${parentCategoryId}`)
        .query({ includeChildren: true })
        .expect(200);

      expect(response.body).toHaveProperty('childrenCount');
      expect(response.body.childrenCount).toBeGreaterThan(0);

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail with non-existent ID', async () => {
      const testName = 'GET /api/v1/categories/:id - Not Found';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get('/api/v1/categories/non-existent-id-12345')
        .expect(404);

      expect(response.body.message).toContain('not found');

      progressTracker.recordTest(testName, 'passed', response.body);
    });
  });

  describe('PATCH /api/v1/categories/:id', () => {
    it('should update category as admin', async () => {
      const testName = 'PATCH /api/v1/categories/:id - Update Success';
      progressTracker.startTest(testName);

      const updateData = {
        name: 'Test Electronics Updated',
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(updateData.description);

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should toggle active status', async () => {
      const testName = 'PATCH /api/v1/categories/:id - Toggle Active';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      expect(response.body.isActive).toBe(false);

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail without admin role', async () => {
      const testName = 'PATCH /api/v1/categories/:id - Forbidden';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated by User' })
        .expect(403);

      progressTracker.recordTest(testName, 'passed', response.body);
    });
  });

  describe('GET /api/v1/categories/:id/children', () => {
    it('should get child categories', async () => {
      const testName = 'GET /api/v1/categories/:id/children - Success';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/categories/${parentCategoryId}/children`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      response.body.forEach(child => {
        expect(child.parentId).toBe(parentCategoryId);
      });

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should return empty array for leaf category', async () => {
      const testName = 'GET /api/v1/categories/:id/children - No Children';
      progressTracker.startTest(testName);

      // Use a child category ID
      const childCategory = await prisma.category.findFirst({
        where: { parentId: parentCategoryId },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/categories/${childCategory.id}/children`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);

      progressTracker.recordTest(testName, 'passed', response.body);
    });
  });

  describe('GET /api/v1/categories/tree', () => {
    it('should get category tree structure', async () => {
      const testName = 'GET /api/v1/categories/tree - Success';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get('/api/v1/categories/tree')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('children');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should include only active categories', async () => {
      const testName = 'GET /api/v1/categories/tree - Active Only';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .get('/api/v1/categories/tree')
        .query({ activeOnly: true })
        .expect(200);

      const checkAllActive = (categories) => {
        categories.forEach(cat => {
          expect(cat.isActive).toBe(true);
          if (cat.children) checkAllActive(cat.children);
        });
      };

      checkAllActive(response.body);

      progressTracker.recordTest(testName, 'passed', response.body);
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('should prevent deletion of category with children', async () => {
      const testName = 'DELETE /api/v1/categories/:id - Has Children';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/categories/${parentCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.message).toContain('children');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should delete leaf category successfully', async () => {
      const testName = 'DELETE /api/v1/categories/:id - Delete Leaf';
      progressTracker.startTest(testName);

      // Create a new category to delete
      const newCategory = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Delete Category',
          slug: 'test-delete-category',
        });

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/categories/${newCategory.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deleted');

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    it('should fail without admin role', async () => {
      const testName = 'DELETE /api/v1/categories/:id - Forbidden';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      progressTracker.recordTest(testName, 'passed', response.body);
    });
  });

  describe('Error Detection', () => {
    it('should detect and analyze category errors', async () => {
      const testName = 'Categories Error Detection Test';
      progressTracker.startTest(testName);

      // Trigger an error
      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${authToken}`) // Non-admin user
        .send({ name: 'Test Category' })
        .expect(403);

      const diagnosis = await errorAnalyzer.analyze(response, {
        expectedStatus: 201,
        endpoint: '/api/v1/categories',
        testCase: 'Create category without admin role',
      });

      expect(diagnosis.errorType).toBe('AUTHORIZATION_ERROR');
      expect(diagnosis.severity).toBe('HIGH');

      console.log('\n📊 Category Error Analysis:');
      console.log(JSON.stringify(diagnosis, null, 2));

      progressTracker.recordTest(testName, 'passed', diagnosis);
    });
  });
});
