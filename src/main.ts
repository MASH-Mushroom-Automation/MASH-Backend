// Initialize OpenTelemetry tracing FIRST (before any other imports)
import './tracing';

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

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  });

  // Use CustomLogger from CommonModule
  const customLogger = app.get(CustomLogger);
  app.useLogger(customLogger);

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

  // Security middleware - Helmet with comprehensive headers
  app.use(helmet(getHelmetConfig(nodeEnv)));

  // Compression middleware - Optimized response compression with threshold and filtering
  app.use(compression(getCompressionConfig(nodeEnv)));

  // CORS configuration - Cross-origin resource sharing
  const corsOrigins = configService.get<string>('CORS_ORIGINS');
  const corsCredentials = configService.get<boolean>('CORS_CREDENTIALS', true);
  app.enableCors(getCorsConfig(nodeEnv, corsOrigins, corsCredentials));

  // Audit logging interceptor - Track sensitive operations
  const reflector = app.get(Reflector);
  const auditLogService = app.get(AuditLogService);
  app.useGlobalInterceptors(
    new AuditLogInterceptor(reflector, auditLogService),
  );

  // Note: Global validation pipes are registered in CommonModule

  // API prefix - exclude auth HTML pages from the prefix
  app.setGlobalPrefix('api/v1', {
    exclude: [
      '/',
      '/register',
      '/verify',
      '/forgot-password',
      '/reset-password',
      '/dashboard',
    ],
  });

  // Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('MASH Backend API')
    .setDescription(
      `# Mushroom Automation with Smart Hydro-environment Backend API

**Production URL**: https://mash-backend.onrender.com

## Overview

Complete IoT-enabled backend system for automated mushroom cultivation with integrated e-commerce, real-time monitoring, and advanced analytics.

## Key Features

- **Authentication**: Clerk-based authentication with OAuth support (Google, GitHub, Facebook)
- **IoT Monitoring**: Real-time device and sensor data management
- **E-commerce**: Complete product catalog and order management system
- **Analytics**: Advanced reporting and business intelligence
- **Notifications**: Multi-channel (Email, SMS, Push) notification system
- **Performance**: Redis caching, rate limiting, and connection pooling
- **Real-time Communication**: WebSocket support for live updates
- **Observability**: Prometheus metrics and OpenTelemetry tracing

## Quick Start

### 1. Check API Health
\`\`\`
GET /api/v1/health
\`\`\`

### 2. Register a New User
\`\`\`
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
\`\`\`

### 3. Login
\`\`\`
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
\`\`\`

### 4. Use Protected Endpoints
Include the Bearer token in all authenticated requests:
\`\`\`
Authorization: Bearer YOUR_ACCESS_TOKEN
\`\`\`

## Authentication

All protected endpoints require a Bearer token in the Authorization header.

**Obtain tokens via**:
- Email/Password login: \`POST /api/v1/auth/login\`
- OAuth providers: \`GET /api/v1/auth/oauth/{google|github|facebook}\`

**Token Types**:
- **Access Token**: Valid for 1 day, used for API requests
- **Refresh Token**: Valid for 7 days, used to obtain new access tokens

## Rate Limiting

| Endpoint Category | Limit | Window |
|------------------|-------|---------|
| Registration | 3 requests | 1 minute |
| Login Attempts | 5 requests | 1 minute |
| Password Reset | 3 requests | 5 minutes |
| General API | 100 requests | 15 minutes |
| WebSocket Connections | 50 connections | per user |

## Support

- **Email**: pp.namias@gmail.com
- **GitHub**: https://github.com/MASH-Mushroom-Automation/MASH-Backend
- **Documentation**: Full API documentation available at this page
      `,
    )
    .setVersion('1.0.0')
    .setContact(
      'MASH Development Team',
      'https://github.com/MASH-Mushroom-Automation',
      'pp.namias@gmail.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addTag('root', 'Root API information endpoint')
    .addTag('health', 'System health and monitoring endpoints')
    .addTag('auth', 'Authentication and authorization endpoints')
    .addTag('profile', 'User profile management endpoints')
    .addTag('users', 'User management endpoints (Admin)')
    .addTag('devices', 'IoT device management endpoints')
    .addTag('sensors', 'Sensor data collection and retrieval endpoints')
    .addTag('inventory', 'Inventory endpoints')
    .addTag('products', 'Product catalog management endpoints')
    .addTag('orders', 'Order processing and management endpoints')
    .addTag('categories', 'Product category management endpoints')
    .addTag('analytics', 'Analytics and reporting endpoints')
    .addTag('notifications', 'Notification management endpoints')
    .addTag('admin', 'Administrative endpoints (Super Admin only)')
    .addTag('metrics', 'Prometheus metrics endpoints')
    .addTag('cache', 'Cache monitoring and management endpoints')
    .addTag('alerts', 'Alert rules and monitoring endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token obtained from login or OAuth',
        in: 'header',
      },
      'access-token',
    )
    .addServer(`http://localhost:${port}`, 'Development Server')
    .addServer('https://mash-backend.onrender.com', 'Production Server')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
    deepScanRoutes: true,
  });

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'MASH Backend API - Documentation',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
    },
  });

  logger.log(`Swagger API Documentation: http://localhost:${port}/api/docs`);

  // Graceful shutdown
  app.enableShutdownHooks();

  // Bind to 0.0.0.0 to accept connections from any network interface
  // This is required for cloud platforms like Render, Railway, etc.
  await app.listen(port, '0.0.0.0');

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`API Prefix: api/v1`);
}

bootstrap().catch((error) => {
  console.error('❌ FATAL ERROR DURING BOOTSTRAP:');
  console.error('Error type:', typeof error);
  console.error('Error:', error);
  console.error('Stack:', error?.stack);
  console.error('Message:', error?.message);
  Logger.error('Error starting application', error, 'Bootstrap');
  process.exit(1);
});
