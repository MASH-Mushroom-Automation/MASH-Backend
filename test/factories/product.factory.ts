/**
 * Product Factory
 *
 * Factory for creating test Product instances with realistic fake data.
 */

import { faker } from '@faker-js/faker';
import { ProductStatus, ProductCategory } from '@prisma/client';

export interface ProductFactoryOptions {
  id?: string;
  name?: string;
  description?: string;
  sku?: string;
  category?: ProductCategory;
  price?: number;
  discountPrice?: number;
  stock?: number;
  lowStockThreshold?: number;
  unit?: string;
  weight?: number;
  images?: string[];
  tags?: string[];
  status?: ProductStatus;
  isActive?: boolean;
  isFeatured?: boolean;
  growerId?: string;
  metadata?: any;
}

export class ProductFactory {
  /**
   * Mushroom varieties for realistic test data
   */
  private static mushroomVarieties = [
    'Oyster Mushroom',
    'Shiitake Mushroom',
    'Button Mushroom',
    'Enoki Mushroom',
    "Lion's Mane",
    'Reishi Mushroom',
    'Cordyceps',
    'Portobello',
    'Crimini',
    'Maitake',
  ];

  /**
   * Create a single product with optional overrides
   */
  static create(overrides?: Partial<ProductFactoryOptions>) {
    const name = overrides?.name || faker.helpers.arrayElement(this.mushroomVarieties);
    const basePrice = faker.number.float({
      min: 50,
      max: 500,
      fractionDigits: 2,
    });
    const hasDiscount = faker.datatype.boolean();

    return {
      id: overrides?.id || faker.string.uuid(),
      name,
      description: overrides?.description || faker.commerce.productDescription(),
      sku: overrides?.sku || `MSH-${faker.string.alphanumeric(8).toUpperCase()}`,
      category: overrides?.category || faker.helpers.arrayElement(Object.values(ProductCategory)),
      price: overrides?.price || basePrice,
      discountPrice: overrides?.discountPrice || (hasDiscount ? basePrice * 0.8 : null),
      stock:
        overrides?.stock !== undefined ? overrides.stock : faker.number.int({ min: 0, max: 500 }),
      lowStockThreshold: overrides?.lowStockThreshold || 10,
      unit: overrides?.unit || faker.helpers.arrayElement(['kg', 'g', 'pack', 'piece']),
      weight: overrides?.weight || faker.number.float({ min: 0.1, max: 5, fractionDigits: 2 }),
      images: overrides?.images || [
        faker.image.url({ width: 800, height: 600 }),
        faker.image.url({ width: 800, height: 600 }),
      ],
      tags:
        overrides?.tags ||
        faker.helpers.arrayElements(['organic', 'fresh', 'local', 'premium', 'bestseller'], {
          min: 1,
          max: 3,
        }),
      status: overrides?.status || ProductStatus.ACTIVE,
      isActive: overrides?.isActive !== undefined ? overrides.isActive : true,
      isFeatured:
        overrides?.isFeatured !== undefined ? overrides.isFeatured : faker.datatype.boolean(),
      growerId: overrides?.growerId || faker.string.uuid(),
      metadata: overrides?.metadata || {
        strain: faker.helpers.arrayElement(['P. ostreatus', 'L. edodes', 'A. bisporus']),
        growthCycle: faker.number.int({ min: 7, max: 30 }),
        harvestDate: faker.date.recent({ days: 7 }).toISOString(),
        certifications: faker.helpers.arrayElements(['Organic', 'GAP', 'HACCP'], {
          min: 0,
          max: 2,
        }),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Create product with low stock
   */
  static createLowStock(overrides?: Partial<ProductFactoryOptions>) {
    return this.create({
      ...overrides,
      stock: 5,
      lowStockThreshold: 10,
    });
  }

  /**
   * Create out of stock product
   */
  static createOutOfStock(overrides?: Partial<ProductFactoryOptions>) {
    return this.create({
      ...overrides,
      stock: 0,
      status: ProductStatus.OUT_OF_STOCK,
    });
  }

  /**
   * Create featured product
   */
  static createFeatured(overrides?: Partial<ProductFactoryOptions>) {
    return this.create({
      ...overrides,
      isFeatured: true,
      status: ProductStatus.ACTIVE,
      stock: faker.number.int({ min: 50, max: 200 }),
    });
  }

  /**
   * Create product with discount
   */
  static createWithDiscount(overrides?: Partial<ProductFactoryOptions>) {
    const price = overrides?.price || faker.number.float({ min: 100, max: 500, fractionDigits: 2 });
    const discountPercent = faker.number.int({ min: 10, max: 50 });

    return this.create({
      ...overrides,
      price,
      discountPrice: price * (1 - discountPercent / 100),
    });
  }

  /**
   * Create inactive product
   */
  static createInactive(overrides?: Partial<ProductFactoryOptions>) {
    return this.create({
      ...overrides,
      isActive: false,
      status: ProductStatus.INACTIVE,
    });
  }

  /**
   * Create organic product
   */
  static createOrganic(overrides?: Partial<ProductFactoryOptions>) {
    return this.create({
      ...overrides,
      tags: ['organic', 'fresh', 'certified'],
      metadata: {
        strain: faker.helpers.arrayElement(['P. ostreatus', 'L. edodes']),
        growthCycle: faker.number.int({ min: 7, max: 30 }),
        harvestDate: faker.date.recent({ days: 3 }).toISOString(),
        certifications: ['Organic', 'GAP'],
        pesticidesUsed: false,
        organicCertificationNumber: `ORG-${faker.string.alphanumeric(10).toUpperCase()}`,
      },
    });
  }

  /**
   * Create multiple products
   */
  static createMany(count: number, overrides?: Partial<ProductFactoryOptions>) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create products for a specific grower
   */
  static createForGrower(growerId: string, count: number = 5) {
    return this.createMany(count, { growerId });
  }

  /**
   * Create product set with variety
   */
  static createVarietySet() {
    return {
      active: this.createMany(10, { status: ProductStatus.ACTIVE }),
      lowStock: this.createMany(3, { stock: 5 }),
      outOfStock: this.createMany(2, {
        stock: 0,
        status: ProductStatus.OUT_OF_STOCK,
      }),
      featured: this.createMany(5, { isFeatured: true }),
      discounted: this.createMany(7, {
        discountPrice: faker.number.float({
          min: 50,
          max: 200,
          fractionDigits: 2,
        }),
      }),
    };
  }

  /**
   * Create product by category
   */
  static createByCategory(category: ProductCategory, count: number = 5) {
    return this.createMany(count, { category });
  }

  /**
   * Create mushroom spawn product
   */
  static createSpawn(overrides?: Partial<ProductFactoryOptions>) {
    return this.create({
      ...overrides,
      category: ProductCategory.SPAWN,
      name: `${faker.helpers.arrayElement(this.mushroomVarieties)} Spawn`,
      unit: 'bag',
      metadata: {
        strain: faker.helpers.arrayElement(['P. ostreatus', 'L. edodes', 'P. florida']),
        substrate: faker.helpers.arrayElement(['Grain', 'Sawdust', 'Straw']),
        colonizationRate: `${faker.number.int({ min: 70, max: 100 })}%`,
        shelfLife: `${faker.number.int({ min: 30, max: 90 })} days`,
      },
    });
  }

  /**
   * Create equipment product
   */
  static createEquipment(overrides?: Partial<ProductFactoryOptions>) {
    const equipmentTypes = [
      'Humidifier',
      'Growing Tent',
      'Air Filter',
      'Thermometer',
      'Hygrometer',
      'LED Grow Light',
      'Misting System',
    ];

    return this.create({
      ...overrides,
      category: ProductCategory.EQUIPMENT,
      name: faker.helpers.arrayElement(equipmentTypes),
      unit: 'piece',
      price: faker.number.float({ min: 500, max: 5000, fractionDigits: 2 }),
    });
  }
}
