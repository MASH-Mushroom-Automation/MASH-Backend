import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Get backend API information',
    description:
      'Returns comprehensive information about the MASH Backend API including available endpoints, documentation links, and system status',
  })
  @ApiResponse({
    status: 200,
    description: 'Backend information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'MASH Backend API' },
        version: { type: 'string', example: '1.0.0' },
        description: { type: 'string' },
        status: { type: 'string', example: 'operational' },
        timestamp: { type: 'string', format: 'date-time' },
        documentation: {
          type: 'object',
          properties: {
            swagger: {
              type: 'string',
              example: 'https://mash-backend-api-production.up.railway.app/api/docs',
            },
            postman: {
              type: 'string',
              example: 'Available in /postman directory',
            },
          },
        },
        endpoints: {
          type: 'object',
          properties: {
            health: { type: 'string', example: '/api/v1/health' },
            metrics: { type: 'string', example: '/api/v1/metrics' },
            auth: { type: 'string', example: '/api/v1/auth' },
          },
        },
      },
    },
  })
  getApiInfo(): object {
    return this.appService.getApiInfo();
  }
}
