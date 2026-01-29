import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../common/services/cache.service';

@Injectable()
export class DeviceStatusTask {
  private readonly logger = new Logger(DeviceStatusTask.name);
  // Offline threshold in minutes (15 minutes)
  private readonly OFFLINE_THRESHOLD_MINUTES = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Scheduled task that runs every day at 5 AM to check for devices
   * that haven't reported in the last 15 minutes and mark them as offline.
   * Reduced frequency to minimize backend load.
   */
  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async checkOfflineDevices() {
    this.logger.log('Running scheduled task to check for offline devices');
    return this.performDeviceStatusCheck();
  }

  /**
   * On-demand device status check that can be called from API endpoints.
   * Used by Admin Dashboard when viewing the devices page.
   */
  async checkDeviceStatusOnDemand() {
    this.logger.log('Running on-demand device status check');
    return this.performDeviceStatusCheck();
  }

  /**
   * Actual implementation of device status checking logic
   */
  private async performDeviceStatusCheck() {
    try {
      // Calculate the threshold time (15 minutes ago)
      const thresholdTime = new Date();
      thresholdTime.setMinutes(thresholdTime.getMinutes() - this.OFFLINE_THRESHOLD_MINUTES);
      // Find all devices that are currently marked as ONLINE but haven't reported
      // in the last 15 minutes
      const devicesToUpdate = await this.prisma.device.findMany({
        where: {
          status: 'ONLINE',
          lastSeen: {
            lt: thresholdTime,
          },
        },
        select: {
          id: true,
          serialNumber: true,
          name: true,
          lastSeen: true,
        },
      });
      if (devicesToUpdate.length === 0) {
        this.logger.log('No devices need to be marked as offline');
        return;
      }
      this.logger.log(`Found ${devicesToUpdate.length} devices to mark as offline`);
      // Update each device to OFFLINE status
      for (const device of devicesToUpdate) {
        await this.prisma.device.update({
          where: { id: device.id },
          data: { status: 'OFFLINE' },
        });
        // Invalidate device cache
        await this.cacheService.invalidateByTags([
          'devices',
          'devices:list',
          `device:${device.id}`,
        ]);
        this.logger.log(
          `Marked device as OFFLINE: ${device.name} (${device.serialNumber}) - ` +
            `Last seen: ${device.lastSeen.toISOString()}`,
        );
      }
      this.logger.log(`Successfully updated ${devicesToUpdate.length} devices to OFFLINE status`);
      return { updated: devicesToUpdate.length, devices: devicesToUpdate };
    } catch (error) {
      this.logger.error(`Error checking for offline devices: ${error.message}`, error.stack);
      throw error;
    }
  }
}
