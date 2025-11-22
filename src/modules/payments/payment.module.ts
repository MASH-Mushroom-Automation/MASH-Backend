import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { GCashProvider } from './providers/gcash.provider';
import { PaymentProvider } from './enums/payment.enum';

/**
 * Payment Module
 * 
 * Manages payment processing with multiple providers:
 * - PayMongo: Credit/debit cards, e-wallets (not yet configured)
 * - GCash: Direct GCash integration ✅
 * - Maya: Maya wallet integration (pending)
 * 
 * Features:
 * - Factory pattern for provider selection
 * - Webhook handling for async notifications
 * - Payment status tracking
 * - Refund processing
 * 
 * Setup Required:
 * - Configure GCash API credentials in .env:
 *   GCASH_API_KEY, GCASH_API_SECRET, GCASH_MERCHANT_ID, GCASH_WEBHOOK_SECRET
 */
@Module({
  imports: [ConfigModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    GCashProvider,
    {
      provide: 'PAYMENT_PROVIDERS_INIT',
      useFactory: (
        paymentService: PaymentService,
        gcashProvider: GCashProvider,
      ) => {
        // Register GCash provider on module initialization
        paymentService.registerProvider(PaymentProvider.GCASH, gcashProvider);
        
        return { gcash: gcashProvider };
      },
      inject: [PaymentService, GCashProvider],
    },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
