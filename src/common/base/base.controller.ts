import {
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseService } from './base.service';

/**
 * Base Controller Class
 *
 * Abstract controller providing standard REST endpoints
 * Features:
 * - Standard CRUD operations
 * - Pagination support
 * - Swagger documentation
 * - Consistent response format
 *
 * @abstract
 * @template T - Entity type
 * @template CreateDto - DTO for creating entity
 * @template UpdateDto - DTO for updating entity
 */
export abstract class BaseController<T, CreateDto, UpdateDto> {
  /**
   * Service instance
   * Must be provided by child class
   */
  protected abstract service: BaseService<T, CreateDto, UpdateDto>;

  /**
   * Entity name (for Swagger documentation)
   */
  protected abstract entityName: string;

  /**
   * Get all entities
   *
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10)
   * @param sortBy - Sort field (default: createdAt)
   * @param sortOrder - Sort order (default: desc)
   * @returns Paginated list of entities
   */
  @Get()
  @ApiOperation({ summary: 'Get all entities' })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved entities',
  })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('sortBy') sortBy: string = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const orderBy = { [sortBy]: sortOrder };

    return this.service.findAll({
      page: Number(page),
      limit: Number(limit),
      orderBy,
    });
  }

  /**
   * Get entity by ID
   *
   * @param id - Entity ID
   * @returns Entity
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get entity by ID' })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved entity',
  })
  @ApiResponse({
    status: 404,
    description: 'Entity not found',
  })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /**
   * Create a new entity
   *
   * @param dto - Create DTO
   * @returns Created entity
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new entity' })
  @ApiResponse({
    status: 201,
    description: 'Entity successfully created',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
  })
  async create(@Body() dto: CreateDto) {
    return this.service.create(dto);
  }

  /**
   * Update an entity
   *
   * @param id - Entity ID
   * @param dto - Update DTO
   * @returns Updated entity
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update entity' })
  @ApiResponse({
    status: 200,
    description: 'Entity successfully updated',
  })
  @ApiResponse({
    status: 404,
    description: 'Entity not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateDto) {
    return this.service.update(id, dto);
  }

  /**
   * Delete an entity (soft delete)
   *
   * @param id - Entity ID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete entity' })
  @ApiResponse({
    status: 204,
    description: 'Entity successfully deleted',
  })
  @ApiResponse({
    status: 404,
    description: 'Entity not found',
  })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
  }

  /**
   * Restore a soft-deleted entity
   *
   * @param id - Entity ID
   * @returns Restored entity
   */
  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore soft-deleted entity' })
  @ApiResponse({
    status: 200,
    description: 'Entity successfully restored',
  })
  @ApiResponse({
    status: 404,
    description: 'Entity not found',
  })
  async restore(@Param('id') id: string) {
    return this.service.restore(id);
  }

  /**
   * Get entity count
   *
   * @returns Count
   */
  @Get('count/all')
  @ApiOperation({ summary: 'Get entity count' })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved count',
  })
  async count() {
    const count = await this.service.count();
    return { count };
  }
}
