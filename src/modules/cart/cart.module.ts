import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartCacheService } from './cart-cache.service';
import { CartSessionInterceptor } from './interceptors/cart-session.interceptor';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';

@Module({
  controllers: [CartController],
  providers: [
    CartService,
    CartCacheService,
    PrismaService,
    RedisService,
    CartSessionInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: CartSessionInterceptor,
    },
  ],
  exports: [CartService, CartCacheService],
})
export class CartModule {}
