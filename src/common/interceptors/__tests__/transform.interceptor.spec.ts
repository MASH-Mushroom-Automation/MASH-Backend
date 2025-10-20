/**
 * Transform Interceptor Tests
 * Tests response transformation and wrapping
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleLogger } from '@nestjs/common';
import { TransformInterceptor } from '../transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { CustomLogger } from '../../utils/logger.util';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;
  let mockLogger: jest.Mocked<CustomLogger>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockRequest = {
      url: '/test',
      method: 'GET',
      headers: {},
      correlationId: 'test-correlation-id',
    };

    mockResponse = {
      statusCode: 200,
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as any;

    mockCallHandler = {
      handle: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransformInterceptor,
        {
          provide: CustomLogger,
          useValue: mockLogger,
        },
      ],
    })

      .setLogger(new ConsoleLogger()) // Use ConsoleLogger for NestJS v11 compatibility

      .compile();

    interceptor = module.get<TransformInterceptor<any>>(TransformInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should transform response with success wrapper', (done) => {
      const testData = { id: 1, name: 'Test' };
      mockCallHandler.handle.mockReturnValue(of(testData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (value) => {
          expect(value).toEqual({
            success: true,
            statusCode: 200,
            timestamp: expect.any(String),
            path: '/test',
            correlationId: 'test-correlation-id',
            data: testData,
          });
          done();
        },
      });
    });

    it('should handle null response data', (done) => {
      mockCallHandler.handle.mockReturnValue(of(null));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (value) => {
          expect(value).toEqual({
            success: true,
            statusCode: 200,
            timestamp: expect.any(String),
            path: '/test',
            correlationId: 'test-correlation-id',
            data: null,
          });
          done();
        },
      });
    });

    it('should handle undefined response data', (done) => {
      mockCallHandler.handle.mockReturnValue(of(undefined));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (value) => {
          expect(value).toEqual({
            success: true,
            statusCode: 200,
            timestamp: expect.any(String),
            path: '/test',
            correlationId: 'test-correlation-id',
            data: undefined,
          });
          done();
        },
      });
    });

    it('should handle array response data', (done) => {
      const testArray = [{ id: 1 }, { id: 2 }];
      mockCallHandler.handle.mockReturnValue(of(testArray));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (value) => {
          expect(value.data).toEqual(testArray);
          expect(Array.isArray(value.data)).toBe(true);
          done();
        },
      });
    });

    it('should handle 201 Created status code', (done) => {
      mockResponse.statusCode = 201;
      const testData = { id: 1, created: true };
      mockCallHandler.handle.mockReturnValue(of(testData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (value) => {
          expect(value.statusCode).toBe(201);
          done();
        },
      });
    });

    it('should preserve timestamp format as ISO string', (done) => {
      mockCallHandler.handle.mockReturnValue(of({ test: 'data' }));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (value) => {
          const timestamp = new Date(value.timestamp);
          expect(timestamp).toBeInstanceOf(Date);
          expect(isNaN(timestamp.getTime())).toBe(false);
          done();
        },
      });
    });
  });
});
