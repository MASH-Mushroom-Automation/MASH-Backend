import { Module } from '@nestjs/common';
import { SellerVerificationController } from './seller-verification.controller';
import { SellerVerificationService } from './seller-verification.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SellerVerificationController],
  providers: [SellerVerificationService, PrismaService],
  exports: [SellerVerificationService],
})
export class SellerVerificationModule {}
