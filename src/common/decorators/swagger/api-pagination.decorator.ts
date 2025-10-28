import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

/**
 * Reusable Swagger decorator for pagination query parameters
 *
 * Adds standardized pagination query parameters to API endpoints:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - sortBy: Field to sort by
 * - sortOrder: Sort order (asc/desc)
 *
 * @example
 * ```typescript
 * @Get()
 * @ApiPagination()
 * async findAll(@Query('page') page: number) {
 *   // Implementation
 * }
 * ```
 */
export function ApiPagination() {
  return applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number (default: 1)',
      example: 1,
      schema: {
        type: 'integer',
        minimum: 1,
        default: 1,
      },
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Items per page (default: 10, max: 100)',
      example: 10,
      schema: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 10,
      },
    }),
    ApiQuery({
      name: 'sortBy',
      required: false,
      type: String,
      description: 'Field to sort by (e.g., createdAt, name, price)',
      example: 'createdAt',
      schema: {
        type: 'string',
      },
    }),
    ApiQuery({
      name: 'sortOrder',
      required: false,
      enum: ['asc', 'desc'],
      description: 'Sort order: ascending (asc) or descending (desc)',
      example: 'desc',
      schema: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'desc',
      },
    }),
  );
}
