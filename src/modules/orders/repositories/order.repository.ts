import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import { Prisma, Order, OrderStatus } from '@prisma/client';
import { OrderFilterDto } from '../dto/order-filter.dto';

export interface FindOptions {
  includeItems?: boolean;
  includeUser?: boolean;
  includePayments?: boolean;
  includeStatusHistory?: boolean;
  includeFulfillment?: boolean;
  includeReturns?: boolean;
}

@Injectable()
export class OrderRepository {
  private readonly logger = new Logger(OrderRepository.name);
  private readonly CACHE_TTL = 300; // 5 minutes for order details
  private readonly LIST_CACHE_TTL = 120; // 2 minutes for order lists

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Find order by ID with optional includes
   */
  async findById(id: string, options?: FindOptions): Promise<Order | null> {
    const cacheKey = this.getCacheKey('order', id);

    try {
      // Try cache first
      const cached = await this.redis.get<Order>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for order ${id}`);
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Redis get failed for ${cacheKey}:`, error);
    }

    // Build include object based on options
    const include = this.buildIncludeObject(options);

    const order = await this.prisma.order.findUnique({
      where: { id },
      include,
    });

    if (order) {
      await this.cacheOrder(cacheKey, order);
    }

    return order;
  }

  /**
   * Find order by order number
   */
  async findByOrderNumber(
    orderNumber: string,
    options?: FindOptions,
  ): Promise<Order | null> {
    const cacheKey = this.getCacheKey('order_number', orderNumber);

    try {
      const cached = await this.redis.get<Order>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Redis get failed for ${cacheKey}:`, error);
    }

    const include = this.buildIncludeObject(options);

    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include,
    });

    if (order) {
      await this.cacheOrder(cacheKey, order);
    }

    return order;
  }

  /**
   * Find orders by user ID with filters and pagination
   */
  async findByUserId(
    userId: string,
    filters?: OrderFilterDto,
    options?: FindOptions,
  ): Promise<{ orders: Order[]; total: number }> {
    const where = this.buildWhereClause({ ...filters, userId });
    const include = this.buildIncludeObject(options);
    const orderBy = this.buildOrderBy(filters);

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total };
  }

  /**
   * Find all orders with filters, sorting, and pagination
   */
  async findAll(
    filters?: OrderFilterDto,
    options?: FindOptions,
  ): Promise<{ orders: Order[]; total: number }> {
    const where = this.buildWhereClause(filters);
    const include = this.buildIncludeObject(options);
    const orderBy = this.buildOrderBy(filters);

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total };
  }

  /**
   * Create a new order
   */
  async create(data: Prisma.OrderCreateInput): Promise<Order> {
    const order = await this.prisma.order.create({
      data,
      include: {
        orderItems: true,
        user: true,
      },
    });

    // Invalidate user's order cache
    await this.invalidateUserOrdersCache(order.userId);

    return order;
  }

  /**
   * Update an existing order
   */
  async update(id: string, data: Prisma.OrderUpdateInput): Promise<Order> {
    const order = await this.prisma.order.update({
      where: { id },
      data,
      include: {
        orderItems: true,
        user: true,
      },
    });

    // Invalidate cache
    await this.invalidateOrderCache(id, order.orderNumber);
    await this.invalidateUserOrdersCache(order.userId);

    return order;
  }

  /**
   * Delete an order (soft delete recommended)
   */
  async delete(id: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new Error('Order not found');
    }

    const deleted = await this.prisma.order.delete({ where: { id } });

    // Invalidate cache
    await this.invalidateOrderCache(id, order.orderNumber);
    await this.invalidateUserOrdersCache(order.userId);

    return deleted;
  }

  /**
   * Count orders with filters
   */
  async count(filters?: OrderFilterDto): Promise<number> {
    const where = this.buildWhereClause(filters);
    return this.prisma.order.count({ where });
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters?: OrderFilterDto): Prisma.OrderWhereInput {
    if (!filters) return {};

    const where: Prisma.OrderWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.status) {
      where.status = filters.status as any;
    }

    if (filters.shippingProvider) {
      where.shippingProvider = filters.shippingProvider;
    }

    if (filters.orderNumber) {
      where.orderNumber = {
        contains: filters.orderNumber,
        mode: 'insensitive',
      };
    }

    if (filters.trackingNumber) {
      where.trackingNumber = {
        contains: filters.trackingNumber,
        mode: 'insensitive',
      };
    }

    // Amount filters
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.totalAmount = {};
      if (filters.minAmount !== undefined) {
        where.totalAmount.gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        where.totalAmount.lte = filters.maxAmount;
      }
    }

    // Date range filters
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    return where;
  }

  /**
   * Build Prisma include object
   */
  private buildIncludeObject(options?: FindOptions): Prisma.OrderInclude {
    if (!options) return {};

    const include: Prisma.OrderInclude = {};

    if (options.includeItems) {
      include.orderItems = {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      };
    }

    if (options.includeUser) {
      include.user = {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      };
    }

    if (options.includePayments) {
      include.payments = true;
    }

    if (options.includeStatusHistory) {
      include.statusHistory = {
        orderBy: {
          changedAt: 'desc',
        },
      };
    }

    if (options.includeFulfillment) {
      include.fulfillment = true;
    }

    if (options.includeReturns) {
      include.returns = true;
    }

    return include;
  }

  /**
   * Build Prisma orderBy clause
   */
  private buildOrderBy(filters?: OrderFilterDto): Prisma.OrderOrderByWithRelationInput {
    const sortBy = filters?.sortBy || 'createdAt';
    const sortOrder = filters?.sortOrder || 'desc';

    return {
      [sortBy]: sortOrder,
    };
  }

  /**
   * Generate cache key
   */
  private getCacheKey(prefix: string, identifier: string): string {
    return `order:${prefix}:${identifier}`;
  }

  /**
   * Cache order data
   */
  private async cacheOrder(key: string, order: Order): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(order), this.CACHE_TTL);
    } catch (error) {
      this.logger.warn(`Failed to cache order: ${error}`);
    }
  }

  /**
   * Invalidate order cache
   */
  private async invalidateOrderCache(id: string, orderNumber: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.delete(this.getCacheKey('order', id)),
        this.redis.delete(this.getCacheKey('order_number', orderNumber)),
      ]);
    } catch (error) {
      this.logger.warn(`Failed to invalidate order cache: ${error}`);
    }
  }

  /**
   * Invalidate user orders cache
   */
  private async invalidateUserOrdersCache(userId: string): Promise<void> {
    try {
      // Pattern-based deletion for all user order list caches
      const pattern = this.getCacheKey('user', userId) + '*';
      await this.redis.deletePattern(pattern);
    } catch (error) {
      this.logger.warn(`Failed to invalidate user orders cache: ${error}`);
    }
  }
}
