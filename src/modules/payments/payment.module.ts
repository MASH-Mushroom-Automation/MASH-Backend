import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

/**
 * Payment Module
 * 
 * Manages payment processing with multiple providers:
 * - PayMongo: Credit/debit cards, e-wallets
 * - GCash: Direct GCash integration
 * - Maya: Maya wallet integration
 * 
 * Features:
 * - Factory pattern for provider selection
 * - Webhook handling for async notifications
 * - Payment status tracking
 * - Refund processing
 */
@Module({
  imports: [],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
