// 🔍 Initialize OpenTelemetry tracing FIRST (before any other imports)
import './tracing';

import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import { join } from 'path';
import { CustomLogger } from './common/utils/logger.util';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { getHelmetConfig } from './config/helmet.config';
import { getCorsConfig } from './config/cors.config';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { AuditLogService } from './common/services/audit-log.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  });

  // 🆕 Use CustomLogger from CommonModule
  const customLogger = app.get(CustomLogger);
  app.useLogger(customLogger);

  // 🆕 Apply global middleware (order matters!)
  const correlationIdMiddleware = new CorrelationIdMiddleware();
  app.use(correlationIdMiddleware.use.bind(correlationIdMiddleware));

  const requestLoggerMiddleware = new RequestLoggerMiddleware();
  app.use(requestLoggerMiddleware.use.bind(requestLoggerMiddleware));

  // Serve static files (for uploaded avatars)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // 🔒 Security middleware - Helmet with comprehensive headers
  app.use(helmet(getHelmetConfig(nodeEnv)));

  // 🗜️ Compression middleware - Reduce response size
  app.use(compression());

  // 🌐 CORS configuration - Cross-origin resource sharing
  const corsOrigins = configService.get<string>('CORS_ORIGINS');
  const corsCredentials = configService.get<boolean>('CORS_CREDENTIALS', true);
  app.enableCors(getCorsConfig(nodeEnv, corsOrigins, corsCredentials));

  // 📝 Audit logging interceptor - Track sensitive operations
  const reflector = app.get(Reflector);
  const auditLogService = app.get(AuditLogService);
  app.useGlobalInterceptors(
    new AuditLogInterceptor(reflector, auditLogService),
  );

  // Note: Global validation pipes are registered in CommonModule

  // API prefix
  app.setGlobalPrefix('api/v1');

  // 📚 Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('MASH Backend API')
    .setDescription(
      `# Mushroom Automation with Smart Hydro-environment Backend API

## Features
- 🔐 **Authentication**: Clerk-based auth with OAuth support (Google, GitHub, Facebook)
- 📊 **IoT Monitoring**: Real-time device and sensor data management
- 🛒 **E-commerce**: Complete product catalog and order management system
- 📈 **Analytics**: Advanced reporting and business intelligence
- 🔔 **Notifications**: Multi-channel (Email, SMS, Push) notification system
- ⚡ **Performance**: Redis caching, rate limiting, and connection pooling
- 📡 **Real-time**: WebSocket support for live updates
- 🔍 **Monitoring**: Prometheus metrics and OpenTelemetry tracing

## Quick Start
1. **Health Check**: \`GET /api/v1/health\`
2. **Register**: \`POST /api/v1/auth/register\`
3. **Login**: \`POST /api/v1/auth/login\`
4. **Get Current User**: \`GET /api/v1/auth/me\` (requires Bearer token)

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
\`\`\`
Authorization: Bearer YOUR_ACCESS_TOKEN
\`\`\`

Obtain tokens via:
- Email/Password login (\`/api/v1/auth/login\`)
- OAuth providers (\`/api/v1/auth/oauth/{google|github|facebook}\`)

## Rate Limiting
- **Registration**: 3 requests per minute
- **Login**: 5 requests per minute  
- **Password Reset**: 3 requests per 5 minutes
- **General API**: 100 requests per 15 minutes

## Support
- Email: pp.namias@gmail.com
- GitHub: https://github.com/MASH-Mushroom-Automation/MASH-Backend
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
    .addServer('https://api.mash-backend.com', 'Production Server (Future)')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      methodKey,
    deepScanRoutes: true,
  });

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'MASH Backend API - Documentation',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 50px 0 }
      .swagger-ui .info .title { font-size: 36px }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 3,
      tryItOutEnabled: true,
    },
  });

  logger.log(
    `📚 Swagger API Documentation: http://localhost:${port}/api/docs`,
  );

  // Graceful shutdown
  app.enableShutdownHooks();

  // Bind to 0.0.0.0 to accept connections from any network interface
  // This is required for cloud platforms like Render, Railway, etc.
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`🌟 Environment: ${nodeEnv}`);
  logger.log(`🔐 API Prefix: api/v1`);
}

bootstrap().catch((error) => {
  Logger.error('❌ Error starting application', error, 'Bootstrap');
  process.exit(1);
});
