import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { LalamoveController } from './lalamove.controller';
import { LalamoveService } from './lalamove.service';
import { LalamoveApiService } from './services/lalamove-api.service';
import { WebhookService } from './services/webhook.service';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * LalamoveModule
 * Handles Lalamove delivery integration for Philippines market
 * 
 * Features:
 * - Quotation management
 * - Order creation and tracking
 * - Driver information
 * - Priority fee management
 * - Webhook notifications
 * - Integration with NotificationService
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 seconds
      maxRedirects: 5,
    }),
    ConfigModule,
    NotificationsModule, // Import for webhook notifications
  ],
  controllers: [LalamoveController],
  providers: [
    LalamoveService,
    LalamoveApiService,
    WebhookService,
    WebhookSignatureGuard,
    PrismaService,
  ],
  exports: [LalamoveService, LalamoveApiService, WebhookService],
})
export class LalamoveModule {}
