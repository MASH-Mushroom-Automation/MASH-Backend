import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// Import configuration
import { createAppConfig } from './config/app.config';
import { createDatabaseConfig } from './config/database.config';
import { createJwtConfig } from './config/jwt.config';
import { getThrottlerConfig } from './common/config/throttler.config';

// Import modules (will be created)
import { AuthModule } from './modules/auth/auth.module';
// import { UsersModule } from './modules/users/users.module';
// import { DevicesModule } from './modules/devices/devices.module';
// import { SensorsModule } from './modules/sensors/sensors.module';
// import { OrdersModule } from './modules/orders/orders.module';
// import { ProductsModule } from './modules/products/products.module';
// import { AnalyticsModule } from './modules/analytics/analytics.module';
// import { NotificationsModule } from './modules/notifications/notifications.module';
// import { PaymentsModule } from './modules/payments/payments.module';
// import { AdminModule } from './modules/admin/admin.module';

// Import common modules
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { UsersModule } from './modules/users/users.module';
import { DevicesModule } from './modules/devices/devices.module';
import { SensorsModule } from './modules/sensors/sensors.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { ProfileModule } from './modules/profile/profile.module';
import { CustomThrottlerGuard } from './modules/auth/guards/throttler.guard';
import { PrismaService } from './database/prisma.service';
import { AlertsModule } from './modules/alerts/alerts.module';
import { QueuesModule } from './modules/queues/queues.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { RedisService } from './database/redis.service';
import { RedisThrottlerStorage } from './common/storage/redis-throttler.storage';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [
        () => ({ app: createAppConfig }),
        () => ({ database: createDatabaseConfig }),
        () => ({ jwt: createJwtConfig }),
      ],
    }),

    // Rate limiting with Redis-backed distributed storage
    ThrottlerModule.forRootAsync({
      useFactory: (redisService: RedisService) => ({
        throttlers: getThrottlerConfig(),
        storage: new RedisThrottlerStorage(redisService),
        // Enable skip if decorated with @SkipThrottle()
        skipIf: () => false,
      }),
      inject: [RedisService],
    }),

    // Core modules
    CommonModule, // 🆕 Added - Global utilities, filters, interceptors, pipes
    DatabaseModule,
    HealthModule,

    // Feature modules
    AuthModule,

    ProfileModule,

    UsersModule,

    DevicesModule,

    SensorsModule,

    ProductsModule,

    OrdersModule,

    CategoriesModule,

    AnalyticsModule,

    NotificationsModule,

    AdminModule,

    AlertsModule,

    QueuesModule,

    // WebSocket module for real-time communication
    WebsocketModule,
    // UsersModule,
    // DevicesModule,
    // SensorsModule,
    // OrdersModule,
    // ProductsModule,
    // AnalyticsModule,
    // NotificationsModule,
    // PaymentsModule,
    // AdminModule,
    // HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    // Global guards
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    // Note: Global filters, interceptors, and pipes are registered in CommonModule
  ],
})
export class AppModule {}
