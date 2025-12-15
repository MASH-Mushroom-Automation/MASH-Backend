import { Controller, Get, Optional } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeController } from '@nestjs/swagger';
import { NotificationQueueService } from '../queues/services/notification-queue.service';

@ApiExcludeController() // Hide from Swagger docs (debug endpoint)
@ApiTags('Debug')
@Controller('debug')
export class DebugController {
  constructor(@Optional() private readonly notificationQueue: NotificationQueueService | null) {}

  @Get('queue-stats')
  @ApiOperation({ summary: 'Get queue statistics (debug - no auth)' })
  async getQueueStats() {
    if (!this.notificationQueue) {
      return {
        success: false,
        error: 'Queue service not available - Redis not configured',
        timestamp: new Date().toISOString(),
      };
    }
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
