import { NestFactory } from '@nestjs/core';
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

  // Security middleware - Helmet with enhanced configuration
  app.use(
    helmet({
      // Content Security Policy
      contentSecurityPolicy:
        nodeEnv === 'development'
          ? false
          : {
              directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
              },
            },
      // HTTP Strict Transport Security (HSTS)
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      },
      // X-Frame-Options: Prevent clickjacking
      frameguard: {
        action: 'deny',
      },
      // X-Content-Type-Options: Prevent MIME sniffing
      noSniff: true,
      // X-XSS-Protection: Enable XSS filter
      xssFilter: true,
      // Referrer-Policy: Control referrer information
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
    }),
  );

  // 🆕 Compression middleware - Reduce response size
  app.use(compression());

  // CORS configuration
  app.enableCors({
    origin:
      nodeEnv === 'development'
        ? [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:5173',
          ]
        : configService.get<string>('CORS_ORIGINS', '').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Note: Global validation pipes are registered in CommonModule

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation (only in development)
  if (nodeEnv === 'development') {
    const config = new DocumentBuilder()
      .setTitle('MASH Backend API')
      .setDescription(
        'Mushroom Automation with Smart Hydro-environment Backend API',
      )
      .setVersion('1.0')
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management endpoints')
      .addTag('devices', 'IoT device management endpoints')
      .addTag('sensors', 'Sensor data endpoints')
      .addTag('orders', 'Order management endpoints')
      .addTag('products', 'Product catalog endpoints')
      .addTag('analytics', 'Analytics and reporting endpoints')
      .addTag('admin', 'Administrative endpoints')
      .addBearerAuth()
      .addServer('http://localhost:3000', 'Development server')
      .addServer('https://api.mash-backend.com', 'Production server')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });

    logger.log(
      `📚 API Documentation available at: http://localhost:${port}/api/docs`,
    );
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`🌟 Environment: ${nodeEnv}`);
  logger.log(`🔐 API Prefix: api/v1`);
}

bootstrap().catch((error) => {
  Logger.error('❌ Error starting application', error, 'Bootstrap');
  process.exit(1);
});
