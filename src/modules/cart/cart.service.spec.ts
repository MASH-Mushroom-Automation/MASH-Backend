import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../../database/prisma.service';
import { CartCacheService } from './cart-cache.service';
import { ShippingService } from './shipping.service';
import { PrometheusService } from '../../monitoring/prometheus/prometheus.service';
import { CartStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('CartService', () => {
  let service: CartService;
  let prismaService: jest.Mocked<PrismaService>;
  let cacheService: jest.Mocked<CartCacheService>;
  let shippingService: jest.Mocked<ShippingService>;
  let prometheusService: jest.Mocked<PrometheusService>;

  const mockUserId = 'user-123';
  const mockSessionId = 'session-456';
  const mockCartId = 'cart-789';
  const mockProductId = 'product-101';
  const mockItemId = 'item-202';

  const mockProduct = {
    id: mockProductId,
    name: 'Test Product',
    price: new Decimal(100),
    stock: 10,
    isActive: true,
    sellerId: 'seller-1',
    categoryId: 'category-1',
    description: 'Test description',
    images: [],
    sku: 'SKU-001',
    createdAt: new Date(),
    updatedAt: new Date(),
    isFeatured: false,
    tags: [],
    specifications: {},
  };

  const mockCart = {
    id: mockCartId,
    userId: mockUserId,
    sessionId: null,
    status: CartStatus.ACTIVE,
    subtotal: new Decimal(200),
    tax: new Decimal(24),
    shippingCost: new Decimal(50),
    total: new Decimal(274),
    metadata: {},
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: mockItemId,
        cartId: mockCartId,
        productId: mockProductId,
        quantity: 2,
        price: new Decimal(100),
        customization: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        product: mockProduct,
      },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      cart: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      cartItem: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
      executeTransaction: jest.fn(),
    };

    const mockCacheService = {
      getCart: jest.fn(),
      setCart: jest.fn(),
      invalidateCart: jest.fn(),
      invalidateUserCarts: jest.fn(),
      invalidateSessionCarts: jest.fn(),
    };

    const mockShippingService = {
      calculateShipping: jest.fn(),
      getShippingOptions: jest.fn(),
      estimateShipping: jest.fn(),
      determineRegion: jest.fn(),
    };

    const mockPrometheusService = {
      recordCartItemAdded: jest.fn(),
      recordCartItemRemoved: jest.fn(),
      recordCartCheckout: jest.fn(),
      recordCartAbandonment: jest.fn(),
      updateActiveCarts: jest.fn(),
      recordShippingCalculation: jest.fn(),
      recordTaxCollected: jest.fn(),
      recordShippingRevenue: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CartCacheService, useValue: mockCacheService },
        { provide: ShippingService, useValue: mockShippingService },
        { provide: PrometheusService, useValue: mockPrometheusService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    prismaService = module.get(PrismaService);
    cacheService = module.get(CartCacheService);
    shippingService = module.get(ShippingService);
    prometheusService = module.get(PrometheusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateCart', () => {
    it('should throw BadRequestException when neither userId nor sessionId provided', async () => {
      await expect(service.getOrCreateCart()).rejects.toThrow(BadRequestException);
      await expect(service.getOrCreateCart()).rejects.toThrow(
        'Either userId or sessionId is required',
      );
    });

    it('should return cached cart when available', async () => {
      const cachedCart = { ...mockCart, items: mockCart.items };
      cacheService.getCart.mockResolvedValue(cachedCart as any);

      const result = await service.getOrCreateCart(mockUserId);

      expect(cacheService.getCart).toHaveBeenCalledWith(mockUserId, undefined);
      expect(result).toBeDefined();
      expect(result.id).toBe(mockCartId);
    });

    it('should fetch cart from database when cache miss', async () => {
      cacheService.getCart.mockResolvedValue(null);
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue(mockCart as any);

      const result = await service.getOrCreateCart(mockUserId);

      expect(prismaService.cart.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          status: CartStatus.ACTIVE,
        },
        include: { items: { include: { product: true } } },
      });
      expect(cacheService.setCart).toHaveBeenCalled();
      expect(result.id).toBe(mockCartId);
    });

    it('should create new cart when none exists', async () => {
      cacheService.getCart.mockResolvedValue(null);
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.cart.create as jest.Mock).mockResolvedValue({ ...mockCart, items: [] } as any);

      const result = await service.getOrCreateCart(mockUserId);

      expect(prismaService.cart.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          sessionId: undefined,
          status: CartStatus.ACTIVE,
          expiresAt: expect.any(Date),
          subtotal: new Decimal(0),
          tax: new Decimal(0),
          shippingCost: new Decimal(0),
          total: new Decimal(0),
        },
        include: { items: { include: { product: true } } },
      });
      expect(result.items).toHaveLength(0);
    });

    it('should create guest cart with sessionId', async () => {
      cacheService.getCart.mockResolvedValue(null);
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.cart.create as jest.Mock).mockResolvedValue({ ...mockCart, sessionId: mockSessionId } as any);

      await service.getOrCreateCart(undefined, mockSessionId);

      expect(prismaService.cart.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: undefined,
          sessionId: mockSessionId,
        }),
        include: { items: { include: { product: true } } },
      });
    });
  });

  describe('addItem', () => {
    const addItemDto = { productId: mockProductId, quantity: 2, customization: {} };

    beforeEach(() => {
      cacheService.getCart.mockResolvedValue(null);
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue({ ...mockCart, items: [] } as any);
    });

    it('should throw NotFoundException when product not found', async () => {
      (prismaService.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.addItem(mockUserId, undefined, addItemDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.addItem(mockUserId, undefined, addItemDto)).rejects.toThrow(
        'Product not found',
      );
    });

    it('should throw BadRequestException when product is inactive', async () => {
      (prismaService.product.findUnique as jest.Mock).mockResolvedValue({ ...mockProduct, isActive: false });

      await expect(service.addItem(mockUserId, undefined, addItemDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.addItem(mockUserId, undefined, addItemDto)).rejects.toThrow(
        'Product is not available',
      );
    });

    it('should throw BadRequestException when insufficient stock', async () => {
      (prismaService.product.findUnique as jest.Mock).mockResolvedValue({ ...mockProduct, stock: 1 });

      await expect(service.addItem(mockUserId, undefined, addItemDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.addItem(mockUserId, undefined, addItemDto)).rejects.toThrow(
        'Insufficient stock',
      );
    });

    it('should update quantity when item already in cart', async () => {
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue(mockCart as any);
      (prismaService.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prismaService.cartItem.findFirst as jest.Mock).mockResolvedValue(mockCart.items[0] as any);
      (prismaService.cartItem.update as jest.Mock).mockResolvedValue({ ...mockCart.items[0], quantity: 4 } as any);
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(mockCart as any);

      const result = await service.addItem(mockUserId, undefined, addItemDto);

      expect(prismaService.cartItem.update).toHaveBeenCalled();
      expect(prometheusService.recordCartItemAdded).toHaveBeenCalledWith(
        mockProductId,
        'authenticated',
      );
    });

    it('should create new cart item when not in cart', async () => {
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue({ ...mockCart, items: [] } as any);
      (prismaService.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prismaService.cartItem.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.cartItem.create as jest.Mock).mockResolvedValue(mockCart.items[0] as any);
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(mockCart as any);

      const result = await service.addItem(mockUserId, undefined, addItemDto);

      expect(prismaService.cartItem.create).toHaveBeenCalledWith({
        data: {
          cartId: mockCartId,
          productId: mockProductId,
          quantity: 2,
          price: mockProduct.price,
          customization: {},
        },
      });
      expect(cacheService.invalidateCart).toHaveBeenCalled();
    });

    it('should record metrics for guest cart', async () => {
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue({
        ...mockCart,
        userId: null,
        sessionId: mockSessionId,
        items: [],
      } as any);
      (prismaService.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prismaService.cartItem.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.cartItem.create as jest.Mock).mockResolvedValue(mockCart.items[0] as any);
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(mockCart as any);

      await service.addItem(undefined, mockSessionId, addItemDto);

      expect(prometheusService.recordCartItemAdded).toHaveBeenCalledWith(mockProductId, 'guest');
    });
  });

  describe('removeItem', () => {
    it('should throw NotFoundException when cart not found', async () => {
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.removeItem(mockCartId, mockItemId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when item not found', async () => {
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(mockCart as any);
      (prismaService.cartItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.removeItem(mockCartId, mockItemId)).rejects.toThrow(NotFoundException);
    });

    it('should delete item and invalidate cache', async () => {
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(mockCart as any);
      (prismaService.cartItem.findFirst as jest.Mock).mockResolvedValue(mockCart.items[0] as any);
      (prismaService.cartItem.delete as jest.Mock).mockResolvedValue(mockCart.items[0] as any);

      await service.removeItem(mockCartId, mockItemId);

      expect(prismaService.cartItem.delete).toHaveBeenCalledWith({ where: { id: mockItemId } });
      expect(prometheusService.recordCartItemRemoved).toHaveBeenCalledWith(
        mockProductId,
        'authenticated',
      );
      expect(cacheService.invalidateCart).toHaveBeenCalled();
    });

    it('should record metrics for guest cart on remove', async () => {
      const guestCart = { ...mockCart, userId: null, sessionId: mockSessionId };
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(guestCart as any);
      (prismaService.cartItem.findFirst as jest.Mock).mockResolvedValue(mockCart.items[0] as any);
      (prismaService.cartItem.delete as jest.Mock).mockResolvedValue(mockCart.items[0] as any);

      await service.removeItem(mockCartId, mockItemId);

      expect(prometheusService.recordCartItemRemoved).toHaveBeenCalledWith(mockProductId, 'guest');
    });
  });

  describe('updateItem', () => {
    const updateDto = { quantity: 5 };

    it('should throw NotFoundException when cart not found', async () => {
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.updateItem(mockCartId, mockItemId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when item not found', async () => {
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(mockCart as any);
      (prismaService.cartItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.updateItem(mockCartId, mockItemId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when insufficient stock', async () => {
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(mockCart as any);
      (prismaService.cartItem.findFirst as jest.Mock).mockResolvedValue(mockCart.items[0] as any);
      (prismaService.product.findUnique as jest.Mock).mockResolvedValue({ ...mockProduct, stock: 3 });

      await expect(service.updateItem(mockCartId, mockItemId, updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update item quantity and invalidate cache', async () => {
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(mockCart as any);
      (prismaService.cartItem.findFirst as jest.Mock).mockResolvedValue(mockCart.items[0] as any);
      (prismaService.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prismaService.cartItem.update as jest.Mock).mockResolvedValue({ ...mockCart.items[0], quantity: 5 } as any);
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(mockCart as any);

      const result = await service.updateItem(mockCartId, mockItemId, updateDto);

      expect(prismaService.cartItem.update).toHaveBeenCalledWith({
        where: { id: mockItemId },
        data: { quantity: 5 },
      });
      expect(cacheService.invalidateCart).toHaveBeenCalled();
    });
  });

  describe('clearCart', () => {
    it('should throw NotFoundException when cart not found', async () => {
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.clearCart(mockCartId)).rejects.toThrow(NotFoundException);
    });

    it('should delete all items and invalidate cache', async () => {
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(mockCart as any);
      (prismaService.cartItem.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

      await service.clearCart(mockCartId);

      expect(prismaService.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: mockCartId },
      });
      expect(cacheService.invalidateCart).toHaveBeenCalled();
    });
  });

  describe('getCartSummary', () => {
    it('should return cart summary with item count and availability', async () => {
      cacheService.getCart.mockResolvedValue(null);
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue(mockCart as any);

      const result = await service.getCartSummary(mockUserId);

      expect(result).toEqual({
        itemCount: 2,
        total: expect.any(Number),
        hasUnavailableItems: false,
        hasOutOfStockItems: false,
      });
    });

    it('should detect out of stock items', async () => {
      const cartWithOOS = {
        ...mockCart,
        items: [{ ...mockCart.items[0], product: { ...mockProduct, stock: 0 } }],
      };
      cacheService.getCart.mockResolvedValue(null);
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue(cartWithOOS as any);

      const result = await service.getCartSummary(mockUserId);

      expect(result.hasOutOfStockItems).toBe(true);
    });

    it('should detect inactive products', async () => {
      const cartWithInactive = {
        ...mockCart,
        items: [{ ...mockCart.items[0], product: { ...mockProduct, isActive: false } }],
      };
      cacheService.getCart.mockResolvedValue(null);
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue(cartWithInactive as any);

      const result = await service.getCartSummary(mockUserId);

      expect(result.hasUnavailableItems).toBe(true);
    });
  });

  describe('validateCart', () => {
    it('should return empty issues for valid cart', async () => {
      cacheService.getCart.mockResolvedValue(null);
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue(mockCart as any);
      (prismaService.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      const result = await service.validateCart(mockUserId);

      expect(result.issues).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it('should detect out of stock issues', async () => {
      cacheService.getCart.mockResolvedValue(null);
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue(mockCart as any);
      (prismaService.product.findUnique as jest.Mock).mockResolvedValue({ ...mockProduct, stock: 1 });

      const result = await service.validateCart(mockUserId);

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].type).toBe('OUT_OF_STOCK');
      expect(result.isValid).toBe(false);
    });

    it('should detect inactive product issues', async () => {
      cacheService.getCart.mockResolvedValue(null);
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue(mockCart as any);
      (prismaService.product.findUnique as jest.Mock).mockResolvedValue({ ...mockProduct, isActive: false });

      const result = await service.validateCart(mockUserId);

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].type).toBe('UNAVAILABLE');
      expect(result.isValid).toBe(false);
    });

    it('should detect price changes', async () => {
      cacheService.getCart.mockResolvedValue(null);
      (prismaService.cart.findFirst as jest.Mock).mockResolvedValue(mockCart as any);
      (prismaService.product.findUnique as jest.Mock).mockResolvedValue({ ...mockProduct, price: new Decimal(150) });

      const result = await service.validateCart(mockUserId);

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].type).toBe('PRICE_CHANGED');
      expect(result.isValid).toBe(false);
    });
  });
});
