import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule], // Import SearchModule for ProductIndexerService
  controllers: [ProductsController],
  providers: [ProductsService, PrismaService, RedisService],
  exports: [ProductsService],
})
export class ProductsModule {}
