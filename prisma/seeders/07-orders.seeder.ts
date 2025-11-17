import { PrismaClient, User, Product, OrderStatus, PaymentStatus, PaymentMethod, Prisma, NotificationType } from '@prisma/client';

/**
 * Seed Orders
 * Creates 30 orders with items, payments, and status updates
 */
export async function seedOrders(
  prisma: PrismaClient,
  users: User[],
  products: Product[],
) {
  const buyers = users.filter(u => u.role === 'BUYER' || u.role === 'USER');
  const orders: any[] = [];

  const statuses = [
    { status: OrderStatus.DELIVERED, weight: 50 },
    { status: OrderStatus.SHIPPED, weight: 15 },
    { status: OrderStatus.PROCESSING, weight: 15 },
    { status: OrderStatus.CONFIRMED, weight: 10 },
    { status: OrderStatus.PENDING, weight: 7 },
    { status: OrderStatus.CANCELLED, weight: 3 },
  ];

  const paymentMethods = [
    PaymentMethod.GCASH,
    PaymentMethod.MAYA,
    PaymentMethod.CREDIT_CARD,
    PaymentMethod.BANK_TRANSFER,
  ];

  for (let i = 0; i < 30; i++) {
    const buyer = buyers[Math.floor(Math.random() * buyers.length)];
    const buyerAddress = await prisma.address.findFirst({
      where: { userId: buyer.id },
    });

    // Random order status based on weights
    const totalWeight = statuses.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    let orderStatus: OrderStatus = OrderStatus.PENDING;
    
    for (const { status, weight } of statuses) {
      if (random < weight) {
        orderStatus = status;
        break;
      }
      random -= weight;
    }

    // Select 1-5 random products
    const itemCount = Math.floor(Math.random() * 5) + 1;
    const selectedProducts = products
      .sort(() => 0.5 - Math.random())
      .slice(0, itemCount);

    const orderItems = selectedProducts.map(product => ({
      productId: product.id,
      quantity: Math.floor(Math.random() * 5) + 1,
      price: product.price,
      total: (product.price as any).mul(Math.floor(Math.random() * 5) + 1),
    }));

    const subtotal = orderItems.reduce(
      (sum, item) => (sum as any).add(item.total),
      new Prisma.Decimal(0),
    );
    const tax = (subtotal as any).mul(0.12); // 12% VAT
    const shipping = new Prisma.Decimal(100); // Flat PHP 100
    const discount = new Prisma.Decimal(0);
    const total = (subtotal as any).add(tax).add(shipping).sub(discount);

    const orderDate = new Date(
      Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000, // Last 60 days
    );

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${new Date().getFullYear()}-${String(1000 + i).padStart(5, '0')}`,
        userId: buyer.id,
        status: orderStatus,
        subtotal,
        taxAmount: tax,
        shippingCost: shipping,
        discountAmount: discount,
        totalAmount: total,
        currency: 'PHP',
        notes: Math.random() > 0.7 ? 'Please deliver during business hours' : null,
        shippingAddress: {
          firstName: buyerAddress?.firstName || buyer.firstName || 'Unknown',
          lastName: buyerAddress?.lastName || buyer.lastName || 'Unknown',
          street1: buyerAddress?.street1 || 'Address not provided',
          city: buyerAddress?.city || 'Manila',
          state: buyerAddress?.state || 'Metro Manila',
          postalCode: buyerAddress?.postalCode || '1000',
          country: 'Philippines',
          phoneNumber: buyer.phoneNumber || '+63 900 000 0000',
        },
        billingAddress: {
          firstName: buyerAddress?.firstName || buyer.firstName || 'Unknown',
          lastName: buyerAddress?.lastName || buyer.lastName || 'Unknown',
          street1: buyerAddress?.street1 || 'Address not provided',
          city: buyerAddress?.city || 'Manila',
          state: buyerAddress?.state || 'Metro Manila',
          postalCode: buyerAddress?.postalCode || '1000',
          country: 'Philippines',
          phoneNumber: buyer.phoneNumber || '+63 900 000 0000',
        },
        trackingNumber: ([OrderStatus.SHIPPED, OrderStatus.DELIVERED] as OrderStatus[]).includes(orderStatus)
          ? `TRACK${String(Math.floor(Math.random() * 9000000000) + 1000000000)}`
          : null,
        shippedAt: ([OrderStatus.SHIPPED, OrderStatus.DELIVERED] as OrderStatus[]).includes(orderStatus)
          ? new Date(orderDate.getTime() + 2 * 24 * 60 * 60 * 1000)
          : null,
        deliveredAt: orderStatus === OrderStatus.DELIVERED
          ? new Date(orderDate.getTime() + 5 * 24 * 60 * 60 * 1000)
          : null,
        cancelledAt: orderStatus === OrderStatus.CANCELLED
          ? new Date(orderDate.getTime() + 1 * 24 * 60 * 60 * 1000)
          : null,
        createdAt: orderDate,
        orderItems: {
          create: orderItems,
        },
        payments: {
          create: {
            userId: buyer.id,
            amount: total,
            currency: 'PHP',
            status: orderStatus === OrderStatus.CANCELLED
              ? PaymentStatus.FAILED
              : orderStatus === OrderStatus.PENDING
              ? PaymentStatus.PENDING
              : PaymentStatus.PAID,
            method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
            transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            gatewayResponse: {
              referenceNumber: `REF${Math.floor(Math.random() * 1000000000)}`,
              authCode: `AUTH${Math.floor(Math.random() * 1000000)}`,
            },
            processedAt: orderStatus !== OrderStatus.PENDING && orderStatus !== OrderStatus.CANCELLED
              ? new Date(orderDate.getTime() + 30 * 60 * 1000) // 30 min after order
              : null,
            failedAt: orderStatus === OrderStatus.CANCELLED
              ? new Date(orderDate.getTime() + 15 * 60 * 1000)
              : null,
          },
        },
      },
      include: {
        orderItems: true,
        payments: true,
      },
    });

    orders.push(order);

    // Create notifications for order status
    await prisma.userNotification.create({
      data: {
        userId: buyer.id,
        type: NotificationType.ORDER_UPDATE,
        title: `Order ${order.orderNumber} - ${orderStatus}`,
        message: `Your order is now ${orderStatus.toLowerCase()}`,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: orderStatus,
        },
        isRead: Math.random() > 0.3, // 70% read
        readAt: Math.random() > 0.3
          ? new Date(orderDate.getTime() + Math.random() * 24 * 60 * 60 * 1000)
          : null,
        createdAt: orderDate,
      },
    });
  }

  return orders;
}
