import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'development' ? false : undefined,
    }),
  );

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

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

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
