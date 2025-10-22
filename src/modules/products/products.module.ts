import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule], // Import SearchModule for ProductIndexerService
  controllers: [ProductsController],
  providers: [ProductsService], // PrismaService provided globally by DatabaseModule
  exports: [ProductsService],
})
export class ProductsModule {}
