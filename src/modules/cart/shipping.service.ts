import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

export interface ShippingAddress {
  region: string;
  province: string;
  city: string;
  barangay: string;
  postalCode?: string;
  addressLine1: string;
  addressLine2?: string;
}

export interface ShippingOption {
  method: string;
  cost: Decimal;
  estimatedDays: number;
  description: string;
}

export interface ShippingCalculation {
  selectedMethod: string;
  cost: Decimal;
  estimatedDays: number;
  availableOptions: ShippingOption[];
}

/**
 * ShippingService
 * Handles shipping cost calculation for Philippines regions
 * Supports multiple shipping methods: Standard, Express, Same-Day
 */
@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  // Base shipping rates (in PHP)
  private readonly BASE_RATES = {
    STANDARD: new Decimal(50),
    EXPRESS: new Decimal(150),
    SAME_DAY: new Decimal(300),
  };

  // Regional multipliers
  private readonly REGIONAL_MULTIPLIERS = {
    NCR: 1.0, // National Capital Region (Metro Manila)
    LUZON_NORTH: 1.3, // North Luzon
    LUZON_SOUTH: 1.2, // South Luzon
    VISAYAS: 1.5, // Visayas region
    MINDANAO: 1.7, // Mindanao region
  };

  // Weight-based additional cost (PHP per kg over 1kg)
  private readonly WEIGHT_SURCHARGE_PER_KG = new Decimal(20);

  /**
   * Calculate shipping cost based on cart weight, region, and method
   * @param totalWeight - Total cart weight in kg
   * @param address - Shipping address
   * @param method - Shipping method (STANDARD, EXPRESS, SAME_DAY)
   * @returns Shipping cost in PHP
   */
  async calculateShipping(
    totalWeight: Decimal,
    address: ShippingAddress,
    method: 'STANDARD' | 'EXPRESS' | 'SAME_DAY' = 'STANDARD',
  ): Promise<Decimal> {
    this.logger.debug(
      `🚚 Calculating shipping: ${totalWeight}kg to ${address.region}, method: ${method}`,
    );

    // Get base rate for method
    const baseRate = this.BASE_RATES[method];

    // Get regional multiplier
    const region = this.determineRegion(address);
    const multiplier = this.REGIONAL_MULTIPLIERS[region] || 1.0;

    // Calculate weight surcharge (if over 1kg)
    const weightSurcharge = totalWeight.greaterThan(1)
      ? totalWeight.minus(1).mul(this.WEIGHT_SURCHARGE_PER_KG)
      : new Decimal(0);

    // Calculate final shipping cost
    const shippingCost = baseRate
      .mul(multiplier)
      .plus(weightSurcharge)
      .toDecimalPlaces(2);

    this.logger.debug(
      `💰 Shipping cost: ₱${shippingCost} (base: ₱${baseRate}, multiplier: ${multiplier}, weight surcharge: ₱${weightSurcharge})`,
    );

    return shippingCost;
  }

  /**
   * Get all available shipping options for address
   * @param totalWeight - Total cart weight in kg
   * @param address - Shipping address
   * @returns Array of shipping options
   */
  async getShippingOptions(
    totalWeight: Decimal,
    address: ShippingAddress,
  ): Promise<ShippingOption[]> {
    const region = this.determineRegion(address);
    const isSameDayAvailable = region === 'NCR'; // Same-day only in NCR

    const options: ShippingOption[] = [
      {
        method: 'STANDARD',
        cost: await this.calculateShipping(totalWeight, address, 'STANDARD'),
        estimatedDays: this.getEstimatedDays(region, 'STANDARD'),
        description: 'Standard Shipping (5-7 business days)',
      },
      {
        method: 'EXPRESS',
        cost: await this.calculateShipping(totalWeight, address, 'EXPRESS'),
        estimatedDays: this.getEstimatedDays(region, 'EXPRESS'),
        description: 'Express Shipping (2-3 business days)',
      },
    ];

    if (isSameDayAvailable) {
      options.push({
        method: 'SAME_DAY',
        cost: await this.calculateShipping(totalWeight, address, 'SAME_DAY'),
        estimatedDays: 0,
        description: 'Same-Day Delivery (order before 12PM)',
      });
    }

    return options;
  }

  /**
   * Estimate shipping for cart
   * @param totalWeight - Total cart weight in kg
   * @param address - Shipping address
   * @param preferredMethod - Optional preferred shipping method
   * @returns Shipping calculation with all options
   */
  async estimateShipping(
    totalWeight: Decimal,
    address: ShippingAddress,
    preferredMethod: 'STANDARD' | 'EXPRESS' | 'SAME_DAY' = 'STANDARD',
  ): Promise<ShippingCalculation> {
    const availableOptions = await this.getShippingOptions(
      totalWeight,
      address,
    );

    // Find selected method or default to first available
    const selectedOption =
      availableOptions.find((opt) => opt.method === preferredMethod) ||
      availableOptions[0];

    return {
      selectedMethod: selectedOption.method,
      cost: selectedOption.cost,
      estimatedDays: selectedOption.estimatedDays,
      availableOptions,
    };
  }

  /**
   * Determine region from address
   * @param address - Shipping address
   * @returns Region identifier
   */
  private determineRegion(
    address: ShippingAddress,
  ): keyof typeof this.REGIONAL_MULTIPLIERS {
    const region = address.region.toUpperCase();

    // NCR (Metro Manila)
    if (
      region.includes('NCR') ||
      region.includes('METRO MANILA') ||
      region.includes('NATIONAL CAPITAL')
    ) {
      return 'NCR';
    }

    // Luzon regions
    if (
      region.includes('ILOCOS') ||
      region.includes('CORDILLERA') ||
      region.includes('CAGAYAN')
    ) {
      return 'LUZON_NORTH';
    }

    if (
      region.includes('CENTRAL LUZON') ||
      region.includes('CALABARZON') ||
      region.includes('MIMAROPA') ||
      region.includes('BICOL')
    ) {
      return 'LUZON_SOUTH';
    }

    // Visayas
    if (
      region.includes('VISAYAS') ||
      region.includes('WESTERN VISAYAS') ||
      region.includes('CENTRAL VISAYAS') ||
      region.includes('EASTERN VISAYAS')
    ) {
      return 'VISAYAS';
    }

    // Mindanao
    if (
      region.includes('MINDANAO') ||
      region.includes('ZAMBOANGA') ||
      region.includes('NORTHERN MINDANAO') ||
      region.includes('DAVAO') ||
      region.includes('SOCCSKSARGEN') ||
      region.includes('CARAGA') ||
      region.includes('BARMM')
    ) {
      return 'MINDANAO';
    }

    // Default to Luzon South
    this.logger.warn(`⚠️ Unknown region: ${region}, defaulting to LUZON_SOUTH`);
    return 'LUZON_SOUTH';
  }

  /**
   * Get estimated delivery days for region and method
   * @param region - Region identifier
   * @param method - Shipping method
   * @returns Estimated days
   */
  private getEstimatedDays(
    region: keyof typeof this.REGIONAL_MULTIPLIERS,
    method: 'STANDARD' | 'EXPRESS' | 'SAME_DAY',
  ): number {
    const estimateMatrix = {
      NCR: { STANDARD: 1, EXPRESS: 1, SAME_DAY: 0 },
      LUZON_NORTH: { STANDARD: 5, EXPRESS: 2, SAME_DAY: 0 },
      LUZON_SOUTH: { STANDARD: 4, EXPRESS: 2, SAME_DAY: 0 },
      VISAYAS: { STANDARD: 6, EXPRESS: 3, SAME_DAY: 0 },
      MINDANAO: { STANDARD: 7, EXPRESS: 3, SAME_DAY: 0 },
    };

    return estimateMatrix[region][method];
  }

  /**
   * Validate shipping address
   * @param address - Shipping address to validate
   * @returns True if valid
   */
  validateAddress(address: ShippingAddress): boolean {
    const required = [
      'region',
      'province',
      'city',
      'barangay',
      'addressLine1',
    ];
    return required.every((field) => !!address[field]);
  }
}
