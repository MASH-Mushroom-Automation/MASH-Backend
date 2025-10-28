// 🔧 TEMPORARILY DISABLED FOR DEBUGGING
// Initialize OpenTelemetry tracing FIRST (before any other imports)
// import './tracing';

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

  // Swagger/OpenAPI documentation - Enhanced Configuration
  const config = new DocumentBuilder()
    .setTitle('MASH Backend API')
    .setDescription(
      `# MASH Backend API

Mushroom Automation Smart Harvesting - Comprehensive IoT-enabled backend system for automated mushroom cultivation with integrated e-commerce, real-time monitoring, and advanced analytics.

---

## Overview

Enterprise-grade API for mushroom cultivation automation, IoT device management, e-commerce platform, and business intelligence. Designed for high-performance, scalability, and security.

## Features

### Authentication & Security
- Multi-factor authentication (JWT + Firebase + OAuth)
- Role-based access control (RBAC)
- API Key authentication for service-to-service communication
- Enterprise security with CSRF protection and Helmet

### Performance & Reliability
- Advanced rate limiting with 5 configurable strategies
- API Gateway with load balancing and circuit breaker patterns
- Redis caching for optimal performance
- Connection pooling and query optimization

### Real-time Capabilities
- WebSocket support for live updates
- Real-time sensor data streaming
- Push notifications (Email, SMS, Push)
- Live order tracking and status updates

### Data Management
- Bulk import/export operations
- Advanced search with Elasticsearch
- Comprehensive analytics and reporting
- Historical data tracking and trends

### IoT Integration
- Device management and monitoring
- Sensor data collection and analysis
- Automated alert system
- Device health monitoring

## Base URL

- **Production**: https://mash-backend-api.up.railway.app
- **Development**: http://localhost:${port}

## Quick Start

### 1. Check API Health
\`\`\`bash
GET /api/v1/health
\`\`\`

### 2. Register a New User
\`\`\`bash
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
\`\`\`bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400
}
\`\`\`

### 4. Use Protected Endpoints
Include the Bearer token in all authenticated requests:
\`\`\`bash
Authorization: Bearer YOUR_ACCESS_TOKEN
\`\`\`

## Authentication

All protected endpoints require a Bearer token in the Authorization header.

### Authentication Methods

1. **JWT Authentication (Standard)**
   - Email/Password login: \`POST /api/v1/auth/login\`
   - Returns access token (24h) and refresh token (7d)

2. **OAuth Providers**
   - Google: \`GET /api/v1/auth/oauth/google\`
   - GitHub: \`GET /api/v1/auth/oauth/github\`
   - Facebook: \`GET /api/v1/auth/oauth/facebook\`

3. **API Key Authentication**
   - For service-to-service communication
   - Include \`X-API-Key\` header

### Token Types

- **Access Token**: Valid for 24 hours, used for API requests
- **Refresh Token**: Valid for 7 days, used to obtain new access tokens
- **API Key**: Permanent, used for automated services

### Token Refresh
\`\`\`bash
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "YOUR_REFRESH_TOKEN"
}
\`\`\`

## Rate Limiting

All API endpoints are rate-limited. Rate limit information is returned in response headers:

- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: Timestamp when limit resets

### Default Rate Limits

| Endpoint Category | Limit | Window |
|------------------|-------|---------|
| Registration | 3 requests | 1 minute |
| Login Attempts | 5 requests | 1 minute |
| Password Reset | 3 requests | 5 minutes |
| General API | 100 requests | 15 minutes |
| WebSocket Connections | 50 connections | per user |
| Admin Operations | 1000 requests | 15 minutes |

### Custom Rate Limits

Premium users and API integrations can request custom rate limits via \`POST /api/v1/gateway/rate-limits/overrides\`.

### Rate Limiting Strategies

- **TOKEN_BUCKET**: Allows bursts but enforces average rate
- **LEAKY_BUCKET**: Smooths out bursts with constant rate
- **SLIDING_WINDOW**: More accurate than fixed window
- **FIXED_WINDOW**: Simple time-window based limiting
- **ADAPTIVE**: Adjusts limits based on system load

## Pagination

List endpoints support pagination with query parameters:

- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 10, max: 100)
- \`sortBy\`: Field to sort by (e.g., \`createdAt\`)
- \`sortOrder\`: Sort order (\`asc\` or \`desc\`)

**Example:**
\`\`\`bash
GET /api/v1/products?page=2&limit=20&sortBy=price&sortOrder=asc
\`\`\`

## Error Handling

All errors follow RFC 7807 (Problem Details) format:

\`\`\`json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": {
    "email": ["must be a valid email"],
    "password": ["must be at least 8 characters"]
  }
}
\`\`\`

### Common HTTP Status Codes

- \`200 OK\`: Request successful
- \`201 Created\`: Resource created successfully
- \`400 Bad Request\`: Validation error or invalid input
- \`401 Unauthorized\`: Invalid or missing authentication
- \`403 Forbidden\`: Insufficient permissions
- \`404 Not Found\`: Resource does not exist
- \`429 Too Many Requests\`: Rate limit exceeded
- \`500 Internal Server Error\`: Server-side error

## WebSocket Connection

Connect to real-time events via WebSocket:

\`\`\`javascript
const socket = io('ws://localhost:${port}/ws', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

// Subscribe to events
socket.emit('subscribe:orders', { userId: 'user_123' });
socket.on('order:updated', (data) => console.log(data));
\`\`\`

## Support

- **Email**: pp.namias@gmail.com
- **Documentation**: Full API documentation at /api/docs
- **GitHub**: https://github.com/MASH-Mushroom-Automation/MASH-Backend (Private Repository)
- **Issues**: https://github.com/MASH-Mushroom-Automation/MASH-Backend/issues

## Changelog

See [API Changelog](/docs/API_CHANGELOG.md) for version history and breaking changes.
      `,
    )
    .setVersion('1.0.0')
    .setContact(
      'MASH API Support',
      'https://github.com/MASH-Mushroom-Automation/MASH-Backend',
      'pp.namias@gmail.com',
    )
    .setLicense('MIT License', 'https://opensource.org/licenses/MIT')
    .setTermsOfService('https://mash.com/terms')
    .setExternalDoc('Full API Documentation', 'https://docs.mash.com')
    // Comprehensive API Tags
    .addTag('root', 'Root API information endpoint')
    .addTag('health', 'System health and monitoring endpoints')
    .addTag('Authentication', 'User authentication and authorization endpoints')
    .addTag('profile', 'User profile management endpoints')
    .addTag('Users', 'User management endpoints (Admin)')
    .addTag('Devices', 'IoT device management endpoints')
    .addTag('Sensors', 'Sensor data collection and retrieval endpoints')
    .addTag('inventory', 'Inventory management endpoints')
    .addTag('Products', 'Product catalog management endpoints')
    .addTag('Orders', 'Order creation and management endpoints')
    .addTag('categories', 'Product category management endpoints')
    .addTag('Analytics', 'Business intelligence and reporting endpoints')
    .addTag('notifications', 'Notification management endpoints')
    .addTag('Admin', 'Administrative operations (Super Admin only)')
    .addTag('Gateway', 'API Gateway configuration and management')
    .addTag('Rate Limiting', 'Rate limit configuration and monitoring')
    .addTag('metrics', 'Prometheus metrics endpoints')
    .addTag('cache', 'Cache monitoring and management endpoints')
    .addTag('alerts', 'Alert rules and monitoring endpoints')
    .addTag('WebSocket', 'Real-time communication via WebSocket')
    .addTag('Import/Export', 'Bulk data operations')
    .addTag('Search', 'Advanced search capabilities')
    // Authentication Schemes
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token (access token from login)',
        in: 'header',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API Key for service-to-service authentication',
      },
      'API-Key',
    )
    .addOAuth2(
      {
        type: 'oauth2',
        flows: {
          implicit: {
            authorizationUrl: 'https://auth.mash.com/oauth/authorize',
            scopes: {
              'read:products': 'Read product information',
              'write:products': 'Create and update products',
              'read:orders': 'Read order information',
              'write:orders': 'Create and update orders',
              'read:devices': 'Read device data',
              'write:devices': 'Manage devices',
              'read:sensors': 'Read sensor data',
              'admin:all': 'Full administrative access',
            },
          },
        },
      },
      'OAuth2',
    )
    // Server Configurations
    .addServer('https://mash-backend-api.up.railway.app', 'Production Server (Railway)')
    .addServer(`http://localhost:${port}`, 'Local Development')
    .addServer('https://staging-api.mash.com', 'Staging Environment (Coming Soon)')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
    deepScanRoutes: true,
  });

  // Enhanced Swagger UI Setup
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'MASH Backend API - Documentation',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none', // Collapse all sections by default
      filter: true, // Enable search/filter
      showRequestDuration: true, // Show request duration
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
      tryItOutEnabled: true, // Enable "Try it out" by default
      displayOperationId: true, // Show operation IDs
      displayRequestDuration: true,
      defaultModelsExpandDepth: 1, // Expand schema models by 1 level
      defaultModelExpandDepth: 2,
      showExtensions: true,
      showCommonExtensions: true,
      url: undefined, // Let Swagger auto-detect from document servers
    },
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info .title { color: #10b981; font-size: 2.5rem; }
      .swagger-ui .info .description { font-size: 1rem; line-height: 1.6; }
      .swagger-ui .scheme-container { background: #f8f9fa; padding: 1rem; border-radius: 4px; }
      .swagger-ui .opblock-tag { font-size: 1.5rem; border-bottom: 2px solid #10b981; }
      .swagger-ui .opblock.opblock-post { border-color: #10b981; background: rgba(16, 185, 129, 0.05); }
      .swagger-ui .opblock.opblock-get { border-color: #3b82f6; background: rgba(59, 130, 246, 0.05); }
      .swagger-ui .opblock.opblock-put { border-color: #f59e0b; background: rgba(245, 158, 11, 0.05); }
      .swagger-ui .opblock.opblock-delete { border-color: #ef4444; background: rgba(239, 68, 68, 0.05); }
    `,
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
