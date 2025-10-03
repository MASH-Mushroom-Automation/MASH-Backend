import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { UpdatePriceDto } from './dto/update-price.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all products with pagination and filters
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

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create new product
   */
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

    return this.prisma.product.create({
      data: {
        ...rest,
        slug: productSlug,
        sku,
      },
    });
  }

  /**
   * Get featured products
   */
  async getFeatured() {
    return this.prisma.product.findMany({
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
   */
  async getByCategory(categoryId: string, query: ProductQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

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

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get product by ID
   */
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
   */
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

    return this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        slug,
        sku,
      },
    });
  }

  /**
   * Soft delete product
   */
  async remove(id: string) {
    await this.findOne(id); // Check if exists

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
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
   */
  async search(term: string, query: ProductQueryDto) {
    const { page = 1, limit = 10 } = query;
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

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Toggle product active status
   */
  async toggleActive(id: string) {
    const product = await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
    });
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
