/**
 * HTTP Exception Filter Tests
 * Tests error transformation and response formatting
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HttpExceptionFilter } from '../http-exception.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { CustomLogger } from '../../utils/logger.util';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockLogger: jest.Mocked<CustomLogger>;
  let mockArgumentsHost: jest.Mocked<ArgumentsHost>;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(async () => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockRequest = {
      url: '/test',
      method: 'GET',
      headers: {
        'x-correlation-id': 'test-correlation-id',
      },
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpExceptionFilter,
        {
          provide: CustomLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('catch', () => {
    it('should handle HttpException with message string', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: HttpStatus.BAD_REQUEST,
          timestamp: expect.any(String),
          path: '/test',
          method: 'GET',
          correlationId: 'test-correlation-id',
          error: expect.objectContaining({
            type: 'HttpException',
            message: 'Test error',
          }),
        }),
      );
    });

    it('should handle HttpException with object response', () => {
      const exception = new HttpException(
        {
          message: 'Validation failed',
          errors: ['Field is required'],
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      // Logger.error is called, not mockLogger.error (uses NestJS Logger, not CustomLogger)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: expect.objectContaining({
            message: 'Validation failed',
            details: ['Field is required'],
          }),
        }),
      );
    });

    it('should handle 500 Internal Server Error', () => {
      const exception = new HttpException(
        'Internal error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      // Logger logs the error internally
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        }),
      );
    });

    it('should handle 404 Not Found', () => {
      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          error: expect.objectContaining({
            type: 'HttpException',
            message: 'Not found',
          }),
        }),
      );
    });

    it('should handle 401 Unauthorized', () => {
      const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          error: expect.objectContaining({
            type: 'HttpException',
            message: 'Unauthorized',
          }),
        }),
      );
    });
  });
});
