import {
  Injectable,
  NotFoundException,
  ConflictException,
  UseInterceptors,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { Cacheable, CacheEvict } from '../../common/decorators/cache.decorator';
import { CacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { UpdatePriceDto } from './dto/update-price.dto';
import { Prisma } from '@prisma/client';

@Injectable()
@UseInterceptors(CacheInterceptor) // Apply caching interceptor to entire service
export class ProductsService {
  private readonly PRODUCT_CACHE_PREFIX = 'product';
  private readonly PRODUCTS_LIST_CACHE_PREFIX = 'products:list';
  private readonly PRODUCTS_SEARCH_CACHE_PREFIX = 'products:search';
  private readonly PRODUCT_TTL = 600; // 10 minutes
  private readonly SEARCH_TTL = 300; // 5 minutes (search results more volatile)

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  /**
   * Get all products with pagination and filters
   * Phase 2 Task 2.2.1: Cache products catalog
   */
  async findAll(query: ProductQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      categoryId,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isFeatured,
    } = query;

    // Generate cache key from query parameters
    const cacheKey = `${this.PRODUCTS_LIST_CACHE_PREFIX}:${JSON.stringify(query)}`;

    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = {};

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
        {
          description: { contains: search, mode: Prisma.QueryMode.insensitive },
        },
        { sku: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    // Category filter (categories is Json array, use path)
    if (categoryId) {
      where.categories = {
        path: [],
        array_contains: categoryId,
      } as any;
    }

    // Status filter (use isActive instead)
    if (status) {
      where.isActive = status === 'ACTIVE';
    }

    // Featured filter
    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.product.count({ where }),
    ]);

    const result = {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 10 minutes with tags
    await this.cacheService.set(cacheKey, result, this.PRODUCT_TTL, [
      'products',
      'products:list',
    ]);

    return result;
  }

  /**
   * Create new product
   * ✅ CACHE INVALIDATION: Invalidates products list and featured caches
   */
  @CacheEvict({
    tags: ['products', 'products:list', 'products:featured', 'products:search'],
  })
  async create(createProductDto: CreateProductDto) {
    const { slug, sku, ...rest } = createProductDto;

    // Generate slug if not provided
    const productSlug = slug || this.generateSlug(createProductDto.name);

    // Check slug uniqueness
    const existingSlug = await this.prisma.product.findUnique({
      where: { slug: productSlug },
    });
    if (existingSlug) {
      throw new ConflictException('Product slug already exists');
    }

    // Check SKU uniqueness
    if (sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { sku },
      });
      if (existingSku) {
        throw new ConflictException('Product SKU already exists');
      }
    }

    const product = await this.prisma.product.create({
      data: {
        ...rest,
        slug: productSlug,
        sku,
      },
    });

    return product;
  }

  /**
   * Get featured products
   * ✅ CACHED: 5 minutes TTL
   * Hot path - high traffic, perfect for caching
   */
  @Cacheable({
    key: 'products:featured',
    ttl: 300,
    tags: ['products', 'products:featured'],
  })
  async getFeatured() {
    return await this.prisma.product.findMany({
      where: {
        isFeatured: true,
        isActive: true,
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get products by category
   * Phase 2: Cache category products
   */
  async getByCategory(categoryId: string, query: ProductQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    // Generate cache key
    const cacheKey = `${this.PRODUCTS_LIST_CACHE_PREFIX}:category:${categoryId}:${JSON.stringify(query)}`;

    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const where: Prisma.ProductWhereInput = {
      categories: {
        path: [],
        array_contains: categoryId,
      } as any,
      isActive: true,
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    const result = {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, result, this.PRODUCT_TTL, [
      'products',
      'products:category',
      `category:${categoryId}`,
    ]);

    return result;
  }

  /**
   * Get product by ID
   * ✅ CACHED: 5 minutes TTL
   * Hot path - product details frequently viewed
   */
  @Cacheable({ key: 'product', ttl: 300, tags: ['products'] })
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  /**
   * Update product
   * ✅ CACHE INVALIDATION: Invalidates product cache on update
   */
  @CacheEvict({ tags: ['products', 'products:list', 'products:featured'] })
  async update(id: string, updateProductDto: UpdateProductDto) {
    const { slug, sku, ...rest } = updateProductDto;

    // Check if product exists
    const product = await this.findOne(id);

    // Check slug uniqueness if updating
    if (slug && slug !== product.slug) {
      const existingSlug = await this.prisma.product.findUnique({
        where: { slug },
      });
      if (existingSlug) {
        throw new ConflictException('Product slug already exists');
      }
    }

    // Check SKU uniqueness if updating
    if (sku && sku !== product.sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { sku },
      });
      if (existingSku) {
        throw new ConflictException('Product SKU already exists');
      }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        slug,
        sku,
      },
    });

    // Invalidate product caches (including search results)
    await this.cacheService.invalidateByTags([
      'products',
      'products:list',
      'products:search',
      `product:${id}`,
    ]);

    return updated;
  }

  /**
   * Soft delete product
   * Phase 2: Invalidate caches on delete
   */
  async remove(id: string) {
    await this.findOne(id); // Check if exists

    const deleted = await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate product caches (including search results)
    await this.cacheService.invalidateByTags([
      'products',
      'products:list',
      'products:search',
      `product:${id}`,
    ]);

    return deleted;
  }

  /**
   * Get product stock information
   */
  async getStock(id: string) {
    const product = await this.findOne(id);

    return {
      productId: product.id,
      sku: product.sku,
      stock: product.stock,
      minStock: product.minStock,
      isLowStock: product.stock <= product.minStock,
    };
  }

  /**
   * Update product stock
   */
  async updateStock(id: string, updateStockDto: UpdateStockDto) {
    await this.findOne(id); // Check if exists

    return this.prisma.product.update({
      where: { id },
      data: { stock: updateStockDto.quantity },
    });
  }

  /**
   * Update product price
   */
  async updatePrice(id: string, updatePriceDto: UpdatePriceDto) {
    await this.findOne(id); // Check if exists

    return this.prisma.product.update({
      where: { id },
      data: { price: updatePriceDto.price },
    });
  }

  /**
   * Search products
   * Phase 2 Task 2.3.2: Cache search results
   */
  async search(term: string, query: ProductQueryDto) {
    const { page = 1, limit = 10 } = query;

    // Generate cache key from search term and query parameters
    const cacheKey = `${this.PRODUCTS_SEARCH_CACHE_PREFIX}:${term}:${JSON.stringify(query)}`;

    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      OR: [
        { name: { contains: term, mode: Prisma.QueryMode.insensitive } },
        {
          description: { contains: term, mode: Prisma.QueryMode.insensitive },
        },
        { sku: { contains: term, mode: Prisma.QueryMode.insensitive } },
      ],
      isActive: true,
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    const result = {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache search results for 5 minutes
    await this.cacheService.set(cacheKey, result, this.SEARCH_TTL, [
      'products',
      'products:search',
    ]);

    return result;
  }

  /**
   * Toggle product active status
   * Phase 2: Invalidate caches on status change
   */
  async toggleActive(id: string) {
    const product = await this.findOne(id);

    const updated = await this.prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
    });

    // Invalidate product caches (including search results)
    await this.cacheService.invalidateByTags([
      'products',
      'products:list',
      'products:search',
      `product:${id}`,
    ]);

    return updated;
  }

  /**
   * Get related products (same category)
   */
  async getRelated(id: string) {
    const product = await this.findOne(id);

    // Get first category from categories array
    const categories = product.categories as string[];
    if (!categories || categories.length === 0) {
      return [];
    }

    return this.prisma.product.findMany({
      where: {
        id: { not: id },
        categories: {
          path: [],
          array_contains: categories[0],
        } as any,
        isActive: true,
      },
      take: 5,
    });
  }

  /**
   * Get low stock products
   */
  async getLowStock() {
    return this.prisma.product.findMany({
      where: {
        stock: {
          lte: this.prisma.product.fields.minStock,
        },
        isActive: true,
      },
      orderBy: { stock: 'asc' },
    });
  }

  /**
   * Get product reviews (placeholder - Review model not implemented)
   */
  async getReviews(id: string) {
    await this.findOne(id); // Check if exists

    // TODO: Implement when Review model is ready
    return {
      reviews: [],
      averageRating: 0,
      totalReviews: 0,
    };
  }

  /**
   * Get best sellers (placeholder - needs OrderItem aggregation)
   */
  async getBestSellers() {
    // TODO: Implement when OrderItem model is ready
    // For now, return most recently created products
    return this.prisma.product.findMany({
      where: { isActive: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Generate URL-friendly slug from product name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
