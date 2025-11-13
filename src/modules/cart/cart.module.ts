import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartCacheService } from './cart-cache.service';
import { CartSchedulerService } from './cart-scheduler.service';
import { CartSessionInterceptor } from './interceptors/cart-session.interceptor';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CartController],
  providers: [
    CartService,
    CartCacheService,
    CartSchedulerService,
    PrismaService,
    RedisService,
    CartSessionInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: CartSessionInterceptor,
    },
  ],
  exports: [CartService, CartCacheService, CartSchedulerService],
})
export class CartModule {}
