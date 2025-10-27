import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// Import configuration
import { createAppConfig } from './config/app.config';
import { createDatabaseConfig } from './config/database.config';
import { createJwtConfig } from './config/jwt.config';
import {
  envValidationSchema,
  envValidationOptions,
} from './config/env-validation.config';
import { getThrottlerConfig } from './common/config/throttler.config';

// Import modules (will be created)
import { AuthModule } from './modules/auth/auth.module';
import { AuthViewsModule } from './modules/auth/views/auth-views.module';
// import { UsersModule } from './modules/users/users.module';
// import { DevicesModule } from './modules/devices/devices.module';
// import { SensorsModule } from './modules/sensors/sensors.module';
// import { OrdersModule } from './modules/orders/orders.module';
// import { ProductsModule } from './modules/products/products.module';
// import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
// import { PaymentsModule } from './modules/payments/payments.module';
// import { AdminModule } from './modules/admin/admin.module';

// Import common modules
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { PrometheusModule } from './monitoring/prometheus/prometheus.module';
import { TracingModule } from './monitoring/tracing/tracing.module';
import { UsersModule } from './modules/users/users.module';
// 🔧 TEMPORARILY DISABLED FOR DEBUGGING
// import { DevicesModule } from './modules/devices/devices.module';
import { SensorsModule } from './modules/sensors/sensors.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CategoriesModule } from './modules/categories/categories.module';
// 🔧 TEMPORARILY DISABLED FOR DEBUGGING - May use Bull queues
// import { AnalyticsModule } from './modules/analytics/analytics.module';
// import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { ProfileModule } from './modules/profile/profile.module';
import { CustomThrottlerGuard } from './modules/auth/guards/throttler.guard';
// 🔧 TEMPORARILY DISABLED FOR DEBUGGING - May use Bull queues
// import { AlertsModule } from './modules/alerts/alerts.module';
// 🔧 TEMPORARILY DISABLED FOR DEBUGGING - Bull queues causing hang
import { QueuesModule } from './modules/queues/queues.module';
// 🔧 TEMPORARILY DISABLED FOR DEBUGGING
// import { WebsocketModule } from './modules/websocket/websocket.module';
import { InventoryModule } from './modules/inventory/inventory.module';
// 🔧 TEMPORARILY DISABLED FOR DEBUGGING
// import { SearchModule } from './modules/search/search.module';
import { ImportExportModule } from './modules/import-export/import-export.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { RedisService } from './database/redis.service';
import { RedisThrottlerStorage } from './common/storage/redis-throttler.storage';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsInterceptor } from './monitoring/prometheus/interceptors/metrics.interceptor';

@Module({
  imports: [
    // Configuration with environment variable validation
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [
        () => ({ app: createAppConfig }),
        () => ({ database: createDatabaseConfig }),
        () => ({ jwt: createJwtConfig }),
      ],
      // Validate environment variables on startup
      validationSchema: envValidationSchema,
      validationOptions: envValidationOptions,
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

    // Schedule Module for cron jobs (cache monitoring, cache warming)
    ScheduleModule.forRoot(),

    // Core modules
    CommonModule, // 🆕 Added - Global utilities, filters, interceptors, pipes
    DatabaseModule,
    HealthModule,
    PrometheusModule, // 🆕 Prometheus metrics collection
    TracingModule, // 🆕 OpenTelemetry distributed tracing

    // Feature modules
    AuthModule,
    AuthViewsModule, // 🆕 HTML views for auth pages

    ProfileModule,

    UsersModule,

    // 🔧 TEMPORARILY DISABLED FOR DEBUGGING
    // DevicesModule,

    SensorsModule,

    ProductsModule,

    OrdersModule,

    CategoriesModule,

    // 🔧 TEMPORARILY DISABLED FOR DEBUGGING - May use Bull queues
    // AnalyticsModule,

    NotificationsModule,

    AdminModule,

    // 🔧 TEMPORARILY DISABLED FOR DEBUGGING - May use Bull queues
    // AlertsModule,

    // 🔧 TEMPORARILY DISABLED FOR DEBUGGING - Bull queues causing startup hang
    QueuesModule,

    InventoryModule,

    // 🔧 TEMPORARILY DISABLED FOR DEBUGGING
    // Search Engine Module (Issue #28 - Advanced Search & Filtering)
    // SearchModule,

    // Import/Export Module (Issue #30 - Data Export & Import Backend System)
    ImportExportModule,

    // API Gateway Module (Issue #32 - API Gateway & Rate Limiting Backend)
    GatewayModule,

    // 🔧 TEMPORARILY DISABLED FOR DEBUGGING
    // WebSocket module for real-time communication
    // WebsocketModule,
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
    // Global guards
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    // Note: Global filters, interceptors, and pipes are registered in CommonModule
  ],
})
export class AppModule {}
