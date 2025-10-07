import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * Paginated Response DTO
 */
export class PaginatedDto<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  success: boolean;
  statusCode: number;
  timestamp: string;
}

/**
 * API Paginated Response Decorator
 * 
 * Swagger decorator for paginated responses
 * 
 * Usage:
 * @Get()
 * @ApiPaginatedResponse(UserDto)
 * findAll() {}
 */
export const ApiPaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
) => {
  return applyDecorators(
    ApiExtraModels(PaginatedDto, model),
    ApiOkResponse({
      description: 'Successfully retrieved paginated list',
      schema: {
        allOf: [
          {
            properties: {
              success: {
                type: 'boolean',
                example: true,
              },
              statusCode: {
                type: 'number',
                example: 200,
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: '2025-10-08T10:30:00.000Z',
              },
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              pagination: {
                type: 'object',
                properties: {
                  page: {
                    type: 'number',
                    example: 1,
                  },
                  limit: {
                    type: 'number',
                    example: 10,
                  },
                  total: {
                    type: 'number',
                    example: 100,
                  },
                  totalPages: {
                    type: 'number',
                    example: 10,
                  },
                },
              },
            },
          },
        ],
      },
    }),
  );
};
