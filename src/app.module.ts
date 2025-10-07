import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// Import configuration
import { createAppConfig } from './config/app.config';
import { createDatabaseConfig } from './config/database.config';
import { createJwtConfig } from './config/jwt.config';

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
// import { CommonModule } from './common/common.module';
import { UsersModule } from './modules/users/users.module';
import { DevicesModule } from './modules/devices/devices.module';
import { SensorsModule } from './modules/sensors/sensors.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { CustomThrottlerGuard } from './modules/auth/guards/throttler.guard';
import { PrismaService } from './database/prisma.service';

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

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Core modules
    DatabaseModule,
    HealthModule,
    // CommonModule,

    // Feature modules
    AuthModule,

    UsersModule,

    DevicesModule,

    SensorsModule,

    ProductsModule,

    OrdersModule,

    CategoriesModule,

    AnalyticsModule,

    NotificationsModule,

    AdminModule,
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
    // Global filters and interceptors will be added here
  ],
})
export class AppModule {}
