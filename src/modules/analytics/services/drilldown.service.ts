import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../common/services/cache.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class DrillDownService {
  private readonly CACHE_TTL = 1800; // 30 minutes
  private readonly CACHE_PREFIX = 'analytics:drilldown';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Drill down from category to products
   * Shows products within a category with their performance metrics
   */
  async categoryToProducts(
    categoryId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:category-products:${categoryId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Verify category exists
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, description: true },
    });

    if (!category) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }

    // Get products in this category
    const products = await this.prisma.product.findMany({
      where: {
        categories: {
          path: ['$'],
          array_contains: categoryId,
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        isActive: true,
        isFeatured: true,
        orderItems: {
          where: {
            order: {
              status: OrderStatus.DELIVERED,
              createdAt: { gte: startDate, lte: endDate },
            },
          },
          select: {
            quantity: true,
            price: true,
            total: true,
          },
        },
      },
    });

    // Calculate metrics for each product
    const productMetrics = products.map((product) => {
      const orderItems = product.orderItems;
      const totalQuantitySold = orderItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const totalRevenue = orderItems.reduce(
        (sum, item) => sum + Number(item.total),
        0,
      );
      const orderCount = orderItems.length;
      const avgOrderValue =
        orderCount > 0 ? totalRevenue / orderCount : 0;

      return {
        product: {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          stock: product.stock,
          isActive: product.isActive,
          isFeatured: product.isFeatured,
        },
        metrics: {
          totalQuantitySold,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          orderCount,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          conversionRate:
            totalQuantitySold > 0
              ? ((orderCount / totalQuantitySold) * 100).toFixed(2)
              : '0.00',
        },
      };
    });

    // Sort by revenue descending
    productMetrics.sort(
      (a, b) => b.metrics.totalRevenue - a.metrics.totalRevenue,
    );

    const result = {
      category: category,
      summary: {
        totalProducts: productMetrics.length,
        totalRevenue: productMetrics.reduce(
          (sum, p) => sum + p.metrics.totalRevenue,
          0,
        ),
        totalQuantitySold: productMetrics.reduce(
          (sum, p) => sum + p.metrics.totalQuantitySold,
          0,
        ),
        totalOrders: productMetrics.reduce(
          (sum, p) => sum + p.metrics.orderCount,
          0,
        ),
      },
      products: productMetrics,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      metadata: {
        generatedAt: new Date(),
        cacheKey,
        level: 'category-to-products',
      },
    };

    await this.cache.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  /**
   * Drill down from product to orders
   * Shows orders that include a specific product
   */
  async productToOrders(
    productId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:product-orders:${productId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        price: true,
        description: true,
        stock: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    // Get orders containing this product
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        createdAt: { gte: startDate, lte: endDate },
        orderItems: {
          some: {
            productId: productId,
          },
        },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        orderItems: {
          where: {
            productId: productId,
          },
          select: {
            id: true,
            quantity: true,
            price: true,
            total: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate order details
    const orderDetails = orders.map((order) => {
      const productItems = order.orderItems;
      const productQuantity = productItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const productRevenue = productItems.reduce(
        (sum, item) => sum + Number(item.total),
        0,
      );

      return {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: Number(order.total),
          createdAt: order.createdAt,
        },
        customer: {
          id: order.user.id,
          email: order.user.email,
          name: `${order.user.firstName} ${order.user.lastName}`,
        },
        productDetails: {
          quantity: productQuantity,
          revenue: Math.round(productRevenue * 100) / 100,
          priceAtPurchase: Number(productItems[0]?.price || 0),
        },
      };
    });

    const result = {
      product: {
        ...product,
        price: Number(product.price),
      },
      summary: {
        totalOrders: orderDetails.length,
        totalQuantitySold: orderDetails.reduce(
          (sum, o) => sum + o.productDetails.quantity,
          0,
        ),
        totalRevenue: orderDetails.reduce(
          (sum, o) => sum + o.productDetails.revenue,
          0,
        ),
        avgQuantityPerOrder:
          orderDetails.length > 0
            ? (
                orderDetails.reduce(
                  (sum, o) => sum + o.productDetails.quantity,
                  0,
                ) / orderDetails.length
              ).toFixed(2)
            : '0.00',
      },
      orders: orderDetails,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      metadata: {
        generatedAt: new Date(),
        cacheKey,
        level: 'product-to-orders',
      },
    };

    await this.cache.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  /**
   * Drill down from user to orders
   * Shows all orders for a specific user
   */
  async userToOrders(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:user-orders:${userId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Get user's orders
    const orders = await this.prisma.order.findMany({
      where: {
        userId: userId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        orderItems: {
          select: {
            id: true,
            quantity: true,
            price: true,
            total: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate order details
    const orderDetails = orders.map((order) => {
      const itemCount = order.orderItems.length;
      const totalQuantity = order.orderItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );

      return {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: Number(order.total),
          createdAt: order.createdAt,
        },
        items: {
          count: itemCount,
          totalQuantity: totalQuantity,
          products: order.orderItems.map((item) => ({
            id: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            price: Number(item.price),
            total: Number(item.total),
          })),
        },
      };
    });

    // Calculate user metrics
    const totalSpent = orderDetails.reduce(
      (sum, o) => sum + o.order.total,
      0,
    );
    const avgOrderValue =
      orderDetails.length > 0 ? totalSpent / orderDetails.length : 0;
    const totalItems = orderDetails.reduce(
      (sum, o) => sum + o.items.totalQuantity,
      0,
    );

    const result = {
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        memberSince: user.createdAt,
      },
      summary: {
        totalOrders: orderDetails.length,
        totalSpent: Math.round(totalSpent * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        totalItems: totalItems,
        ordersByStatus: this.groupOrdersByStatus(orders),
      },
      orders: orderDetails,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      metadata: {
        generatedAt: new Date(),
        cacheKey,
        level: 'user-to-orders',
      },
    };

    await this.cache.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  /**
   * Helper: Group orders by status
   */
  private groupOrdersByStatus(orders: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    orders.forEach((order) => {
      grouped[order.status] = (grouped[order.status] || 0) + 1;
    });
    return grouped;
  }

  /**
   * Build hierarchical drill-down path
   * Example: Categories -> Category -> Products -> Product -> Orders
   */
  async buildHierarchy(
    level: string,
    id: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:hierarchy:${level}:${id}:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    let result: any;

    switch (level) {
      case 'category':
        result = await this.categoryToProducts(id, startDate, endDate);
        result.nextLevel = 'product';
        result.availableActions = ['drillToProduct', 'viewCategoryDetails'];
        break;

      case 'product':
        result = await this.productToOrders(id, startDate, endDate);
        result.nextLevel = 'order';
        result.availableActions = ['drillToOrder', 'viewProductDetails'];
        break;

      case 'user':
        result = await this.userToOrders(id, startDate, endDate);
        result.nextLevel = 'order';
        result.availableActions = ['drillToOrder', 'viewUserDetails'];
        break;

      default:
        throw new NotFoundException(`Invalid drill-down level: ${level}`);
    }

    await this.cache.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }
}
