/**
 * ProductLoader - Batch loading for products
 *
 * Automatically batches multiple product lookups into a single database query
 * to eliminate N+1 query problems.
 *
 * Use Cases:
 * - Loading products for order items (1 query instead of N)
 * - Loading products for cart items
 * - Loading related products
 * - Loading products in analytics/reports
 *
 * Performance Impact:
 * - Before: N queries for N products (N+1 problem)
 * - After: 1 query for N products (batched)
 * - Improvement: 90-95% reduction in queries
 *
 * Example:
 * ```typescript
 * // In OrdersService
 * const orderItems = order.orderItems; // Has productId
 *
 * // ❌ BAD: N+1 query (1 query per product)
 * for (const item of orderItems) {
 *   const product = await this.prisma.product.findUnique({
 *     where: { id: item.productId }
 *   });
 * }
 *
 * // ✅ GOOD: Single batched query
 * const products = await Promise.all(
 *   orderItems.map(item => this.productLoader.load(item.productId))
 * );
 * ```
 */

import { Injectable, Scope } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  createEntityLoader,
  BatchLoader,
} from '../../../common/utils/dataloader.util';

/**
 * Product data structure for batch loading
 * Includes essential fields needed in most contexts
 */
export interface ProductData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: any; // Prisma Decimal type
  comparePrice: any | null; // Prisma Decimal type
  stock: number;
  sku: string | null;
  images: any[]; // JSON array
  isActive: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ProductLoader - Request-scoped batch loader for products
 *
 * This loader is request-scoped, meaning each HTTP request gets its own
 * loader instance with an isolated cache. This prevents cache leakage
 * between requests while enabling batching within a request.
 *
 * @scope REQUEST - New instance per HTTP request
 */
@Injectable({ scope: Scope.REQUEST })
export class ProductLoader {
  private loader: BatchLoader<string, ProductData | null>;

  constructor(private prisma: PrismaService) {
    // Create the batch loader with Prisma
    this.loader = createEntityLoader<ProductData>(
      async (ids: string[]) => {
        // Single query for all requested product IDs
        const products = await this.prisma.product.findMany({
          where: {
            id: { in: ids },
            isActive: true, // Only load active products
          },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            price: true,
            comparePrice: true,
            stock: true,
            sku: true,
            images: true,
            isActive: true,
            isFeatured: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return products;
      },
      {
        // Configure batch size
        maxBatchSize: 100, // Batch up to 100 products at once
        cache: true, // Enable per-request caching
      },
    );
  }

  /**
   * Load a single product by ID
   *
   * Multiple calls within the same tick are automatically batched.
   *
   * @param id - Product ID
   * @returns Product data or null if not found/inactive
   *
   * @example
   * ```typescript
   * const product = await this.productLoader.load('product-123');
   * if (product) {
   *   console.log(product.name, product.price);
   * }
   * ```
   */
  async load(id: string): Promise<ProductData | null> {
    return this.loader.load(id);
  }

  /**
   * Load multiple products by IDs
   *
   * More efficient than multiple load() calls when all IDs are known.
   *
   * @param ids - Array of product IDs
   * @returns Array of products (null for missing/inactive)
   *
   * @example
   * ```typescript
   * const products = await this.productLoader.loadMany([
   *   'product-1',
   *   'product-2',
   *   'product-3'
   * ]);
   * ```
   */
  async loadMany(ids: string[]): Promise<(ProductData | null | Error)[]> {
    return this.loader.loadMany(ids);
  }

  /**
   * Clear cache for a specific product
   *
   * Call after product updates to ensure fresh data.
   *
   * @param id - Product ID to clear
   *
   * @example
   * ```typescript
   * await this.prisma.product.update({ ... });
   * this.productLoader.clear(productId); // Invalidate cache
   * ```
   */
  clear(id: string): void {
    this.loader.clear(id);
  }

  /**
   * Clear all cached products
   *
   * Call after bulk product operations.
   *
   * @example
   * ```typescript
   * await this.prisma.product.updateMany({ ... });
   * this.productLoader.clearAll(); // Invalidate all
   * ```
   */
  clearAll(): void {
    this.loader.clearAll();
  }

  /**
   * Prime the cache with a known product value
   *
   * Useful after creating/updating a product to avoid refetching.
   *
   * @param id - Product ID
   * @param product - Product data
   *
   * @example
   * ```typescript
   * const newProduct = await this.prisma.product.create({ ... });
   * this.productLoader.prime(newProduct.id, newProduct);
   * ```
   */
  prime(id: string, product: ProductData): void {
    this.loader.prime(id, product);
  }
}
