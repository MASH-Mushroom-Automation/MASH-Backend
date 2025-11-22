import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PrometheusService } from '../../../monitoring/prometheus/prometheus.service';

export interface PricingBreakdown {
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  shippingCost: number;
  discountAmount: number;
  total: number;
  currency: string;
  breakdown: {
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    taxes?: Array<{
      type: string;
      rate: number;
      amount: number;
    }>;
    shipping?: {
      method: string;
      cost: number;
      estimatedDays: number;
    };
    discounts?: Array<{
      code: string;
      type: string;
      amount: number;
    }>;
  };
}

export interface ShippingCalculation {
  method: string;
  cost: number;
  estimatedDays: number;
  provider?: string;
}

/**
 * Order Pricing Service
 * 
 * Handles all pricing calculations for orders:
 * - Dynamic pricing calculation
 * - Tax calculation (VAT, local taxes)
 * - Shipping cost calculation (by weight, distance, provider)
 * - Discount/coupon application
 */
@Injectable()
export class OrderPricingService {
  private readonly logger = new Logger(OrderPricingService.name);

  // Philippines tax rates
  private readonly TAX_RATES = {
    VAT: 0.12, // 12% VAT (Value Added Tax)
    ZERO_RATED: 0.0, // For exports and specific goods
  };

  // Shipping configuration
  private readonly SHIPPING_CONFIG = {
    FREE_SHIPPING_THRESHOLD: 1000, // Free shipping for orders ≥ 1000 PHP
    FLAT_RATE: 100, // Base shipping rate
    WEIGHT_RATE: 10, // PHP per kg
    DISTANCE_RATE: 5, // PHP per km (for premium shipping)
    EXPRESS_MULTIPLIER: 1.5, // 50% more for express
    SAME_DAY_MULTIPLIER: 2.0, // 100% more for same-day
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly prometheus: PrometheusService,
  ) {}

