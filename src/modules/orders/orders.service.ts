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
import { trace, SpanStatusCode } from '@opentelemetry/api';

import { PrometheusService } from '../../monitoring/prometheus/prometheus.service';

@Injectable()
@UseInterceptors(CacheInterceptor)
export class OrdersService {
  private tracer = trace.getTracer('orders-service');
  constructor(
    private prisma: PrismaService,
    private prometheusService: PrometheusService,
  ) {}

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
    return this.tracer.startActiveSpan('OrdersService.create', async span => {
      try {
        span.setAttributes({
          'user.id': currentUser.id,
          'user.role': currentUser.role,
          'order.item_count': createOrderDto.items.length,
        });

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
        span.addEvent('Fetched products from DB');

        // Create lookup map for O(1) access
        const productMap = new Map(products.map(p => [p.id, p]));

        // Validate all products
        for (const item of createOrderDto.items) {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new BadRequestException(`Product ${item.productId} not found`);
          }
          if ((product as any).stock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for product ${(product as any).name}`,
            );
          }
        }
        span.addEvent('Validated product stock');

        const subtotal = createOrderDto.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );
        // TODO: Calculate shipping, tax, and discount from pricing service
        const shippingCost = 0; // Will be calculated by pricing service
        const taxAmount = subtotal * 0.12; // 12% VAT
        const discountAmount = 0; // Will be calculated from coupon
        const totalAmount = subtotal + shippingCost + taxAmount - discountAmount;
        const orderNumber = this.generateOrderNumber();

        span.setAttribute('order.totalAmount_amount', totalAmount);

        const order = await this.prisma.order.create({
          data: {
            orderNumber,
            userId: createOrderDto.userId,
            status: OrderStatus.PENDING,
            subtotal: new Prisma.Decimal(subtotal),
            shippingCost: new Prisma.Decimal(shippingCost),
            taxAmount: new Prisma.Decimal(taxAmount),
            discountAmount: new Prisma.Decimal(discountAmount),
            totalAmount: new Prisma.Decimal(totalAmount),
            shippingAddress: {}, // TODO: Fetch address data from Address model using shippingAddressId
            billingAddress: {}, // TODO: Fetch address data from Address model using billingAddressId
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
                amount: new Prisma.Decimal(totalAmount),
                method: (createOrderDto.paymentMethodId as any) || 'COD',
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
        span.addEvent('Created order in DB');
        span.setAttribute('order.id', order.id);

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
        span.addEvent('Updated product stock in transaction');

        this.prometheusService.recordOrder(order.status, order.payments[0]?.method, totalAmount);

        span.setStatus({ code: SpanStatusCode.OK });
        return order;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
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

    const updateData = updateOrderDto;
    const data: any = { ...updateData };
    if (data.shippingCost !== undefined) data.shippingCost = new Prisma.Decimal(data.shippingCost);
    if (data.taxAmount !== undefined) data.taxAmount = new Prisma.Decimal(data.taxAmount);
    if (data.discountAmount !== undefined) data.discountAmount = new Prisma.Decimal(data.discountAmount);

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

    if (updateStatusDto.status === OrderStatus.CONFIRMED) {
      updateData.confirmedAt = new Date();
    } else if (updateStatusDto.status === 'COMPLETED' as any) {
      updateData.completedAt = new Date();
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
        order.confirmedAt && {
          status: OrderStatus.CONFIRMED,
          timestamp: order.confirmedAt,
        },
        order.completedAt && {
          status: 'COMPLETED' as any,
          timestamp: order.completedAt,
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
      shipping: order.shippingCost.toNumber(),
      tax: order.taxAmount.toNumber(),
      discount: order.discountAmount.toNumber(),
      total: order.totalAmount.toNumber(),
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
          _sum: { totalAmount: true },
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

    const revenueTotal = totalRevenue._sum.totalAmount?.toNumber() || 0;

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

  /**
   * Create order from cart (Phase 6 - Cart Integration)
   * Converts active cart to order, validates stock, deducts inventory
   * @param userId - User ID
   * @param cartId - Cart ID to convert
   * @param paymentMethod - Payment method for the order
   * @returns Created order
   */
  async createOrderFromCart(
    userId: string,
    cartId: string,
    paymentMethod: 'GCASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'COD' | 'BANK_TRANSFER' | 'MAYA' | 'PAYPAL',
  ) {
    return this.tracer.startActiveSpan(
      'OrdersService.createOrderFromCart',
      async (span) => {
        try {
          span.setAttributes({
            'user.id': userId,
            'cart.id': cartId,
            'payment.method': paymentMethod,
          });

          // 1. Get cart with items
          const cart = await this.prisma.cart.findUnique({
            where: { id: cartId, userId, status: 'ACTIVE' },
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      stock: true,
                      isActive: true,
                      price: true,
                      weight: true,
                    },
                  },
                },
              },
            },
          });

          if (!cart) {
            throw new NotFoundException(
              'Active cart not found for this user',
            );
          }

          if (cart.items.length === 0) {
            throw new BadRequestException('Cart is empty');
          }

          span.addEvent('Fetched cart from DB');

          // 2. Validate all items have sufficient stock and are active
          for (const item of cart.items) {
            if (!item.product.isActive) {
              throw new BadRequestException(
                `Product ${item.product.name} is no longer available`,
              );
            }

            if (item.product.stock < item.quantity) {
              throw new BadRequestException(
                `Insufficient stock for product ${item.product.name}. Available: ${item.product.stock}, Requested: ${item.quantity}`,
              );
            }
          }

          span.addEvent('Validated cart items');

          // 3. Generate order number
          const orderNumber = this.generateOrderNumber();

          // 4. Create order with items in transaction
          const order = await this.prisma.$transaction(async (tx) => {
            // Create order
            const newOrder = await tx.order.create({
              data: {
                orderNumber,
                userId,
                status: OrderStatus.PENDING,
                subtotal: cart.subtotal,
                taxAmount: cart.tax,
                shippingCost: cart.shipping,
                discountAmount: cart.discount,
                totalAmount: cart.total,
                shippingAddress: cart.metadata?.['shippingAddress'] || {},
                billingAddress: cart.metadata?.['billingAddress'] || {},
                notes: cart.metadata?.['notes'] as string,
                orderItems: {
                  create: cart.items.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.total,
                  })),
                },
                payments: {
                  create: {
                    userId,
                    amount: cart.total,
                    method: paymentMethod,
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

            // Deduct stock from products
            for (const item of cart.items) {
              await tx.product.update({
                where: { id: item.productId },
                data: {
                  stock: {
                    decrement: item.quantity,
                  },
                },
              });
            }

            // Mark cart as COMPLETED
            await tx.cart.update({
              where: { id: cartId },
              data: {
                status: 'COMPLETED',
                convertedAt: new Date(),
              },
            });

            return newOrder;
          });

          span.addEvent('Created order and updated stock');
          span.setAttribute('order.id', order.id);
          span.setAttribute('order.number', orderNumber);
          span.setAttribute('order.totalAmount', order.totalAmount.toNumber());

          // Record metrics (commented out until method is implemented)
          // this.prometheusService.recordOrderCreated(
          //   order.id,
          //   order.totalAmount.toNumber(),
          //   paymentMethod,
          // );

          span.setStatus({ code: SpanStatusCode.OK });
          return order;
        } catch (error) {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
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
