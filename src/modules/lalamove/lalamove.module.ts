import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { LalamoveController } from './lalamove.controller';
import { LalamoveService } from './lalamove.service';
import { LalamoveApiService } from './services/lalamove-api.service';
import { WebhookService } from './services/webhook.service';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { PrismaService } from '../../database/prisma.service';

/**
 * LalamoveModule
 * Provides Lalamove delivery integration functionality
 * 
 * Features:
 * - Quotation creation (immediate and scheduled)
 * - Order creation and tracking
 * - Driver information and location
 * - Webhook handling for real-time updates
 * - HMAC SHA-256 authentication
 * - Proof of Delivery (POD) support
 * 
 * Dependencies:
 * - HttpModule for API calls
 * - ConfigModule for environment variables
 * - PrismaService for database operations
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 seconds
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  controllers: [LalamoveController],
  providers: [
    LalamoveService,
    LalamoveApiService,
    WebhookService,
    WebhookSignatureGuard,
    PrismaService,
  ],
  exports: [LalamoveService, LalamoveApiService],
})
export class LalamoveModule {}