  /**
   * Calculate complete order pricing
   */
  async calculateOrderPricing(
    items: Array<{ productId: string; quantity: number; price?: number }>,
    shippingAddress?: any,
    couponCode?: string,
  ): Promise<PricingBreakdown> {
    

    try {
      // 1. Fetch product details if prices not provided
      const enrichedItems = await this.enrichItems(items);

      // 2. Calculate subtotal
      const subtotal = this.calculateSubtotal(enrichedItems);

      // 3. Calculate tax
      const { taxAmount, taxRate, taxes } = this.calculateTax(subtotal, shippingAddress);

      // 4. Calculate shipping
      const shipping = await this.calculateShipping(
        enrichedItems,
        subtotal,
        shippingAddress,
      );

      // 5. Calculate discounts
      const { discountAmount, discounts } = await this.calculateDiscounts(
        subtotal,
        couponCode,
      );

      // 6. Calculate total
      const total = subtotal + taxAmount + shipping.cost - discountAmount;

      
      

      const breakdown: PricingBreakdown = {
        subtotal,
        taxAmount,
        taxRate,
        shippingCost: shipping.cost,
        discountAmount,
        total,
        currency: 'PHP',
        breakdown: {
          items: enrichedItems.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.price,
            total: item.price * item.quantity,
          })),
          taxes,
          shipping: {
            method: shipping.method,
            cost: shipping.cost,
            estimatedDays: shipping.estimatedDays,
          },
          discounts,
        },
      };

      this.logger.debug(`Pricing calculated: Total ${total} PHP (Subtotal: ${subtotal}, Tax: ${taxAmount}, Shipping: ${shipping.cost}, Discount: ${discountAmount})`);

      return breakdown;
    } catch (error) {
      this.logger.error('Pricing calculation failed', error);
      
      throw error;
    }
  }

  /**
   * Calculate subtotal from items
   */
  private calculateSubtotal(
    items: Array<{ price: number; quantity: number }>,
  ): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  /**
   * Calculate tax (VAT for Philippines)
   */
  private calculateTax(
    subtotal: number,
    shippingAddress?: any,
  ): { taxAmount: number; taxRate: number; taxes: any[] } {
    // Default to VAT
    const taxRate = this.TAX_RATES.VAT;
    const taxAmount = subtotal * taxRate;

    const taxes = [
      {
        type: 'VAT',
        rate: taxRate,
        amount: taxAmount,
      },
    ];

    return { taxAmount, taxRate, taxes };
  }

  /**
   * Calculate shipping cost
   */
  private async calculateShipping(
    items: any[],
    subtotal: number,
    shippingAddress?: any,
  ): Promise<ShippingCalculation> {
    // Free shipping threshold
    if (subtotal >= this.SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD) {
      return {
        method: 'Standard (Free)',
        cost: 0,
        estimatedDays: 5,
      };
    }

    // Calculate total weight
    const totalWeight = items.reduce((sum, item) => {
      const weight = item.weight || 0.5; // Default 0.5kg per item
      return sum + weight * item.quantity;
    }, 0);

    // Weight-based shipping
    const weightCost = totalWeight * this.SHIPPING_CONFIG.WEIGHT_RATE;

    // Apply flat rate minimum
    const shippingCost = Math.max(this.SHIPPING_CONFIG.FLAT_RATE, weightCost);

    return {
      method: 'Standard',
      cost: shippingCost,
      estimatedDays: 5,
      provider: 'Standard Delivery',
    };
  }

  /**
   * Calculate shipping options (Standard, Express, Same-Day)
   */
  async calculateShippingOptions(
    items: any[],
    subtotal: number,
    shippingAddress?: any,
  ): Promise<ShippingCalculation[]> {
    const baseShipping = await this.calculateShipping(items, subtotal, shippingAddress);

    const options: ShippingCalculation[] = [
      baseShipping,
      {
        method: 'Express',
        cost: baseShipping.cost * this.SHIPPING_CONFIG.EXPRESS_MULTIPLIER,
        estimatedDays: 2,
        provider: 'Express Delivery',
      },
      {
        method: 'Same-Day',
        cost: baseShipping.cost * this.SHIPPING_CONFIG.SAME_DAY_MULTIPLIER,
        estimatedDays: 0,
        provider: 'Same-Day Delivery',
      },
    ];

    return options;
  }

  /**
   * Calculate discounts from coupon codes
   * TODO: Integrate with CouponService when available
   */
  private async calculateDiscounts(
    subtotal: number,
    couponCode?: string,
  ): Promise<{ discountAmount: number; discounts: any[] }> {
    if (!couponCode) {
      return { discountAmount: 0, discounts: [] };
    }

    // Placeholder - will be replaced with CouponService integration
    this.logger.warn('Coupon service not implemented - no discounts applied');

    return { discountAmount: 0, discounts: [] };
  }

  /**
   * Enrich items with product details
   */
  private async enrichItems(
    items: Array<{ productId: string; quantity: number; price?: number }>,
  ): Promise<any[]> {
    const productIds = items.map(item => item.productId);

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        name: true,
        price: true,
      },
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    return items.map(item => {
      const product = productMap.get(item.productId);
      return {
        productId: item.productId,
        productName: product?.name || 'Unknown Product',
        quantity: item.quantity,
        price: item.price || product?.price || 0,
      };
    });
  }

  /**
   * Apply volume discount (bulk purchases)
   */
  calculateVolumeDiscount(subtotal: number, itemCount: number): number {
    if (itemCount >= 10) {
      return subtotal * 0.1; // 10% discount for 10+ items
    }

    if (itemCount >= 5) {
      return subtotal * 0.05; // 5% discount for 5+ items
    }

    return 0;
  }

  /**
   * Calculate tax for a specific region (Philippines)
   */
  calculateRegionalTax(subtotal: number, region: string): number {
    // All regions in Philippines use 12% VAT
    return subtotal * this.TAX_RATES.VAT;
  }

  /**
   * Estimate delivery date based on shipping method
   */
  estimateDeliveryDate(shippingMethod: string): Date {
    const now = new Date();
    const estimatedDays = {
      'Standard': 5,
      'Express': 2,
      'Same-Day': 0,
    };

    const days = estimatedDays[shippingMethod] || 5;
    now.setDate(now.getDate() + days);

    return now;
  }

  /**
   * Get pricing configuration
   */
  getPricingConfiguration() {
    return {
      taxRates: { ...this.TAX_RATES },
      shipping: { ...this.SHIPPING_CONFIG },
    };
  }
}
