import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';


@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService], // PrismaService provided globally by DatabaseModule
  exports: [CategoriesService],
})
export class CategoriesModule {}
