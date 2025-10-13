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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SelectableFields } from '../../common/decorators/selectable-fields.decorator';

@ApiTags('categories')
@Controller('categories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // 1. GET /categories - List all categories
  @Get()
  @SelectableFields({
    allowedFields: [
      'id',
      'name',
      'slug',
      'description',
      'icon',
      'parentId',
      'isActive',
      'sortOrder',
      'createdAt',
      'updatedAt',
    ],
    requiredFields: ['id', 'name'],
    defaultFields: ['id', 'name', 'slug', 'description', 'icon', 'isActive'],
  })
  @ApiOperation({
    summary: 'List all categories with filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
  })
  async findAll(@Query() query: CategoryQueryDto) {
    return this.categoriesService.findAll(query);
  }

  // 2. POST /categories - Create category
  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create new category' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  // 3. GET /categories/tree - Get category tree
  @Get('tree')
  @ApiOperation({ summary: 'Get hierarchical category tree structure' })
  @ApiResponse({
    status: 200,
    description: 'Category tree retrieved successfully',
  })
  async getCategoryTree() {
    return this.categoriesService.getCategoryTree();
  }

  // 4. GET /categories/:id - Get category by ID
  @Get(':id')
  @ApiOperation({ summary: 'Get category details by ID' })
  @ApiResponse({ status: 200, description: 'Category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  // 5. PUT /categories/:id - Update category
  @Put(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update category information' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  // 6. DELETE /categories/:id - Delete category
  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Soft delete category' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }

  // 7. GET /categories/:id/children - Get child categories
  @Get(':id/children')
  @ApiOperation({ summary: 'Get child categories of a category' })
  @ApiResponse({
    status: 200,
    description: 'Child categories retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getChildren(@Param('id') id: string) {
    return this.categoriesService.getChildren(id);
  }

  // 8. GET /categories/:id/products - Get products in category
  @Get(':id/products')
  @ApiOperation({ summary: 'Get all products in a category' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getCategoryProducts(
    @Param('id') id: string,
    @Query() query: CategoryQueryDto,
  ) {
    return this.categoriesService.getCategoryProducts(id, query);
  }
}
