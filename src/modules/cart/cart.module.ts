import { Module, forwardRef } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CartController } from './cart.controller';
import { CartAnalyticsController } from './cart-analytics.controller';
import { CartService } from './cart.service';
import { CartCacheService } from './cart-cache.service';
import { CartSchedulerService } from './cart-scheduler.service';
import { ShippingService } from './shipping.service';
import { CartSessionInterceptor } from './interceptors/cart-session.interceptor';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { OrdersModule } from '../orders/orders.module';
import { PrometheusService } from '../../monitoring/prometheus/prometheus.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    forwardRef(() => OrdersModule),
  ],
  controllers: [CartController, CartAnalyticsController],
  providers: [
    CartService,
    CartCacheService,
    CartSchedulerService,
    ShippingService,
    PrismaService,
    RedisService,
    PrometheusService,
    CartSessionInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: CartSessionInterceptor,
    },
  ],
  exports: [CartService, CartCacheService, CartSchedulerService, ShippingService],
})
export class CartModule {}
