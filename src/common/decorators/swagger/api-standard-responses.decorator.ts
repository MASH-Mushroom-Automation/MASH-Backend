import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

/**
 * Reusable Swagger decorator for standard API error responses
 *
 * Adds comprehensive error response documentation for common HTTP status codes:
 * - 400 Bad Request (Validation errors)
 * - 401 Unauthorized (Authentication failed)
 * - 403 Forbidden (Insufficient permissions)
 * - 404 Not Found (Resource not found)
 * - 429 Too Many Requests (Rate limit exceeded)
 * - 500 Internal Server Error
 *
 * @example
 * ```typescript
 * @Get(':id')
 * @ApiStandardResponses()
 * @ApiResponse({ status: 200, description: 'User found' })
 * async findOne(@Param('id') id: string) {
 *   // Implementation
 * }
 * ```
 */
export function ApiStandardResponses() {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description: 'Bad Request - Validation failed or invalid input',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              statusCode: { type: 'number', example: 400 },
              message: { type: 'string', example: 'Validation failed' },
              error: { type: 'string', example: 'Bad Request' },
              details: {
                type: 'object',
                example: {
                  email: ['must be a valid email address'],
                  password: ['must be at least 8 characters long'],
                },
              },
            },
          },
          examples: {
            validation: {
              summary: 'Validation Error',
              value: {
                statusCode: 400,
                message: 'Validation failed',
                error: 'Bad Request',
                details: {
                  email: ['must be a valid email address'],
                  password: ['must be at least 8 characters long'],
                },
              },
            },
            invalidInput: {
              summary: 'Invalid Input',
              value: {
                statusCode: 400,
                message: 'Invalid request parameters',
                error: 'Bad Request',
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing authentication',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              statusCode: { type: 'number', example: 401 },
              message: { type: 'string', example: 'Invalid credentials' },
              error: { type: 'string', example: 'Unauthorized' },
            },
          },
          examples: {
            invalidToken: {
              summary: 'Invalid Token',
              value: {
                statusCode: 401,
                message: 'Invalid or expired token',
                error: 'Unauthorized',
              },
            },
            missingToken: {
              summary: 'Missing Token',
              value: {
                statusCode: 401,
                message: 'No authorization token provided',
                error: 'Unauthorized',
              },
            },
            invalidCredentials: {
              summary: 'Invalid Credentials',
              value: {
                statusCode: 401,
                message: 'Invalid email or password',
                error: 'Unauthorized',
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Insufficient permissions',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              statusCode: { type: 'number', example: 403 },
              message: {
                type: 'string',
                example: 'Insufficient permissions to access this resource',
              },
              error: { type: 'string', example: 'Forbidden' },
            },
          },
          examples: {
            insufficientPermissions: {
              summary: 'Insufficient Permissions',
              value: {
                statusCode: 403,
                message: 'You do not have permission to perform this action',
                error: 'Forbidden',
              },
            },
            roleRequired: {
              summary: 'Role Required',
              value: {
                statusCode: 403,
                message: 'This action requires ADMIN role',
                error: 'Forbidden',
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Not Found - Resource does not exist',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              statusCode: { type: 'number', example: 404 },
              message: { type: 'string', example: 'Resource not found' },
              error: { type: 'string', example: 'Not Found' },
            },
          },
          examples: {
            resourceNotFound: {
              summary: 'Resource Not Found',
              value: {
                statusCode: 404,
                message: 'The requested resource was not found',
                error: 'Not Found',
              },
            },
            userNotFound: {
              summary: 'User Not Found',
              value: {
                statusCode: 404,
                message: 'User with ID "abc123" not found',
                error: 'Not Found',
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 429,
      description: 'Too Many Requests - Rate limit exceeded',
      headers: {
        'X-RateLimit-Limit': {
          description: 'Maximum requests allowed in time window',
          schema: { type: 'integer', example: 100 },
        },
        'X-RateLimit-Remaining': {
          description: 'Remaining requests in current window',
          schema: { type: 'integer', example: 0 },
        },
        'X-RateLimit-Reset': {
          description: 'Unix timestamp when rate limit resets',
          schema: { type: 'integer', example: 1729900800 },
        },
        'Retry-After': {
          description: 'Seconds to wait before retry',
          schema: { type: 'integer', example: 30 },
        },
      },
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              statusCode: { type: 'number', example: 429 },
              message: {
                type: 'string',
                example: 'Rate limit exceeded. Try again in 30 seconds.',
              },
              error: { type: 'string', example: 'Too Many Requests' },
            },
          },
          example: {
            statusCode: 429,
            message: 'Rate limit exceeded. Try again in 30 seconds.',
            error: 'Too Many Requests',
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal Server Error - Unexpected server error',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              statusCode: { type: 'number', example: 500 },
              message: { type: 'string', example: 'Internal server error' },
              error: { type: 'string', example: 'Internal Server Error' },
            },
          },
          examples: {
            serverError: {
              summary: 'Server Error',
              value: {
                statusCode: 500,
                message: 'An unexpected error occurred',
                error: 'Internal Server Error',
              },
            },
            databaseError: {
              summary: 'Database Error',
              value: {
                statusCode: 500,
                message: 'Database connection failed',
                error: 'Internal Server Error',
              },
            },
          },
        },
      },
    }),
  );
}
