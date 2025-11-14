// Initialize OpenTelemetry tracing FIRST (before any other imports)
// NOTE: Temporarily commented out to fix build issue - tracing.ts not compiling
// import './monitoring/tracing';

import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, RequestMethod } from '@nestjs/common';
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
  const startTime = Date.now();
  const logger = new Logger('Bootstrap');
  logger.log('[STARTUP] Bootstrap function started');
  logger.log('=== ENVIRONMENT DIAGNOSTIC ===');
  logger.log(`NODE_ENV: ${process.env.NODE_ENV || '❌ NOT SET'}`);
  logger.log(`PORT: ${process.env.PORT || '❌ NOT SET (Railway assigns dynamically)'}`);
  logger.log(
    `DATABASE_URL: ${process.env.DATABASE_URL ? '✅ SET (' + process.env.DATABASE_URL.substring(0, 30) + '...)' : '❌ MISSING'}`,
  );
  logger.log(`JWT_SECRET: ${process.env.JWT_SECRET ? '✅ SET' : '❌ MISSING'}`);
  logger.log(`REDIS_HOST: ${process.env.REDIS_HOST || 'NOT SET (optional)'}`);
  logger.log('=== END DIAGNOSTIC ===');

  let app: NestExpressApplication;

  try {
    logger.log('[CONFIG] Stage 1: Creating NestJS application...');
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
      bufferLogs: true,
    });
    logger.log('[SUCCESS] ✅ Stage 1 complete: Application created');
  } catch (error) {
    logger.error('=== ❌ FATAL ERROR DURING MODULE CREATION ===');
    if (error instanceof Error) {
      logger.error(`Error Type: ${error.constructor.name}`);
      logger.error(`Error Message: ${error.message}`);
      logger.error('Stack Trace:');
      logger.error(error.stack);
      logger.error('=== END FATAL ERROR ===');

      // Log which module might be failing
      if (error.message.includes('Cannot find module')) {
        logger.error('⚠️  MISSING MODULE DETECTED - Check if all dependencies are installed');
      } else if (error.message.includes('Circular dependency')) {
        logger.error('⚠️  CIRCULAR DEPENDENCY DETECTED - Check module imports');
      } else if (error.message.includes('inject')) {
        logger.error('⚠️  DEPENDENCY INJECTION FAILURE - Check service providers');
      }
    } else {
      logger.error('Unknown error:', error);
    }

    throw error; // Re-throw to exit process
  }

  // 🔥 CRITICAL: Add emergency health endpoint BEFORE any other config
  // This responds even if database/modules fail to initialize
  app.use('/api/v1/health', (req: any, res: any, next: any) => {
    const method = req.method as string;
    const url = req.url as string;
    if (method === 'GET' && url === '/') {
      const status = res.status as (code: number) => any;
      const json = status(200).json as (data: any) => void;
      json({
        status: 'ok',
        message: 'MASH Backend API is alive',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        env: process.env.NODE_ENV || 'development',
        emergency: true, // Flag indicating this is the bypass route
      });
    } else {
      const nextFn = next as () => void;
      nextFn();
    }
  });

  logger.log('[EMERGENCY] Health check bypass route registered at /api/v1/health');

  logger.log('[CONFIG] Stage 2: Setting up custom logger...');
  // Use CustomLogger from CommonModule
  try {
    const customLogger = app.get(CustomLogger);
    app.useLogger(customLogger);
    logger.log('[SUCCESS] Stage 2 complete: Logger configured');
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

  logger.log('[CONFIG] Stage 3: Applying security middleware...');
  // Security middleware - Helmet with comprehensive headers
  app.use(helmet(getHelmetConfig(nodeEnv)));

  logger.log('[CONFIG] Stage 4: Applying compression...');
  // Compression middleware - Optimized response compression with threshold and filtering
  app.use(compression(getCompressionConfig(nodeEnv)));

  logger.log('[CONFIG] Stage 5: Enabling CORS...');
  // CORS configuration - Cross-origin resource sharing
  const corsOrigins = configService.get<string>('CORS_ORIGINS');
  const corsCredentials = configService.get<boolean>('CORS_CREDENTIALS', true);
  app.enableCors(getCorsConfig(nodeEnv, corsOrigins, corsCredentials));

  logger.log('[CONFIG] Stage 6: Setting up audit logging...');
  // Audit logging interceptor - Track sensitive operations
  const reflector = app.get(Reflector);
  const auditLogService = app.get(AuditLogService);
  app.useGlobalInterceptors(new AuditLogInterceptor(reflector, auditLogService));

  logger.log('[CONFIG] Stage 7: Applying global exception filters...');
  // ==================== GLOBAL EXCEPTION FILTERS ====================
  // Apply exception filters in order of specificity (most specific first)
  // Order matters: Specific exceptions should be caught before generic ones
  app.useGlobalFilters(
    new PrismaExceptionFilter(), // Catch Prisma database errors
    new ValidationExceptionFilter(), // Catch validation errors
    new HttpExceptionFilter(), // Catch HTTP exceptions
    new AllExceptionsFilter(), // Catch all other exceptions (fallback)
  );
  logger.log('[SUCCESS] Global exception filters applied successfully');

  // Note: Global validation pipes are registered in CommonModule

  // API prefix - exclude auth HTML pages and metrics endpoint from the prefix
  app.setGlobalPrefix('api/v1', {
    exclude: [
      '/',
      '/register',
      '/verify',
      '/forgot-password',
      '/reset-password',
      '/dashboard',
      { path: '/metrics', method: RequestMethod.ALL },
      { path: '/metrics/json', method: RequestMethod.ALL },
      { path: '/metrics/health', method: RequestMethod.ALL },
    ],
  });

  // Swagger/OpenAPI Documentation - Clean and Simple Configuration
  const config = new DocumentBuilder()
    .setTitle('MASH Backend API')
    .setDescription(
      'Mushroom Automation Smart Harvesting - Backend API for automated mushroom cultivation with IoT integration, e-commerce, and real-time monitoring.',
    )
    .setVersion('1.0.0')
    .setContact(
      'MASH Support',
      'https://github.com/MASH-Mushroom-Automation/MASH-Backend',
      'pp.namias@gmail.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    // API Tags (professional naming without emojis)
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management')
    .addTag('Profile', 'User profile management')
    .addTag('Products', 'Product catalog management')
    .addTag('Orders', 'Order management')
    .addTag('Categories', 'Product categories')
    .addTag('Devices', 'IoT device management')
    .addTag('Sensors', 'Sensor data and monitoring')
    .addTag('Notifications', 'Push notifications, SMS, and email')
    .addTag('Inventory', 'Inventory management')
    .addTag('Health', 'System health monitoring')
    .addTag('Rate Limits', 'Rate limiting and throttling')
    .addTag('Database Seeding', 'Database seeding operations')
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
    .addServer('https://mash-backend-api-production.up.railway.app', 'Production')
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

  logger.log(`[SUCCESS] Swagger API Documentation: http://localhost:${port}/api/docs`);

  logger.log('[CONFIG] Stage 8: Enabling graceful shutdown...');
  // Graceful shutdown
  try {
    app.enableShutdownHooks();
    logger.log('[SUCCESS] Stage 8 complete: Shutdown hooks enabled');
  } catch (error) {
    logger.error('[ERROR] Stage 8 failed:', error);
    throw error;
  }

  logger.log(`[CONFIG] Stage 9: Binding to port ${port} on 0.0.0.0...`);
  logger.log(`[METRICS] Memory before listen: ${JSON.stringify(process.memoryUsage())}`);

  // Bind to 0.0.0.0 to accept connections from any network interface
  // This is required for cloud platforms like Render, Railway, etc.
  try {
    await app.listen(port, '0.0.0.0');
    const totalStartupTime = Date.now() - startTime;

    logger.log('[SUCCESS] Stage 9 complete: Server listening');
    logger.log('=== SERVER STARTUP COMPLETE ===');
    logger.log(`🚀 Application listening on port ${port}`);
    logger.log(`🏥 Health check: http://0.0.0.0:${port}/api/v1/health`);
    logger.log(`📚 Swagger docs: http://0.0.0.0:${port}/api/docs`);
    logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.log(`⏱️  Startup time: ${totalStartupTime}ms`);
    logger.log('=== READY FOR TRAFFIC ===');
  } catch (error) {
    logger.error('[ERROR] Stage 9 failed - Could not bind to port:', error);
    throw error;
  }

  logger.log(`[READY] Application successfully started!`);
  logger.log(`[INFO] Running on: http://localhost:${port}`);
  logger.log(`[INFO] Environment: ${nodeEnv}`);
  logger.log(`[INFO] API Prefix: api/v1`);
  logger.log(`[DOCS] API Docs: http://localhost:${port}/api/docs`);
  logger.log(`[HEALTH] Health Check: http://localhost:${port}/api/v1/health`);
  logger.log(`[METRICS] Final Memory: ${JSON.stringify(process.memoryUsage())}`);
}

// [CONFIG] DEBUGGING: Add global error handlers to catch unhandled errors
process.on('uncaughtException', error => {
  const logger = new Logger('UncaughtException');
  logger.error('[CRITICAL] UNCAUGHT EXCEPTION:');
  logger.error(`Error type: ${error.constructor.name}`);
  logger.error(`Message: ${error.message}`);
  logger.error(`Stack: ${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const logger = new Logger('UnhandledRejection');
  logger.error('[CRITICAL] UNHANDLED REJECTION:');
  logger.error('Promise: [Promise object - cannot stringify]');

  if (reason instanceof Error) {
    logger.error(`Reason type: ${reason.constructor.name}`);
    logger.error(`Reason: ${reason.message}`);
    logger.error(`Stack: ${reason.stack}`);
  } else {
    logger.error('Reason:', reason);
  }

  process.exit(1);
});

// [CONFIG] DEBUGGING: Add startup timeout to prevent infinite hanging
const STARTUP_TIMEOUT = 120000; // 2 minutes
const startupTimer = setTimeout(() => {
  const logger = new Logger('StartupTimeout');
  logger.error('[ERROR] APPLICATION STARTUP TIMEOUT');
  logger.error(`Application failed to start within ${STARTUP_TIMEOUT / 1000} seconds`);
  logger.error('This usually indicates a hanging async operation during initialization');
  logger.error(`Current memory: ${JSON.stringify(process.memoryUsage())}`);
  process.exit(1);
}, STARTUP_TIMEOUT);

bootstrap()
  .then(() => {
    clearTimeout(startupTimer);
    const logger = new Logger('Bootstrap');
    logger.log('[SUCCESS] Bootstrap completed successfully');
  })
  .catch(error => {
    clearTimeout(startupTimer);
    const logger = new Logger('Bootstrap');
    logger.error('[ERROR] FATAL ERROR DURING BOOTSTRAP:');
    logger.error(`Error type: ${typeof error}`);
    logger.error('Error:', error);
    if (error instanceof Error) {
      logger.error(`Error name: ${error.name}`);
      logger.error(`Message: ${error.message}`);
      logger.error(`Stack: ${error.stack}`);
    }

    // Log critical environment variables for debugging Railway deployments
    logger.error('[DEBUG] Environment check:');
    logger.error(
      `  DATABASE_URL: ${process.env.DATABASE_URL ? '✅ SET (length: ' + process.env.DATABASE_URL.length + ')' : '❌ MISSING'}`,
    );
    logger.error(`  PORT: ${process.env.PORT || '❌ NOT SET (will default to 3000)'}`);
    logger.error(`  NODE_ENV: ${process.env.NODE_ENV || '❌ NOT SET'}`);
    logger.error(`  REDIS_HOST: ${process.env.REDIS_HOST || '❌ NOT SET'}`);
    logger.error(`  JWT_SECRET: ${process.env.JWT_SECRET ? '✅ SET' : '❌ MISSING'}`);

    process.exit(1);
  });
