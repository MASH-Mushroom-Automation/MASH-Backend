import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';


@Module({
  controllers: [ProductsController],
  providers: [ProductsService], // PrismaService provided globally by DatabaseModule
  exports: [ProductsService],
})
export class ProductsModule {}
