import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { OrderStateMachineService } from '../state-machine/order-state-machine.service';
import { PrometheusService } from '../../../monitoring/prometheus/prometheus.service';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { OrderStatus, CartStatus } from '@prisma/client';
import { CreateOrderDto } from '../dto/create-order.dto';
import { CalculateOrderResponseDto } from '../dto/calculate-order.dto';

/**
 * Order Workflow Service
 * 
 * Handles complete order creation workflow:
 * 1. Cart to order conversion
 * 2. Product availability validation
 * 3. Pricing calculation
 * 4. Inventory reservation
 * 5. Order number generation
 */
@Injectable()
export class OrderWorkflowService {
  private readonly logger = new Logger(OrderWorkflowService.name);
  private tracer = trace.getTracer('order-workflow-service');

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: OrderStateMachineService,
    private readonly prometheus: PrometheusService,
  ) {}

  /**
   * Create order from cart
   * Converts an active cart to an order with full validation
   */
  async createFromCart(userId: string, shippingAddress?: any): Promise<any> {
    return this.tracer.startActiveSpan('createFromCart', async span => {
      

      try {
        span.setAttributes({
          'user.id': userId,
          'source': 'cart',
        });

        // 1. Fetch active cart with items
        const cart = await this.prisma.cart.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        if (!cart || cart.items.length === 0) {
          throw new BadRequestException('Cart is empty or not found');
        }

        span.setAttribute('cart.item_count', cart.items.length);
        this.logger.log(`Creating order from cart ${cart.id} with ${cart.items.length} items`);

        // 2. Validate product availability and stock
        await this.validateProductAvailability(cart.items);
        span.addEvent('Product availability validated');

        // 3. Calculate pricing
        const pricing = this.calculateCartPricing(cart);
        span.setAttributes({
          'order.subtotal': pricing.subtotal,
          'order.total': pricing.total,
        });

        // 4. Generate order number
        const orderNumber = await this.generateOrderNumber();
        span.setAttribute('order.number', orderNumber);

        // 5. Create order with transaction
        const order = await this.createOrderTransaction(
          cart,
          orderNumber,
          pricing,
          shippingAddress,
        );

        // 6. Clear cart
        await this.clearCart(cart.id);
        span.addEvent('Cart cleared');

        // 7. Record metrics
        this.prometheus.ordersTotal.labels(OrderStatus.PENDING, 'unknown').inc();
        

        span.setStatus({ code: SpanStatusCode.OK });
        this.logger.log(`Order ${orderNumber} created successfully from cart ${cart.id}`);

        return order;
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        
        
        throw error;
      }
    });
  }

  /**
   * Create order directly (without cart)
   */
  async createDirect(createOrderDto: CreateOrderDto, currentUser: any): Promise<any> {
    return this.tracer.startActiveSpan('createDirect', async span => {
      

      try {
        span.setAttributes({
          'user.id': currentUser.id,
          'order.item_count': createOrderDto.items.length,
        });

        // 1. Validate products
        const products = await this.validateProducts(createOrderDto.items);
        span.addEvent('Products validated');

        // 2. Validate stock
        await this.validateStock(createOrderDto.items, products);
        span.addEvent('Stock validated');

        // 3. Calculate pricing
        const pricing = this.calculateDirectPricing(createOrderDto);
        span.setAttributes({
          'order.subtotal': pricing.subtotal,
          'order.total': pricing.total,
        });

        // 4. Generate order number
        const orderNumber = await this.generateOrderNumber();
        span.setAttribute('order.number', orderNumber);

        // 5. Create order
        const order = await this.createDirectOrderTransaction(
          createOrderDto,
          orderNumber,
          pricing,
          currentUser,
        );

        // 6. Record metrics
        this.prometheus.ordersTotal.labels(OrderStatus.PENDING, 'unknown').inc();
        

        span.setStatus({ code: SpanStatusCode.OK });
        this.logger.log(`Order ${orderNumber} created successfully (direct)`);

        return order;
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        
        
        throw error;
      }
    });
  }

  /**
   * Calculate order pricing before creation (public API method)
   */
  async calculatePricing(items: any[]): Promise<CalculateOrderResponseDto> {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Tax calculation (12% VAT for Philippines)
    const taxRate = 0.12;
    const taxAmount = subtotal * taxRate;

    // Shipping calculation (basic flat rate)
    const shippingCost = this.calculateShipping(subtotal);

    // Discount (placeholder - will be enhanced with coupon service)
    const discountAmount = 0;

    const total = subtotal + taxAmount + shippingCost - discountAmount;

    return {
      subtotal,
      taxAmount,
      shippingCost,
      discountAmount,
      totalAmount: total,
      breakdown: {
        subtotalBreakdown: {
          items: subtotal,
        },
        taxBreakdown: {
          vat: taxAmount,
        },
        discountBreakdown: {},
      },
    };
  }

  /**
   * Validate product availability
   */
  private async validateProductAvailability(cartItems: any[]): Promise<void> {
    const productIds = cartItems.map(item => item.productId);

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        name: true,
        stock: true,
        isActive: true,
      },
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of cartItems) {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (!product.isActive) {
        throw new BadRequestException(`Product "${product.name}" is not available`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`,
        );
      }
    }
  }

  /**
   * Validate products for direct order creation
   */
  private async validateProducts(items: any[]): Promise<Map<string, any>> {
    const productIds = items.map(item => item.productId);

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found');
    }

    return new Map(products.map(p => [p.id, p]));
  }

  /**
   * Validate stock availability
   */
  private async validateStock(items: any[], products: Map<string, any>): Promise<void> {
    for (const item of items) {
      const product = products.get(item.productId);

      if (!product.isActive) {
        throw new BadRequestException(`Product "${product.name}" is not available`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`,
        );
      }
    }
  }

  /**
   * Calculate pricing from cart (internal method)
   */
  private calculateCartPricing(cart: any): any {
    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const taxAmount = subtotal * 0.12; // 12% VAT
    const shippingCost = this.calculateShipping(subtotal);
    const discountAmount = cart.discount || 0;

    const total = subtotal + taxAmount + shippingCost - discountAmount;

    return {
      subtotal,
      taxAmount,
      shippingCost,
      discountAmount,
      total,
    };
  }

  /**
   * Calculate pricing for direct order
   */
  private calculateDirectPricing(dto: CreateOrderDto): any {
    const subtotal = dto.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const taxAmount = subtotal * 0.12; // 12% VAT
    const shippingCost = this.calculateShipping(subtotal);
    const discountAmount = 0; // Will be calculated from coupon

    const total = subtotal + taxAmount + shippingCost - discountAmount;

    return {
      subtotal,
      taxAmount,
      shippingCost,
      discountAmount,
      total,
    };
  }

  /**
   * Calculate shipping cost
   * TODO: Integrate with ShippingService for dynamic rates
   */
  private calculateShipping(subtotal: number): number {
    // Free shipping for orders over 1000 PHP
    if (subtotal >= 1000) {
      return 0;
    }

    // Flat rate shipping
    return 100;
  }

  /**
   * Create order with transaction
   */
  private async createOrderTransaction(
    cart: any,
    orderNumber: string,
    pricing: any,
    shippingAddress?: any,
  ): Promise<any> {
    return this.prisma.$transaction(async prisma => {
      // 1. Create order
      const order = await (prisma.order.create as any)({
        data: {
          orderNumber,
          userId: cart.userId,
          status: OrderStatus.PENDING,
          paymentStatus: 'PENDING',
          subtotal: pricing.subtotal,
          totalAmount: pricing.total,
          shippingCost: pricing.shippingCost,
          taxAmount: pricing.taxAmount,
          discountAmount: pricing.discountAmount,
          shippingAddress: shippingAddress || null,
          metadata: {
            source: 'cart',
            cartId: cart.id,
          },
          orderItems: {
            create: cart.items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              total: item.price * item.quantity,
            })),
          },
        },
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // 2. Reserve inventory (decrement stock)
      for (const item of cart.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // 3. Create initial status history
      // await prisma.orderStatusHistory.create({
      //   data: {
      //     orderId: order.id,
      //     fromStatus: OrderStatus.PENDING,
      //     toStatus: OrderStatus.PENDING,
      //     changedBy: cart.userId,
      //     notes: 'Order created from cart',
      //   },
      // });

      return order;
    });
  }

  /**
   * Create order directly (without cart)
   */
  private async createDirectOrderTransaction(
    dto: CreateOrderDto,
    orderNumber: string,
    pricing: any,
    currentUser: any,
  ): Promise<any> {
    return this.prisma.$transaction(async prisma => {
      // 1. Create order
      const order = await prisma.order.create({
        data: {
          orderNumber,
          userId: dto.userId,
          status: OrderStatus.PENDING,
          // paymentStatus: 'PENDING', // Field doesn't exist in Order schema
          subtotal: pricing.subtotal,
          total: pricing.total,
          shipping: pricing.shippingCost,
          tax: pricing.taxAmount,
          discount: pricing.discountAmount,
          shippingAddress: { addressId: dto.shippingAddressId } as any,
          billingAddress: dto.billingAddressId ? ({ addressId: dto.billingAddressId } as any) : null,
          // metadata: {
          //   source: 'direct',
          //   createdBy: currentUser.id,
          // },
          orderItems: {
            create: dto.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              total: item.price * item.quantity,
            })),
          },
        },
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // 2. Reserve inventory
      for (const item of dto.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // 3. Create initial status history
      // await prisma.orderStatusHistory.create({
      //   data: {
      //     orderId: order.id,
      //     fromStatus: OrderStatus.PENDING,
      //     toStatus: OrderStatus.PENDING,
      //     changedBy: currentUser.id,
      //     notes: 'Order created directly',
      //   },
      // });

      return order;
    });
  }

  /**
   * Clear cart after order creation
   */
  private async clearCart(cartId: string): Promise<void> {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        status: CartStatus.COMPLETED,
        items: {
          deleteMany: {},
        },
      },
    });
  }

  /**
   * Generate unique order number
   * Format: ORD-YYYYMMDD-XXXXX
   */
  async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    // Get count of today's orders
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const count = await this.prisma.order.count({
      where: {
        createdAt: {
          gte: startOfDay,
        },
      },
    });

    const sequence = (count + 1).toString().padStart(5, '0');
    return `ORD-${dateStr}-${sequence}`;
  }

  /**
   * Reserve inventory for an order
   */
  async reserveInventory(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    for (const item of order.orderItems) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product || product.stock < item.quantity) {
        throw new ConflictException(
          `Cannot reserve inventory: insufficient stock for product ${item.productId}`,
        );
      }

      await this.prisma.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });
    }

    this.logger.log(`Inventory reserved for order ${order.orderNumber}`);
  }

  /**
   * Release inventory for a cancelled order
   */
  async releaseInventory(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
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

    this.logger.log(`Inventory released for order ${order.orderNumber}`);
  }
}
