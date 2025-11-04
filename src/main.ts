// Initialize OpenTelemetry tracing FIRST (before any other imports)
import './monitoring/tracing';

import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { CustomLogger } from './common/utils/logger.util';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { CsrfProtectionMiddleware } from './common/middleware/csrf-protection.middleware';
import { getHelmetConfig } from './config/helmet.config';
import { getCompressionConfig } from './config/compression.config';
import { getCorsConfig } from './config/cors.config';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { AuditLogService } from './common/services/audit-log.service';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('🚀 Bootstrap function started');

  logger.log('🔧 Stage 1: Creating NestJS application...');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  });

  logger.log('✅ Stage 1 complete: Application created');

  logger.log('🔧 Stage 2: Setting up custom logger...');
  // Use CustomLogger from CommonModule
  try {
    const customLogger = app.get(CustomLogger);
    app.useLogger(customLogger);
    logger.log('✅ Stage 2 complete: Logger configured');
  } catch (error) {
    logger.error('Failed to setup custom logger:', error);
  }

  // Apply global middleware (order matters!)
  const correlationIdMiddleware = new CorrelationIdMiddleware();
  app.use(correlationIdMiddleware.use.bind(correlationIdMiddleware));

  const requestLoggerMiddleware = new RequestLoggerMiddleware();
  app.use(requestLoggerMiddleware.use.bind(requestLoggerMiddleware));

  // Security headers middleware - Additional OWASP-recommended headers
  const securityHeadersMiddleware = new SecurityHeadersMiddleware();
  app.use(securityHeadersMiddleware.use.bind(securityHeadersMiddleware));

  // Cookie parser middleware - Required for CSRF protection
  app.use(cookieParser());

  // CSRF protection middleware - Protects against Cross-Site Request Forgery attacks
  // Note: Must be applied AFTER cookie-parser and BEFORE routes
  const csrfProtectionMiddleware = new CsrfProtectionMiddleware();
  app.use(csrfProtectionMiddleware.use.bind(csrfProtectionMiddleware));

  // Serve static files (for uploaded avatars)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Get config service and environment variables first
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Serve static files for auth pages (HTML, CSS, JS)
  // In production (dist), public folder is copied to dist/public
  // In development, it's at src/public
  const publicPath =
    nodeEnv === 'production'
      ? join(__dirname, '..', 'public')
      : join(__dirname, '..', 'src', 'public');
  app.useStaticAssets(publicPath, {
    prefix: '/public/',
  });

  logger.log('🔧 Stage 3: Applying security middleware...');
  // Security middleware - Helmet with comprehensive headers
  app.use(helmet(getHelmetConfig(nodeEnv)));

  logger.log('🔧 Stage 4: Applying compression...');
  // Compression middleware - Optimized response compression with threshold and filtering
  app.use(compression(getCompressionConfig(nodeEnv)));

  logger.log('🔧 Stage 5: Enabling CORS...');
  // CORS configuration - Cross-origin resource sharing
  const corsOrigins = configService.get<string>('CORS_ORIGINS');
  const corsCredentials = configService.get<boolean>('CORS_CREDENTIALS', true);
  app.enableCors(getCorsConfig(nodeEnv, corsOrigins, corsCredentials));

  logger.log('🔧 Stage 6: Setting up audit logging...');
  // Audit logging interceptor - Track sensitive operations
  const reflector = app.get(Reflector);
  const auditLogService = app.get(AuditLogService);
  app.useGlobalInterceptors(new AuditLogInterceptor(reflector, auditLogService));

  logger.log('🔧 Stage 7: Applying global exception filters...');
  // ==================== GLOBAL EXCEPTION FILTERS ====================
  // Apply exception filters in order of specificity (most specific first)
  // Order matters: Specific exceptions should be caught before generic ones
  app.useGlobalFilters(
    new PrismaExceptionFilter(), // Catch Prisma database errors
    new ValidationExceptionFilter(), // Catch validation errors
    new HttpExceptionFilter(), // Catch HTTP exceptions
    new AllExceptionsFilter(), // Catch all other exceptions (fallback)
  );
  logger.log('✅ Global exception filters applied successfully');

  // Note: Global validation pipes are registered in CommonModule

  // API prefix - exclude auth HTML pages from the prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['/', '/register', '/verify', '/forgot-password', '/reset-password', '/dashboard'],
  });

  // Swagger/OpenAPI Documentation - Clean and Simple Configuration
  const config = new DocumentBuilder()
    .setTitle('MASH Backend API')
    .setDescription('Mushroom Automation Smart Harvesting - Backend API for automated mushroom cultivation with IoT integration, e-commerce, and real-time monitoring.')
    .setVersion('1.0.0')
    .setContact('MASH Support', 'https://github.com/MASH-Mushroom-Automation/MASH-Backend', 'pp.namias@gmail.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    // API Tags (lowercase for consistency with controllers)
    .addTag('auth', 'User authentication and authorization')
    .addTag('users', 'User management')
    .addTag('profile', 'User profile management')
    .addTag('products', 'Product catalog management')
    .addTag('orders', 'Order management')
    .addTag('categories', 'Product categories')
    .addTag('devices', 'IoT device management')
    .addTag('sensors', 'Sensor data and monitoring')
    .addTag('notifications', 'Push notifications, SMS, and email')
    .addTag('inventory', 'Inventory management')
    .addTag('health', 'System health monitoring')
    .addTag('rate-limits', 'Rate limiting and throttling')
    // Authentication
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token from login',
      },
      'JWT-auth',
    )
    // Servers
    .addServer(`http://localhost:${port}`, 'Local Development')
    .addServer('https://mash-backend-api.up.railway.app', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
    deepScanRoutes: true,
  });

  // Setup Swagger UI with default configuration
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      filter: true,
      displayRequestDuration: true,
    },
  });

  logger.log(`✅ Swagger API Documentation: http://localhost:${port}/api/docs`);

  logger.log('🔧 Stage 8: Enabling graceful shutdown...');
  // Graceful shutdown
  app.enableShutdownHooks();
  logger.log('✅ Stage 8 complete: Shutdown hooks enabled');

  logger.log(`🔧 Stage 9: Binding to port ${port} on 0.0.0.0...`);
  // Bind to 0.0.0.0 to accept connections from any network interface
  // This is required for cloud platforms like Render, Railway, etc.
  await app.listen(port, '0.0.0.0');
  logger.log(`✅ Stage 9 complete: Server listening on port ${port}`);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`API Prefix: api/v1`);
}

// 🔧 DEBUGGING: Add global error handlers to catch unhandled errors
process.on('uncaughtException', error => {
  const logger = new Logger('UncaughtException');
  logger.error('🔥 UNCAUGHT EXCEPTION:');
  logger.error(`Error type: ${error.constructor.name}`);
  logger.error(`Message: ${error.message}`);
  logger.error(`Stack: ${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const logger = new Logger('UnhandledRejection');
  logger.error('🔥 UNHANDLED REJECTION:');
  logger.error('Promise:', promise);

  if (reason instanceof Error) {
    logger.error(`Reason type: ${reason.constructor.name}`);
    logger.error(`Reason: ${reason.message}`);
    logger.error(`Stack: ${reason.stack}`);
  } else {
    logger.error(`Reason: ${String(reason)}`);
  }

  process.exit(1);
});

bootstrap().catch(error => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ FATAL ERROR DURING BOOTSTRAP:');
  logger.error(`Error type: ${typeof error}`);
  logger.error('Error:', error);
  if (error instanceof Error) {
    logger.error(`Stack: ${error.stack}`);
    logger.error(`Message: ${error.message}`);
  }
  process.exit(1);
});
