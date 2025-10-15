import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DrillDownService } from './drilldown.service';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../common/services/cache.service';
import { OrderStatus } from '@prisma/client';

describe('DrillDownService', () => {
  let service: DrillDownService;
  let prismaService: PrismaService;
  let cacheService: CacheService;

  const mockPrismaService = {
    category: {
      findUnique: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrillDownService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<DrillDownService>(DrillDownService);
    prismaService = module.get<PrismaService>(PrismaService);
    cacheService = module.get<CacheService>(CacheService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('categoryToProducts', () => {
    const categoryId = 'category-1';
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');

    const mockCategory = {
      id: categoryId,
      name: 'Electronics',
      description: 'Electronic items',
      imageUrl: 'https://example.com/electronics.jpg',
    };

    const mockOrderItems = [
      {
        productId: 'product-1',
        quantity: 5,
        price: 1000,
        order: {
          id: 'order-1',
          status: OrderStatus.DELIVERED,
          total: 5000,
        },
      },
      {
        productId: 'product-2',
        quantity: 10,
        price: 50,
        order: {
          id: 'order-2',
          status: OrderStatus.DELIVERED,
          total: 500,
        },
      },
    ];

    const mockProducts = [
      {
        id: 'product-1',
        name: 'Laptop',
        price: 1000,
        categories: [categoryId],
        orderItems: [mockOrderItems[0]],
      },
      {
        id: 'product-2',
        name: 'Mouse',
        price: 50,
        categories: [categoryId],
        orderItems: [mockOrderItems[1]],
      },
    ];

    it('should return category drill-down with product metrics', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.orderItem.findMany.mockResolvedValue(mockOrderItems);

      const result = await service.categoryToProducts(
        categoryId,
        startDate,
        endDate,
      );

      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('products');
      expect(result.category.id).toBe(categoryId);
      expect(result.summary.totalProducts).toBe(2);
      expect(result.products).toHaveLength(2);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should use cached data when available', async () => {
      const cachedData = {
        category: mockCategory,
        summary: { totalProducts: 2 },
        products: [],
      };
      mockCacheService.get.mockResolvedValue(cachedData);

      const result = await service.categoryToProducts(
        categoryId,
        startDate,
        endDate,
      );

      expect(result).toEqual(cachedData);
      expect(mockPrismaService.category.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when category not found', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(
        service.categoryToProducts(categoryId, startDate, endDate),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle empty product list', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.categoryToProducts(
        categoryId,
        startDate,
        endDate,
      );

      expect(result.summary.totalProducts).toBe(0);
      expect(result.products).toHaveLength(0);
    });
  });

  describe('productToOrders', () => {
    const productId = 'product-1';
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');

    const mockProduct = {
      id: productId,
      name: 'Laptop',
      price: 1000,
    };

    const mockOrderItems = [
      {
        productId: 'product-1',
        quantity: 2,
        price: 1000,
        total: 2000,
        order: {
          id: 'order-1',
          createdAt: new Date('2024-06-01'),
          status: OrderStatus.DELIVERED,
          total: 2000,
        },
      },
    ];

    it('should return product drill-down with order details', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          createdAt: new Date('2024-06-01'),
          status: OrderStatus.DELIVERED,
          total: 2000,
          orderItems: mockOrderItems,
          user: {
            id: 'user-1',
            email: 'user1@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      ]);

      const result = await service.productToOrders(
        productId,
        startDate,
        endDate,
      );

      expect(result).toHaveProperty('product');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('orders');
      expect(result.product.id).toBe(productId);
      expect(result.summary.totalOrders).toBe(1);
      expect(result.orders[0].customer).toHaveProperty('email');
    });

    it('should throw NotFoundException when product not found', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(
        service.productToOrders(productId, startDate, endDate),
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate metrics correctly', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          createdAt: new Date('2024-06-01'),
          status: OrderStatus.DELIVERED,
          total: 2000,
          orderItems: mockOrderItems,
          user: {
            id: 'user-1',
            email: 'user1@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      ]);

      const result = await service.productToOrders(
        productId,
        startDate,
        endDate,
      );

      expect(result.summary.totalQuantitySold).toBe(2);
      expect(result.summary.totalRevenue).toBe(2000);
      expect(result.summary.avgQuantityPerOrder).toBe('2.00');
    });
  });

  describe('userToOrders', () => {
    const userId = 'user-1';
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');

    const mockUser = {
      id: userId,
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
    };

    const mockOrders = [
      {
        id: 'order-1',
        createdAt: new Date('2024-06-01'),
        status: OrderStatus.DELIVERED,
        total: 1500,
        orderItems: [
          {
            id: 'item-1',
            quantity: 1,
            price: 1000,
            product: { id: 'p1', name: 'Laptop', price: 1000 },
          },
          {
            id: 'item-2',
            quantity: 1,
            price: 500,
            product: { id: 'p2', name: 'Mouse', price: 500 },
          },
        ],
      },
      {
        id: 'order-2',
        createdAt: new Date('2024-07-01'),
        status: OrderStatus.PENDING,
        total: 2000,
        orderItems: [
          {
            id: 'item-3',
            quantity: 2,
            price: 1000,
            product: { id: 'p1', name: 'Laptop', price: 1000 },
          },
        ],
      },
    ];

    it('should return user drill-down with order history', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.userToOrders(userId, startDate, endDate);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('orders');
      expect(result.user.id).toBe(userId);
      expect(result.summary.totalOrders).toBe(2);
      expect(result.orders).toHaveLength(2);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.userToOrders(userId, startDate, endDate),
      ).rejects.toThrow(NotFoundException);
    });

    it('should group orders by status', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.userToOrders(userId, startDate, endDate);

      expect(result.summary.ordersByStatus).toHaveProperty('DELIVERED');
      expect(result.summary.ordersByStatus).toHaveProperty('PENDING');
      expect(result.summary.ordersByStatus.DELIVERED).toBe(1);
      expect(result.summary.ordersByStatus.PENDING).toBe(1);
    });

    it('should calculate total spent correctly', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.userToOrders(userId, startDate, endDate);

      expect(result.summary.totalSpent).toBe(3500);
      expect(result.summary.avgOrderValue).toBe(1750);
      expect(result.summary.totalItems).toBe(4);
    });
  });

  describe('buildHierarchy', () => {
    it('should route to categoryToProducts for category level', async () => {
      mockCacheService.get.mockResolvedValue(null);
      const spy = jest
        .spyOn(service, 'categoryToProducts')
        .mockResolvedValue({} as any);

      await service.buildHierarchy('category', 'cat-1', new Date(), new Date());

      expect(spy).toHaveBeenCalled();
    });

    it('should route to productToOrders for product level', async () => {
      mockCacheService.get.mockResolvedValue(null);
      const spy = jest
        .spyOn(service, 'productToOrders')
        .mockResolvedValue({} as any);

      await service.buildHierarchy('product', 'prod-1', new Date(), new Date());

      expect(spy).toHaveBeenCalled();
    });

    it('should route to userToOrders for user level', async () => {
      mockCacheService.get.mockResolvedValue(null);
      const spy = jest
        .spyOn(service, 'userToOrders')
        .mockResolvedValue({} as any);

      await service.buildHierarchy('user', 'user-1', new Date(), new Date());

      expect(spy).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid level', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await expect(
        service.buildHierarchy(
          'invalid' as any,
          'id-1',
          new Date(),
          new Date(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should add navigation metadata', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        name: 'Test',
      });
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.buildHierarchy(
        'category',
        'cat-1',
        new Date(),
        new Date(),
      );

      expect(result).toHaveProperty('nextLevel');
      expect(result).toHaveProperty('availableActions');
      expect(result.nextLevel).toBe('product');
    });
  });
});
