import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { Cacheable, CacheEvict } from '../../common/decorators/cache.decorator';
import { CacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';

@Injectable()
@UseInterceptors(CacheInterceptor)
export class CategoriesService {
  // Cache configuration
  private readonly CATEGORY_CACHE_PREFIX = 'category';
  private readonly CATEGORIES_LIST_CACHE_PREFIX = 'categories:list';
  private readonly CATEGORY_TREE_CACHE_KEY = 'categories:tree';
  private readonly CATEGORY_TTL = 600; // 10 minutes (categories don't change often)

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  /**
   * 1. Find all categories with pagination and filtering
   * ✅ CACHED: 10 minutes TTL
   * Hot path - categories rarely change, perfect for caching
   */
  @Cacheable({
    key: 'categories:list',
    ttl: 600,
    tags: ['categories', 'categories:list'],
  })
  async findAll(query: CategoryQueryDto) {
    const { page = 1, limit = 10, search, parentId, isActive } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Apply filters
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (parentId !== undefined) {
      where.parentId = parentId === 'null' ? null : parentId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          children: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      data: categories,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 2. Create new category
   * Phase 2: Invalidate caches on create
   */
  async create(createCategoryDto: CreateCategoryDto) {
    const { slug, parentId } = createCategoryDto;

    // Check slug uniqueness
    const existingCategory = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (existingCategory) {
      throw new BadRequestException(
        `Category with slug '${slug}' already exists`,
      );
    }

    // Validate parent category exists
    if (parentId) {
      const parentCategory = await this.prisma.category.findUnique({
        where: { id: parentId },
      });

      if (!parentCategory) {
        throw new NotFoundException(
          `Parent category with ID '${parentId}' not found`,
        );
      }
    }

    const category = await this.prisma.category.create({
      data: createCategoryDto,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Invalidate category caches
    await this.cacheService.invalidateByTags(['categories', 'categories:list']);

    return category;
  }

  /**
   * 3. Get category tree (hierarchical structure)
   * Phase 2: Cache category tree (critical for navigation)
   */
  async getCategoryTree() {
    // Try cache first
    const cached = await this.cacheService.get(this.CATEGORY_TREE_CACHE_KEY);
    if (cached) {
      return cached;
    }

    // Get all active categories
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Build tree structure
    const buildTree = (parentId: string | null = null): any[] => {
      return categories
        .filter((cat) => cat.parentId === parentId)
        .map((cat) => ({
          ...cat,
          children: buildTree(cat.id),
        }));
    };

    const tree = buildTree();

    // Cache for 10 minutes
    await this.cacheService.set(
      this.CATEGORY_TREE_CACHE_KEY,
      tree,
      this.CATEGORY_TTL,
      ['categories', 'categories:tree'],
    );

    return tree;
  }

  /**
   * 4. Find one category by ID
   * Phase 2: Cache individual categories
   */
  async findOne(id: string) {
    const cacheKey = `${this.CATEGORY_CACHE_PREFIX}:${id}`;

    // Try cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, category, this.CATEGORY_TTL, [
      'categories',
      `category:${id}`,
    ]);

    return category;
  }

  /**
   * 5. Update category
   * Phase 2: Invalidate caches on update
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    // Check slug uniqueness if updating slug
    if (updateCategoryDto.slug && updateCategoryDto.slug !== category.slug) {
      const existingCategory = await this.prisma.category.findUnique({
        where: { slug: updateCategoryDto.slug },
      });

      if (existingCategory) {
        throw new BadRequestException(
          `Category with slug '${updateCategoryDto.slug}' already exists`,
        );
      }
    }
    // Validate parent category if updating parentId
    if (updateCategoryDto.parentId) {
      // Prevent category from being its own parent
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      const parentCategory = await this.prisma.category.findUnique({
        where: { id: updateCategoryDto.parentId },
      });

      if (!parentCategory) {
        throw new NotFoundException(
          `Parent category with ID '${updateCategoryDto.parentId}' not found`,
        );
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Invalidate category caches
    await this.cacheService.invalidateByTags([
      'categories',
      'categories:list',
      'categories:tree',
      `category:${id}`,
    ]);

    return updated;
  }

  /**
   * 6. Soft delete category
   * Phase 2: Invalidate caches on delete
   */
  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        children: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    // Check if category has children
    if (category.children && category.children.length > 0) {
      throw new BadRequestException(
        'Cannot delete category with child categories. Delete children first.',
      );
    }

    // Soft delete by setting isActive = false
    const deleted = await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate category caches
    await this.cacheService.invalidateByTags([
      'categories',
      'categories:list',
      'categories:tree',
      `category:${id}`,
    ]);

    return deleted;
  }

  /**
   * 7. Get child categories
   */
  async getChildren(id: string) {
    // ✅ FIX: Single query with include (eliminates N+1)
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        children: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    return category.children;
  }

  /**
   * 8. Get products in category
   */
  async getCategoryProducts(id: string, query: CategoryQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    // Get all products where categories JSON array contains this category ID
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
      },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        comparePrice: true,
        stock: true,
        images: true,
        categories: true,
        isFeatured: true,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter products where categories array includes this category ID
    const filteredProducts = products.filter((product) => {
      const categories = product.categories;
      if (Array.isArray(categories)) {
        return categories.includes(id);
      }
      return false;
    });

    return {
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
      },
      data: filteredProducts,
      meta: {
        total: filteredProducts.length,
        page,
        limit,
        totalPages: Math.ceil(filteredProducts.length / limit),
      },
    };
  }
}
