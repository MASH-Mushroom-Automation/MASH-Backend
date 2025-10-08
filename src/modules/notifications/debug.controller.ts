import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationQueueService } from '../queues/services/notification-queue.service';

@ApiTags('Debug')
@Controller('debug')
export class DebugController {
  constructor(
    private readonly notificationQueue: NotificationQueueService,
  ) {}

  @Get('queue-stats')
  @ApiOperation({ summary: 'Get queue statistics (debug - no auth)' })
  async getQueueStats() {
    try {
      const stats = await this.notificationQueue.getQueueStats();
      
      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}