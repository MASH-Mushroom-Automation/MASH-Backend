import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { DebugController } from './debug.controller';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../database/prisma.service';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [QueuesModule],
  controllers: [NotificationsController, DebugController],
  providers: [NotificationsService, PrismaService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
