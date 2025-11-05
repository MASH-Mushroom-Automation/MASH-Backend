import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

/**
 * Base Service Class
 *
 * Abstract service providing common CRUD operations
 * Features:
 * - Generic CRUD methods
 * - Pagination support
 * - Filtering & sorting
 * - Error handling
 * - Soft delete support
 *
 * @abstract
 * @template T - Entity type
 * @template CreateDto - DTO for creating entity
 * @template UpdateDto - DTO for updating entity
 */
export abstract class BaseService<T, CreateDto, UpdateDto> {
  /**
   * Prisma model delegate
   * Must be provided by child class
   */
  protected abstract model: {
    findMany: (args?: unknown) => Promise<T[]>;
    findUnique: (args?: unknown) => Promise<T | null>;
    findFirst: (args?: unknown) => Promise<T | null>;
    create: (args?: unknown) => Promise<T>;
    update: (args?: unknown) => Promise<T>;
    delete: (args?: unknown) => Promise<T>;
    count: (args?: unknown) => Promise<number>;
  };

  /**
   * Entity name (for error messages)
   */
  protected abstract entityName: string;

  /**
   * Find all entities with pagination
   *
   * @param options - Query options (page, limit, where, orderBy)
   * @returns Paginated list of entities
   */
  async findAll(
    options: {
      page?: number;
      limit?: number;
      where?: any;
      orderBy?: any;
      include?: any;
    } = {},
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, where = {}, orderBy = { createdAt: 'desc' }, include } = options;

    const skip = (page - 1) * limit;

    try {
      const [data, total] = await Promise.all([
        this.model.findMany({
          skip,
          take: limit,
          where,
          orderBy,
          include,
        }),
        this.model.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.handleError(error, 'findAll');
    }
  }

  /**
   * Find one entity by ID
   *
   * @param id - Entity ID
   * @param include - Relations to include
   * @returns Entity or null
   */
  async findOne(id: string, include?: any): Promise<T> {
    try {
      const entity = await this.model.findUnique({
        where: { id },
        include,
      });

      return this.validateExists(entity, id);
    } catch (error) {
      this.handleError(error, 'findOne');
    }
  }

  /**
   * Find one entity by criteria
   *
   * @param where - Query criteria
   * @param include - Relations to include
   * @returns Entity or null
   */
  async findOneBy(where: any, include?: any): Promise<T | null> {
    try {
      return await this.model.findFirst({
        where,
        include,
      });
    } catch (error) {
      this.handleError(error, 'findOneBy');
    }
  }

  /**
   * Create a new entity
   *
   * @param dto - Create DTO
   * @returns Created entity
   */
  async create(dto: CreateDto): Promise<T> {
    try {
      return await this.model.create({
        data: dto,
      });
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update an entity
   *
   * @param id - Entity ID
   * @param dto - Update DTO
   * @returns Updated entity
   */
  async update(id: string, dto: UpdateDto): Promise<T> {
    try {
      // Check if entity exists
      await this.findOne(id);

      return await this.model.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete an entity (soft or hard delete)
   *
   * @param id - Entity ID
   * @param soft - Use soft delete (default: true)
   */
  async remove(id: string, soft: boolean = true): Promise<void> {
    try {
      // Check if entity exists
      await this.findOne(id);

      if (soft) {
        // Soft delete
        await this.model.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      } else {
        // Hard delete
        await this.model.delete({
          where: { id },
        });
      }
    } catch (error) {
      this.handleError(error, 'remove');
    }
  }

  /**
   * Restore a soft-deleted entity
   *
   * @param id - Entity ID
   * @returns Restored entity
   */
  async restore(id: string): Promise<T> {
    try {
      return await this.model.update({
        where: { id },
        data: { deletedAt: null },
      });
    } catch (error) {
      this.handleError(error, 'restore');
    }
  }

  /**
   * Bulk create entities
   *
   * @param dtos - Array of create DTOs
   * @returns Created entities
   */
  async bulkCreate(dtos: CreateDto[]): Promise<T[]> {
    try {
      const results = await Promise.all(dtos.map(dto => this.create(dto)));
      return results;
    } catch (error) {
      this.handleError(error, 'bulkCreate');
    }
  }

  /**
   * Bulk update entities
   *
   * @param updates - Array of {id, data}
   * @returns Updated entities
   */
  async bulkUpdate(updates: Array<{ id: string; data: UpdateDto }>): Promise<T[]> {
    try {
      const results = await Promise.all(updates.map(({ id, data }) => this.update(id, data)));
      return results;
    } catch (error) {
      this.handleError(error, 'bulkUpdate');
    }
  }

  /**
   * Count entities
   *
   * @param where - Query criteria
   * @returns Count
   */
  async count(where: any = {}): Promise<number> {
    try {
      return await this.model.count({ where });
    } catch (error) {
      this.handleError(error, 'count');
    }
  }

  /**
   * Check if entity exists
   *
   * @param id - Entity ID
   * @returns Boolean
   */
  async exists(id: string): Promise<boolean> {
    try {
      const entity = await this.model.findUnique({
        where: { id },
        select: { id: true },
      });
      return entity !== null;
    } catch (error) {
      this.handleError(error, 'exists');
    }
  }

  /**
   * Validate entity exists, throw NotFoundException if not
   *
   * @param entity - Entity
   * @param id - Entity ID (for error message)
   * @returns Entity
   * @throws NotFoundException
   */
  protected validateExists(entity: T | null, id?: string): T {
    if (!entity) {
      const message = id
        ? `${this.entityName} with ID ${id} not found`
        : `${this.entityName} not found`;
      throw new NotFoundException(message);
    }
    return entity;
  }

  /**
   * Handle errors and throw appropriate exceptions
   *
   * @param error - Error object
   * @param operation - Operation name
   * @throws BadRequestException, InternalServerErrorException
   */
  protected handleError(error: any, operation: string): never {
    console.error(`Error in ${this.entityName}.${operation}:`, error);

    // Handle Prisma errors
    if (error.code) {
      switch (error.code) {
        case 'P2002':
          throw new BadRequestException(`${this.entityName} with this unique field already exists`);
        case 'P2025':
          throw new NotFoundException(`${this.entityName} not found`);
        case 'P2003':
          throw new BadRequestException('Foreign key constraint failed');
        default:
          throw new BadRequestException(`Database error: ${error.message}`);
      }
    }

    // Handle known exceptions
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }

    // Generic error
    throw new InternalServerErrorException(`Failed to ${operation} ${this.entityName}`);
  }
}
