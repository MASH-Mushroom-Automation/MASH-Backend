import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStateMachineService } from './state-machine/order-state-machine.service';
import { OrderRepository } from './repositories/order.repository';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderStateMachineService,
    OrderRepository,
  ], // PrismaService provided globally by DatabaseModule
  exports: [OrdersService, OrderStateMachineService, OrderRepository],
})
export class OrdersModule {}
