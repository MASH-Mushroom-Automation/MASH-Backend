import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStateMachineService } from './state-machine/order-state-machine.service';
import { OrderRepository } from './repositories/order.repository';
import { OrderWorkflowService } from './services/order-workflow.service';
import { OrderValidationService } from './services/order-validation.service';
import { OrderPricingService } from './services/order-pricing.service';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderStateMachineService,
    OrderRepository,
    OrderWorkflowService,
    OrderValidationService,
    OrderPricingService,
  ], // PrismaService provided globally by DatabaseModule
  exports: [
    OrdersService,
    OrderStateMachineService,
    OrderRepository,
    OrderWorkflowService,
    OrderValidationService,
    OrderPricingService,
  ],
})
export class OrdersModule {}
