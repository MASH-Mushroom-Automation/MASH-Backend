import { Controller, Post, HttpCode, HttpStatus, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * 🌱 Product Seeding Controller
 * 
 * Provides REST API endpoint to seed products into the database.
 * Protected endpoint - requires ADMIN or SUPER_ADMIN role.
 */
@ApiTags('🌱 Database Seeding')
@ApiBearerAuth()
@Controller('api/v1/seed')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsSeedController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('products')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '🌱 Seed products into database',
    description: `
**Seed mushroom products into the database**

This endpoint allows administrators to seed the database with MASH mushroom products.

### Security:
- 🔒 Protected endpoint (requires authentication)
- 👮 Requires ADMIN or SUPER_ADMIN role
- 🔐 JWT Bearer token required

### Features:
- ✅ Checks for existing products by SKU (no duplicates)
- ✅ Creates products with complete data
- ✅ Returns detailed summary of seeding operation
- ✅ Idempotent (safe to run multiple times)

### Use Cases:
- Initial database setup
- Restore products after database reset
- Add new product catalog
- Development/staging environment setup
`,
  })
  @ApiBody({
    description: 'Optional: Provide custom products array or use default MASH products',
    required: false,
    schema: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          description: 'Array of products to seed (optional - uses default if not provided)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Fresh White Oyster Mushrooms' },
              slug: { type: 'string', example: 'fresh-white-oyster-mushrooms' },
              sku: { type: 'string', example: 'FWO-250G' },
              description: { type: 'string' },
              price: { type: 'number', example: 120 },
              stock: { type: 'number', example: 45 },
            },
          },
        },
        force: {
          type: 'boolean',
          description: 'Force overwrite existing products (WARNING: deletes existing)',
          default: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '✅ Products seeded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Products seeded successfully' },
        summary: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 9 },
            created: { type: 'number', example: 9 },
            skipped: { type: 'number', example: 0 },
            failed: { type: 'number', example: 0 },
          },
        },
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              sku: { type: 'string' },
              price: { type: 'number' },
              stock: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: '❌ Forbidden - Requires ADMIN role',
  })
  async seedProducts(@Body() body?: { products?: any[]; force?: boolean }) {
    const force = body?.force || false;
    
    // Default MASH products
    const productsData = body?.products || [
      {
        name: "Fresh White Oyster Mushrooms",
        slug: "fresh-white-oyster-mushrooms",
        sku: "FWO-250G",
        description: "Delicate, nutty flavor perfect for stir-fries and soups. Harvested daily for maximum freshness.",
        price: 120,
        comparePrice: 150,
        costPrice: 80,
        stock: 45,
        minStock: 10,
        weight: 0.25,
        images: ["/white.jpg", "/white-2.jpg", "/white-3.jpg", "/white-4.jpg"],
        category: "Fresh Mushroom",
        categories: ["Fresh Mushroom", "Oyster Mushrooms"],
        tags: ["New", "Fresh", "Popular"],
        grower: "FungiFreshFarms",
        growerId: "grower_001",
        isFeatured: true,
      },
      {
        name: "Mushroom Chips",
        slug: "mushroom-chips",
        sku: "MC-100G",
        description: "Beautiful pink caps with a meaty texture—great for sautés and vegan bacon.",
        price: 140,
        stock: 30,
        minStock: 5,
        weight: 0.25,
        images: ["/Pink-Oyster-1.webp", "/Pink-Oyster-2.webp", "/Pink-Oyster-3.webp", "/Pink-Oyster-4.webp"],
        category: "Fresh Mushroom",
        categories: ["Fresh Mushroom", "Snacks"],
        tags: ["Chips", "Snack"],
        grower: "FungiFreshFarms",
        growerId: "grower_001",
        isFeatured: false,
      },
      {
        name: "Blue Oyster Mushrooms",
        slug: "blue-oyster-mushrooms",
        sku: "BOY-200G",
        description: "Rich umami notes and dense texture—ideal for broths and roasts.",
        price: 150,
        stock: 25,
        minStock: 8,
        weight: 0.2,
        images: ["/blue-oyster-mushrooms.jpg", "/blue-1.webp", "/blue-2.webp", "/blue-3.webp"],
        category: "Fresh Mushroom",
        categories: ["Fresh Mushroom", "Oyster Mushrooms", "Premium"],
        tags: ["Fresh", "Gourmet"],
        grower: "TheMushroomPatchBukidnon",
        growerId: "grower_002",
        isFeatured: true,
      },
      {
        name: "White Oyster Mushroom Growing Kit",
        slug: "white-oyster-mushroom-growing-kit",
        sku: "WOK-2KG",
        description: "Our best-selling oyster mushroom growing kit! Perfect for beginners with complete instructions and guaranteed results.",
        price: 350,
        comparePrice: 400,
        stock: 18,
        minStock: 5,
        weight: 2.0,
        images: ["/kit-1.jpg", "/kit-2.webp", "/kit.jpg", "/kit-4.jpg"],
        category: "Growing Kits",
        categories: ["Growing Kits", "Beginner Friendly"],
        tags: ["Popular", "Best Seller", "Beginner Friendly"],
        grower: "KingFarms",
        growerId: "grower_003",
        isFeatured: true,
      },
      {
        name: "Crispy Mushroom Chicharon",
        slug: "crispy-mushroom-chicharon",
        sku: "CMC-100G",
        description: "Crunchy, savory mushroom snack—perfect with dips or as topping.",
        price: 150,
        stock: 40,
        minStock: 10,
        weight: 0.1,
        images: ["/chicharon-1.jpg", "/chicharon-2.webp", "/chicharon-3.jpg", "/chicharon-4.jpg"],
        category: "Mushroom Products",
        categories: ["Mushroom Products", "Snacks"],
        tags: ["Snack", "Crispy"],
        grower: "FungiFreshFarms",
        growerId: "grower_001",
        isFeatured: false,
      },
      {
        name: "Bagoong Mushroom",
        slug: "bagoong-mushroom",
        sku: "BM-200G",
        description: "A rich, vegan-friendly twist on classic Filipino bagoong made from savory oyster mushrooms, delivering deep umami flavor without the seafood.",
        price: 380,
        stock: 12,
        minStock: 3,
        weight: 0.2,
        images: ["/bagoong.webp", "/bagoong-2.png", "/bagoong-3.png", "/bagoong-4.png"],
        category: "Preserved Foods",
        categories: ["Preserved Foods", "Filipino Products"],
        tags: ["New", "Vegan", "Filipino"],
        grower: "FungiFreshFarms",
        growerId: "grower_001",
        isFeatured: true,
      },
      {
        name: "Blue Oyster Mushroom Growing Kit",
        slug: "blue-oyster-mushroom-growing-kit",
        sku: "BOK-2KG",
        description: "Experience the joy of growing blue oyster mushrooms in your own home! Complete beginner-friendly kit.",
        price: 370,
        stock: 15,
        minStock: 5,
        weight: 2.0,
        images: ["/blue-kit1.avif", "/blue-kit2.jpg", "/blue-kit3.avif", "/blue-kit4.jpg"],
        category: "Growing Kits",
        categories: ["Growing Kits", "Beginner Friendly"],
        tags: ["Popular", "Beginner Friendly"],
        grower: "TheMushroomPatchBukidnon",
        growerId: "grower_002",
        isFeatured: true,
      },
      {
        name: "Premium Golden Oyster Growing Kit",
        slug: "premium-golden-oyster-growing-kit",
        sku: "GOK-2KG-PREM",
        description: "Grow beautiful golden oyster mushrooms at home! This premium kit produces stunning clusters of bright yellow oyster mushrooms.",
        price: 450,
        comparePrice: 550,
        stock: 8,
        minStock: 3,
        weight: 2.0,
        images: ["/gold-kit1.webp", "/gold-kit2.jpg", "/gold-kit3.jpg", "/gold-kit4.jpg"],
        category: "Growing Kits",
        categories: ["Growing Kits", "Premium"],
        tags: ["Premium", "Gourmet"],
        grower: "KingFarms",
        growerId: "grower_003",
        isFeatured: false,
      },
      {
        name: "King Oyster Mushroom Growing Kit",
        slug: "king-oyster-mushroom-growing-kit",
        sku: "KOK-2.5KG",
        description: "Grow delicious king oyster mushrooms at home! Known for their meaty texture and robust flavor, perfect for gourmet cooking.",
        price: 420,
        stock: 10,
        minStock: 4,
        weight: 2.5,
        images: ["/king-kit1.avif", "/king-kit2.webp", "/king-kit3.jpg", "/king-kit4.avif"],
        category: "Growing Kits",
        categories: ["Growing Kits", "Beginner Friendly", "Gourmet"],
        tags: ["Beginner Friendly", "Gourmet"],
        grower: "FungiFreshFarms",
        growerId: "grower_001",
        isFeatured: false,
      },
    ];

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const createdProducts = [];
    const errors = [];

    for (const productData of productsData) {
      try {
        // Check if product exists
        const existing = await this.prisma.product.findUnique({
          where: { sku: productData.sku },
        });

        if (existing && !force) {
          skippedCount++;
          continue;
        }

        // Delete existing if force mode
        if (existing && force) {
          await this.prisma.product.delete({ where: { id: existing.id } });
        }

        // Create product
        const product = await this.prisma.product.create({
          data: {
            name: productData.name,
            description: productData.description,
            slug: productData.slug,
            sku: productData.sku,
            price: productData.price,
            comparePrice: productData.comparePrice || null,
            costPrice: productData.costPrice || null,
            stock: productData.stock,
            minStock: productData.minStock,
            weight: productData.weight,
            dimensions: {
              length: 20,
              width: 15,
              height: 10,
            },
            images: productData.images,
            categories: productData.categories,
            tags: productData.tags,
            attributes: {
              grower: productData.grower,
              growerId: productData.growerId,
              category: productData.category,
              origin: "Philippines",
              shelfLife: productData.category === "Growing Kits" ? "6 months" : "7-14 days",
              storage: productData.category === "Growing Kits" 
                ? "Store in cool, dry place" 
                : "Keep refrigerated at 2-4°C",
            },
            isActive: true,
            isFeatured: productData.isFeatured,
            isDeleted: false,
            seoTitle: `${productData.name} - Buy Online | MASH Philippines`,
            seoDescription: `${productData.description} Order ${productData.name} online from MASH. Fresh mushrooms and growing kits delivered to your door!`,
          },
        });

        successCount++;
        createdProducts.push({
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.price.toString(),
          stock: product.stock,
        });
      } catch (error) {
        errorCount++;
        errors.push({
          product: productData.name,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      message: `Products seeded successfully`,
      summary: {
        total: productsData.length,
        created: successCount,
        skipped: skippedCount,
        failed: errorCount,
      },
      products: createdProducts,
      errors: errorCount > 0 ? errors : undefined,
    };
  }
}
