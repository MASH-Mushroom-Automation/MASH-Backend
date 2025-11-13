import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartCacheService } from './cart-cache.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';

@Module({
  controllers: [CartController],
  providers: [CartService, CartCacheService, PrismaService, RedisService],
  exports: [CartService, CartCacheService],
})
export class CartModule {}
