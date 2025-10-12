import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { UpdatePriceDto } from './dto/update-price.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SelectableFields } from '../../common/decorators/selectable-fields.decorator';
import { ThrottleEndpoint } from '../../common/decorators/throttle-endpoint.decorator';

@ApiTags('Products')
@Controller('products')
@ThrottleEndpoint('STANDARD') // Standard CRUD operations - 100 req/min
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // 1. GET /products - List all products with filters
  @Get()
  @SelectableFields({
    allowedFields: [
      'id',
      'name',
      'slug',
      'description',
      'price',
      'stock',
      'minStock',
      'sku',
      'images',
      'categoryId',
      'isActive',
      'isFeatured',
      'createdAt',
      'updatedAt',
    ],
    requiredFields: ['id', 'name', 'price'],
    defaultFields: ['id', 'name', 'slug', 'price', 'stock', 'images'],
    maxFields: 15,
  })
  @ApiOperation({ summary: 'List all products with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  async findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  // 2. POST /products - Create new product (admin only)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new product' })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  // 3. GET /products/featured - Get featured products
  @Get('featured')
  @SelectableFields({
    allowedFields: [
      'id',
      'name',
      'slug',
      'description',
      'price',
      'stock',
      'images',
      'categoryId',
    ],
    requiredFields: ['id', 'name', 'price'],
    defaultFields: ['id', 'name', 'slug', 'price', 'images'],
  })
  @ApiOperation({ summary: 'Get featured products' })
  @ApiResponse({
    status: 200,
    description: 'Featured products retrieved successfully',
  })
  async getFeatured() {
    return this.productsService.getFeatured();
  }

  // 4. GET /products/category/:categoryId - Get products by category
  @Get('category/:categoryId')
  @SelectableFields({
    allowedFields: [
      'id',
      'name',
      'slug',
      'description',
      'price',
      'stock',
      'images',
      'categoryId',
      'isActive',
    ],
    requiredFields: ['id', 'name', 'price'],
    defaultFields: ['id', 'name', 'slug', 'price', 'stock', 'images'],
  })
  @ApiOperation({ summary: 'Get products by category' })
  @ApiResponse({
    status: 200,
    description: 'Category products retrieved successfully',
  })
  async getByCategory(
    @Param('categoryId') categoryId: string,
    @Query() query: ProductQueryDto,
  ) {
    return this.productsService.getByCategory(categoryId, query);
  }

  // 5. GET /products/:id - Get product by ID
  @Get(':id')
  @SelectableFields({
    allowedFields: [
      'id',
      'name',
      'slug',
      'description',
      'price',
      'stock',
      'minStock',
      'sku',
      'images',
      'categoryId',
      'isActive',
      'isFeatured',
      'createdAt',
      'updatedAt',
    ],
    requiredFields: ['id'],
    defaultFields: [
      'id',
      'name',
      'slug',
      'description',
      'price',
      'stock',
      'images',
      'categoryId',
    ],
  })
  @ApiOperation({ summary: 'Get product details by ID' })
  @ApiResponse({
    status: 200,
    description: 'Product retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // 6. PUT /products/:id - Update product (admin only)
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product information' })
  @ApiResponse({
    status: 200,
    description: 'Product updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  // 7. DELETE /products/:id - Delete product (admin only)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product (soft delete)' })
  @ApiResponse({
    status: 204,
    description: 'Product deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  // 8. GET /products/:id/stock - Get product stock
  @Get(':id/stock')
  @ApiOperation({ summary: 'Get current product stock level' })
  @ApiResponse({
    status: 200,
    description: 'Stock information retrieved successfully',
  })
  async getStock(@Param('id') id: string) {
    return this.productsService.getStock(id);
  }

  // 9. PUT /products/:id/stock - Update product stock (admin only)
  @Put(':id/stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product stock quantity' })
  @ApiResponse({
    status: 200,
    description: 'Stock updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async updateStock(
    @Param('id') id: string,
    @Body() updateStockDto: UpdateStockDto,
  ) {
    return this.productsService.updateStock(id, updateStockDto);
  }

  // 10. PUT /products/:id/price - Update product price (admin only)
  @Put(':id/price')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product price' })
  @ApiResponse({
    status: 200,
    description: 'Price updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async updatePrice(
    @Param('id') id: string,
    @Body() updatePriceDto: UpdatePriceDto,
  ) {
    return this.productsService.updatePrice(id, updatePriceDto);
  }

  // 11. GET /products/search/:term - Search products
  @Get('search/:term')
  @ApiOperation({ summary: 'Search products by name or description' })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
  })
  async search(@Param('term') term: string, @Query() query: ProductQueryDto) {
    return this.productsService.search(term, query);
  }

  // 12. POST /products/:id/activate - Activate/deactivate product (admin only)
  @Post(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate or deactivate product' })
  @ApiResponse({
    status: 200,
    description: 'Product activation status updated',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async toggleActive(@Param('id') id: string) {
    return this.productsService.toggleActive(id);
  }

  // 13. GET /products/:id/related - Get related products
  @Get(':id/related')
  @ApiOperation({ summary: 'Get related products based on category' })
  @ApiResponse({
    status: 200,
    description: 'Related products retrieved successfully',
  })
  async getRelated(@Param('id') id: string) {
    return this.productsService.getRelated(id);
  }

  // 14. GET /products/low-stock - Get low stock products (admin only)
  @Get('inventory/low-stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get products with low stock levels' })
  @ApiResponse({
    status: 200,
    description: 'Low stock products retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async getLowStock() {
    return this.productsService.getLowStock();
  }

  // 15. GET /products/:id/reviews - Get product reviews
  @Get(':id/reviews')
  @ApiOperation({ summary: 'Get product reviews and ratings' })
  @ApiResponse({
    status: 200,
    description: 'Product reviews retrieved successfully',
  })
  async getReviews(@Param('id') id: string) {
    return this.productsService.getReviews(id);
  }

  // 16. GET /products/analytics/best-sellers - Get best-selling products (admin)
  @Get('analytics/best-sellers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get best-selling products analytics' })
  @ApiResponse({
    status: 200,
    description: 'Best sellers data retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async getBestSellers() {
    return this.productsService.getBestSellers();
  }
}
