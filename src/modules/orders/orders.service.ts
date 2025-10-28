import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Cacheable, CacheEvict } from '../../common/decorators/cache.decorator';
import { CacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto, OrderStatus } from './dto/order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { Prisma } from '@prisma/client';

@Injectable()
@UseInterceptors(CacheInterceptor)
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  // 1. List all orders with filtering
  async findAll(query: OrderQueryDto) {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  images: true,
                },
              },
            },
          },
          payments: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 2. Create new order
  async create(createOrderDto: CreateOrderDto, currentUser: any) {
    if (
      createOrderDto.userId !== currentUser.id &&
      !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)
    ) {
      throw new ForbiddenException('You can only create orders for yourself');
    }

    // ✅ FIX: Batch fetch all products (eliminates N+1 query)
    const productIds = createOrderDto.items.map(item => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, stock: true },
    });

    // Create lookup map for O(1) access
    const productMap = new Map(products.map(p => [p.id, p]));

    // Validate all products
    for (const item of createOrderDto.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }
      if ((product as any).stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for product ${(product as any).name}`);
      }
    }

    const subtotal = createOrderDto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const shipping = createOrderDto.shipping || 0;
    const tax = createOrderDto.tax || 0;
    const discount = createOrderDto.discount || 0;
    const total = subtotal + shipping + tax - discount;
    const orderNumber = this.generateOrderNumber();

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        userId: createOrderDto.userId,
        status: OrderStatus.PENDING,
        subtotal: new Prisma.Decimal(subtotal),
        shipping: new Prisma.Decimal(shipping),
        tax: new Prisma.Decimal(tax),
        discount: new Prisma.Decimal(discount),
        total: new Prisma.Decimal(total),
        shippingAddress: createOrderDto.shippingAddress as unknown as Prisma.InputJsonValue,
        billingAddress: (createOrderDto.billingAddress ||
          createOrderDto.shippingAddress) as unknown as Prisma.InputJsonValue,
        notes: createOrderDto.notes,
        orderItems: {
          create: createOrderDto.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: new Prisma.Decimal(item.price),
            total: new Prisma.Decimal(item.price * item.quantity),
          })),
        },
        payments: {
          create: {
            userId: createOrderDto.userId,
            amount: new Prisma.Decimal(total),
            method: createOrderDto.paymentMethod,
            status: 'PENDING',
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        orderItems: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
    });

    // ✅ FIX: Batch stock updates in transaction (eliminates N+1 query)
    await this.prisma.$transaction(
      createOrderDto.items.map(item =>
        this.prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        }),
      ),
    );

    return order;
  }

  // 3. Get user's orders
  /**
   * ✅ CACHED: 10 minutes TTL
   * Hot path - user order history cached for performance
   */
  @Cacheable({ key: 'orders:user', ttl: 600, tags: ['orders', 'orders:user'] })
  async getUserOrders(userId: string, query: OrderQueryDto, currentUser: any) {
    if (userId !== currentUser.id && !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw new ForbiddenException('You can only view your own orders');
    }

    const { page = 1, limit = 10, status, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = { userId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  images: true,
                },
              },
            },
          },
          payments: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 4. Get order by ID
  async findOne(id: string, currentUser: any) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        orderItems: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== currentUser.id && !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw new ForbiddenException('You can only view your own orders');
    }

    return order;
  }

  // 5. Update order
  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const { userId, ...updateData } = updateOrderDto;
    const data: any = { ...updateData };
    if (data.shipping !== undefined) data.shipping = new Prisma.Decimal(data.shipping);
    if (data.tax !== undefined) data.tax = new Prisma.Decimal(data.tax);
    if (data.discount !== undefined) data.discount = new Prisma.Decimal(data.discount);

    return this.prisma.order.update({
      where: { id },
      data,
      include: {
        user: true,
        orderItems: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
    });
  }

  // 6. Delete order (soft delete)
  async remove(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  // 7. Update order status
  async updateStatus(id: string, updateStatusDto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!this.isValidStatusTransition(order.status, updateStatusDto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${updateStatusDto.status}`,
      );
    }

    const updateData: any = {
      status: updateStatusDto.status,
      notes: updateStatusDto.notes || order.notes,
    };

    if (updateStatusDto.status === OrderStatus.SHIPPED) {
      updateData.shippedAt = new Date();
    } else if (updateStatusDto.status === OrderStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
    } else if (updateStatusDto.status === OrderStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
    }

    return this.prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        user: true,
        orderItems: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
    });
  }

  // 8. Cancel order
  async cancel(id: string, cancelOrderDto: CancelOrderDto, currentUser: any) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { orderItems: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== currentUser.id && !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw new ForbiddenException('You can only cancel your own orders');
    }

    if (
      [OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED].includes(
        order.status as OrderStatus,
      )
    ) {
      throw new BadRequestException('Order cannot be cancelled at this stage');
    }

    for (const item of order.orderItems) {
      await this.prisma.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            increment: item.quantity,
          },
        },
      });
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        notes: `Cancelled: ${cancelOrderDto.reason}. ${cancelOrderDto.notes || ''}`,
      },
    });
  }

  // 9. Get order items
  async getOrderItems(id: string, currentUser: any) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== currentUser.id && !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw new ForbiddenException('You can only view your own order items');
    }

    return order.orderItems;
  }

  // 10. Get order tracking
  async getTracking(id: string, currentUser: any) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== currentUser.id && !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw new ForbiddenException('You can only view your own order tracking');
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      shippingAddress: order.shippingAddress,
      trackingNumber: order.trackingNumber,
      estimatedDelivery: null,
      statusHistory: [
        { status: OrderStatus.PENDING, timestamp: order.createdAt },
        order.shippedAt && {
          status: OrderStatus.SHIPPED,
          timestamp: order.shippedAt,
        },
        order.deliveredAt && {
          status: OrderStatus.DELIVERED,
          timestamp: order.deliveredAt,
        },
        order.cancelledAt && {
          status: OrderStatus.CANCELLED,
          timestamp: order.cancelledAt,
        },
      ].filter(Boolean),
    };
  }

  // 11. Get order invoice
  async getInvoice(id: string, currentUser: any) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        orderItems: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== currentUser.id && !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw new ForbiddenException('You can only view your own invoices');
    }

    const payment = order.payments[0];

    return {
      invoiceNumber: `INV-${order.orderNumber}`,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      customer: {
        name: `${order.user.firstName} ${order.user.lastName}`,
        email: order.user.email,
      },
      billingAddress: order.billingAddress,
      shippingAddress: order.shippingAddress,
      items: order.orderItems.map(item => ({
        product: item.product.name,
        quantity: item.quantity,
        price: item.price.toNumber(),
        total: item.total.toNumber(),
      })),
      subtotal: order.subtotal.toNumber(),
      shipping: order.shipping.toNumber(),
      tax: order.tax.toNumber(),
      discount: order.discount.toNumber(),
      total: order.total.toNumber(),
      paymentMethod: payment?.method,
      paymentStatus: payment?.status,
    };
  }

  // 12. Get order statistics
  async getStatistics(query: OrderQueryDto) {
    const { status } = query;
    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;

    const [totalOrders, totalRevenue, pendingOrders, processingOrders, completedOrders] =
      await Promise.all([
        this.prisma.order.count({ where }),
        this.prisma.order.aggregate({
          where: {
            ...where,
            payments: { some: { status: 'PAID' } },
          },
          _sum: { total: true },
        }),
        this.prisma.order.count({
          where: { ...where, status: OrderStatus.PENDING },
        }),
        this.prisma.order.count({
          where: { ...where, status: OrderStatus.PROCESSING },
        }),
        this.prisma.order.count({
          where: { ...where, status: OrderStatus.DELIVERED },
        }),
      ]);

    const revenueTotal = totalRevenue._sum.total?.toNumber() || 0;

    return {
      totalOrders,
      totalRevenue: revenueTotal,
      pendingOrders,
      processingOrders,
      completedOrders,
      averageOrderValue: totalOrders > 0 ? revenueTotal / totalOrders : 0,
    };
  }

  // 13. Process payment
  async processPayment(id: string, currentUser: any) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== currentUser.id && !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw new ForbiddenException('You can only process payment for your own orders');
    }

    const payment = order.payments[0];
    if (!payment) {
      throw new BadRequestException('No payment found for this order');
    }

    if (payment.status === 'PAID') {
      throw new BadRequestException('Order is already paid');
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        processedAt: new Date(),
      },
    });

    return this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.PROCESSING,
      },
      include: {
        payments: true,
      },
    });
  }

  // 14. Update shipping information
  async updateShipping(id: string, shippingData: any) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const updateData: any = {
      status: OrderStatus.SHIPPED,
      shippedAt: new Date(),
    };

    if (shippingData.trackingNumber) {
      updateData.trackingNumber = shippingData.trackingNumber;
    }

    if (shippingData.shippingAddress) {
      updateData.shippingAddress = shippingData.shippingAddress as unknown as Prisma.InputJsonValue;
    }

    return this.prisma.order.update({
      where: { id },
      data: updateData,
    });
  }

  // Helper: Generate unique order number
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  // Helper: Validate status transitions
  private isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }
}
