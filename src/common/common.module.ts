import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';

// Filters
import {
  HttpExceptionFilter,
  PrismaExceptionFilter,
  ValidationExceptionFilter,
  AllExceptionsFilter,
} from './filters';

// Interceptors
import { TransformInterceptor, LoggingInterceptor, TimeoutInterceptor } from './interceptors';
import { FieldSelectionInterceptor } from './interceptors/field-selection.interceptor';

// Pipes
import { CustomValidationPipe } from './pipes/validation.pipe';
import { SanitizePipe } from './pipes/sanitize.pipe';

// Services
import { SanitizationService } from './services/sanitization.service';
import { FileValidationService } from './services/file-validation.service';
import { AuditLogService } from './services/audit-log.service';
import { CacheService } from './services/cache.service';
import { CacheManagerService } from './services/cache-manager.service';

// Utilities
import { CustomLogger } from './utils/logger.util';

// Controllers
import { CsrfTokenController } from './controllers/csrf-token.controller';

// Logger configuration
import { loggerConfig } from '../config/logger.config';

/**
 * Common Module
 *
 * @Global decorator makes this module's providers available everywhere
 * without needing to import it in every module
 *
 * Provides:
 * - Global exception filters
 * - Global interceptors
 * - Global pipes
 * - Shared utilities
 * - Winston logger
 */
@Global()
@Module({
  imports: [
    // Winston Logger Module
    WinstonModule.forRoot(loggerConfig),
  ],
  controllers: [
    // CSRF Token Controller - Provides CSRF token endpoints
    CsrfTokenController,
  ],
  providers: [
    // Services (Issue #23 - Enterprise Security, #24 - Performance Optimization)
    SanitizationService,
    FileValidationService,
    AuditLogService,
    CacheService, // Performance: Distributed caching abstraction
    CacheManagerService, // Performance: Cache warming, statistics, and monitoring

    // Custom Logger
    CustomLogger,

    // Global Exception Filters (order matters - most specific first)
    {
      provide: APP_FILTER,
      useClass: ValidationExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },

    // Global Interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: FieldSelectionInterceptor, // Performance: Field selection for 40-60% response size reduction
    },

    // Global Pipes
    {
      provide: APP_PIPE,
      useClass: CustomValidationPipe,
    },
    {
      provide: APP_PIPE,
      useClass: SanitizePipe,
    },
  ],
  exports: [
    // Export services for use in other modules (Issue #23, #24)
    SanitizationService,
    FileValidationService,
    AuditLogService,
    CacheService, // Performance: Cache service for Redis operations
    CacheManagerService, // Performance: Cache management and monitoring

    // Export CustomLogger for use in other modules
    CustomLogger,
    WinstonModule,
  ],
})
export class CommonModule {}
