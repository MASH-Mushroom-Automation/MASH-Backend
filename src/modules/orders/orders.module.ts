import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService], // PrismaService provided globally by DatabaseModule
  exports: [OrdersService],
})
export class OrdersModule {}
