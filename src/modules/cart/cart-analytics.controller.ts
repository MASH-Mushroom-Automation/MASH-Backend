import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@ApiTags('Cart Analytics (Admin)')
@Controller('api/v1/admin/cart')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CartAnalyticsController {
  private readonly logger = new Logger(CartAnalyticsController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get overall cart analytics
   */
  @Get('analytics')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get overall cart analytics',
    description: 'Admin-only endpoint for cart statistics',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Cart analytics data',
    schema: {
      type: 'object',
      properties: {
        totalActiveCarts: { type: 'number' },
        totalAbandonedCarts: { type: 'number' },
        totalCompletedCarts: { type: 'number' },
        averageCartValue: { type: 'number' },
        totalCartItems: { type: 'number' },
        conversionRate: { type: 'number' },
        abandonmentRate: { type: 'number' },
        guestCarts: { type: 'number' },
        authenticatedCarts: { type: 'number' },
        dateRange: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
          },
        },
      },
    },
  })
  async getCartAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    this.logger.log(`📊 Fetching cart analytics from ${start.toISOString()} to ${end.toISOString()}`);

    // Get cart status counts
    const statusCounts = await this.prisma.cart.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      _count: {
        status: true,
      },
    });

    const totalActiveCarts = statusCounts.find((s) => s.status === 'ACTIVE')?._count.status || 0;
    const totalAbandonedCarts = statusCounts.find((s) => s.status === 'ABANDONED')?._count.status || 0;
    const totalCompletedCarts = statusCounts.find((s) => s.status === 'COMPLETED')?._count.status || 0;

    // Calculate average cart value
    const avgValue = await this.prisma.cart.aggregate({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        status: 'ACTIVE',
      },
      _avg: {
        totalAmount: true,
      },
    });

    // Count total cart items
    const totalItems = await this.prisma.cartItem.count({
      where: {
        cart: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      },
    });

    // Guest vs authenticated carts
    const guestCarts = await this.prisma.cart.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        userId: null,
      },
    });

    const authenticatedCarts = await this.prisma.cart.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        userId: { not: null },
      },
    });

    // Calculate conversion and abandonment rates
    const totalCarts = totalActiveCarts + totalAbandonedCarts + totalCompletedCarts;
    const conversionRate = totalCarts > 0 ? (totalCompletedCarts / totalCarts) * 100 : 0;
    const abandonmentRate = totalCarts > 0 ? (totalAbandonedCarts / totalCarts) * 100 : 0;

    return {
      totalActiveCarts,
      totalAbandonedCarts,
      totalCompletedCarts,
      averageCartValue: avgValue._avg.total?.toNumber() || 0,
      totalCartItems: totalItems,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      abandonmentRate: parseFloat(abandonmentRate.toFixed(2)),
      guestCarts,
      authenticatedCarts,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  /**
   * Get shipping revenue breakdown
   */
  @Get('shipping-revenue')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get shipping revenue breakdown',
    description: 'Admin-only endpoint for shipping revenue analytics',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Shipping revenue data',
    schema: {
      type: 'object',
      properties: {
        totalShippingRevenue: { type: 'number' },
        averageShippingCost: { type: 'number' },
        totalShipments: { type: 'number' },
        breakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              method: { type: 'string' },
              count: { type: 'number' },
              revenue: { type: 'number' },
            },
          },
        },
        dateRange: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
          },
        },
      },
    },
  })
  async getShippingRevenue(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    this.logger.log(`🚚 Fetching shipping revenue from ${start.toISOString()} to ${end.toISOString()}`);

    // Get carts with shipping costs
    const carts = await this.prisma.cart.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        shipping: {
          gt: new Prisma.Decimal(0),
        },
        status: {
          in: ['COMPLETED', 'ACTIVE'],
        },
      },
      select: {
        shipping: true,
        metadata: true,
      },
    });

    // Calculate totals
    const totalShippingRevenue = carts.reduce(
      (sum, cart) => sum + cart.shippingCostCostCost.toNumber(),
      0,
    );

    const totalShipments = carts.length;
    const averageShippingCost = totalShipments > 0 ? totalShippingRevenue / totalShipments : 0;

    // Breakdown by shipping method (from metadata)
    const methodBreakdown = {
      STANDARD: { count: 0, revenue: 0 },
      EXPRESS: { count: 0, revenue: 0 },
      SAME_DAY: { count: 0, revenue: 0 },
    };

    carts.forEach((cart) => {
      const method = (cart.metadata as any)?.shippingMethod || 'STANDARD';
      if (methodBreakdown[method]) {
        methodBreakdown[method].count++;
        methodBreakdown[method].revenue += cart.shippingCostCostCost.toNumber();
      }
    });

    return {
      totalShippingRevenue: parseFloat(totalShippingRevenue.toFixed(2)),
      averageShippingCost: parseFloat(averageShippingCost.toFixed(2)),
      totalShipments,
      breakdown: Object.entries(methodBreakdown).map(([method, data]) => ({
        method,
        count: data.count,
        revenue: parseFloat(data.revenue.toFixed(2)),
      })),
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  /**
   * Get tax collection reports
   */
  @Get('tax-collected')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get tax collection reports',
    description: 'Admin-only endpoint for tax analytics',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Tax collection data',
    schema: {
      type: 'object',
      properties: {
        totalTaxCollected: { type: 'number' },
        averageTaxPerCart: { type: 'number' },
        totalTaxableCarts: { type: 'number' },
        breakdown: {
          type: 'object',
          properties: {
            ncr: {
              type: 'object',
              properties: {
                count: { type: 'number' },
                taxCollected: { type: 'number' },
                taxRate: { type: 'number' },
              },
            },
            province: {
              type: 'object',
              properties: {
                count: { type: 'number' },
                taxCollected: { type: 'number' },
                taxRate: { type: 'number' },
              },
            },
          },
        },
        dateRange: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
          },
        },
      },
    },
  })
  async getTaxCollected(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    this.logger.log(`💰 Fetching tax collection from ${start.toISOString()} to ${end.toISOString()}`);

    // Get carts with tax
    const carts = await this.prisma.cart.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        tax: {
          gt: new Prisma.Decimal(0),
        },
        status: {
          in: ['COMPLETED', 'ACTIVE'],
        },
      },
      select: {
        tax: true,
        subtotalAmount: true,
        metadata: true,
      },
    });

    // Calculate totals
    const totalTaxCollected = carts.reduce(
      (sum, cart) => sum + cart.tax.toNumber(),
      0,
    );

    const totalTaxableCarts = carts.length;
    const averageTaxPerCart = totalTaxableCarts > 0 ? totalTaxCollected / totalTaxableCarts : 0;

    // Breakdown by region (infer from tax rate)
    let ncrCount = 0;
    let ncrTax = 0;
    let provinceCount = 0;
    let provinceTax = 0;

    carts.forEach((cart) => {
      const taxRate = cart.tax.toNumber() / cart.subtotal.toNumber();
      
      // NCR has 12% VAT, Province has 10%
      if (taxRate >= 0.11) {
        ncrCount++;
        ncrTax += cart.tax.toNumber();
      } else {
        provinceCount++;
        provinceTax += cart.tax.toNumber();
      }
    });

    return {
      totalTaxCollected: parseFloat(totalTaxCollected.toFixed(2)),
      averageTaxPerCart: parseFloat(averageTaxPerCart.toFixed(2)),
      totalTaxableCarts,
      breakdown: {
        ncr: {
          count: ncrCount,
          taxCollected: parseFloat(ncrTax.toFixed(2)),
          taxRate: 0.12,
        },
        province: {
          count: provinceCount,
          taxCollected: parseFloat(provinceTax.toFixed(2)),
          taxRate: 0.10,
        },
      },
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  /**
   * Get active cart metrics
   */
  @Get('active-carts')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get current active cart metrics',
    description: 'Admin-only endpoint for real-time active cart data',
  })
  @ApiResponse({
    status: 200,
    description: 'Active cart metrics',
    schema: {
      type: 'object',
      properties: {
        totalActiveCarts: { type: 'number' },
        guestCarts: { type: 'number' },
        authenticatedCarts: { type: 'number' },
        totalItems: { type: 'number' },
        totalValue: { type: 'number' },
        averageCartValue: { type: 'number' },
        averageItemsPerCart: { type: 'number' },
        cartsWithItems: { type: 'number' },
        emptyCarts: { type: 'number' },
        recentActivity: {
          type: 'object',
          properties: {
            last5Minutes: { type: 'number' },
            last15Minutes: { type: 'number' },
            last1Hour: { type: 'number' },
          },
        },
      },
    },
  })
  async getActiveCarts() {
    this.logger.log('🛒 Fetching active cart metrics');

    // Count active carts
    const totalActiveCarts = await this.prisma.cart.count({
      where: { status: 'ACTIVE' },
    });

    const guestCarts = await this.prisma.cart.count({
      where: {
        status: 'ACTIVE',
        userId: null,
      },
    });

    const authenticatedCarts = await this.prisma.cart.count({
      where: {
        status: 'ACTIVE',
        userId: { not: null },
      },
    });

    // Get carts with aggregations
    const cartAggregations = await this.prisma.cart.aggregate({
      where: { status: 'ACTIVE' },
      _sum: {
        totalAmount: true,
      },
      _avg: {
        totalAmount: true,
      },
    });

    // Count total items
    const totalItems = await this.prisma.cartItem.count({
      where: {
        cart: {
          status: 'ACTIVE',
        },
      },
    });

    // Carts with items vs empty
    const cartsWithItems = await this.prisma.cart.count({
      where: {
        status: 'ACTIVE',
        items: {
          some: {},
        },
      },
    });

    const emptyCarts = totalActiveCarts - cartsWithItems;

    // Recent activity
    const now = new Date();
    const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000);
    const last15Minutes = new Date(now.getTime() - 15 * 60 * 1000);
    const last1Hour = new Date(now.getTime() - 60 * 60 * 1000);

    const recentActivity5min = await this.prisma.cart.count({
      where: {
        status: 'ACTIVE',
        lastActivityAt: { gte: last5Minutes },
      },
    });

    const recentActivity15min = await this.prisma.cart.count({
      where: {
        status: 'ACTIVE',
        lastActivityAt: { gte: last15Minutes },
      },
    });

    const recentActivity1hour = await this.prisma.cart.count({
      where: {
        status: 'ACTIVE',
        lastActivityAt: { gte: last1Hour },
      },
    });

    return {
      totalActiveCarts,
      guestCarts,
      authenticatedCarts,
      totalItems,
      totalValue: cartAggregations._sum.total?.toNumber() || 0,
      averageCartValue: cartAggregations._avg.total?.toNumber() || 0,
      averageItemsPerCart: totalActiveCarts > 0 ? totalItems / totalActiveCarts : 0,
      cartsWithItems,
      emptyCarts,
      recentActivity: {
        last5Minutes: recentActivity5min,
        last15Minutes: recentActivity15min,
        last1Hour: recentActivity1hour,
      },
    };
  }
}
