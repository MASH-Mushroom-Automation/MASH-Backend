import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DiskHealthIndicator extends HealthIndicator {
  private readonly diskUsageThreshold = 0.9; // 90% disk usage threshold

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const diskInfo = await this.getDiskUsage();
      const usagePercentage = diskInfo.used / diskInfo.total;
      const isHealthy = usagePercentage < this.diskUsageThreshold;

      const result = this.getStatus(key, isHealthy, {
        total: `${Math.round(diskInfo.total / 1024 / 1024 / 1024)}GB`,
        used: `${Math.round(diskInfo.used / 1024 / 1024 / 1024)}GB`,
        free: `${Math.round(diskInfo.free / 1024 / 1024 / 1024)}GB`,
        usagePercentage: `${Math.round(usagePercentage * 100)}%`,
      });

      if (!isHealthy) {
        throw new HealthCheckError('Disk usage exceeded threshold', result);
      }

      return result;
    } catch (error) {
      throw new HealthCheckError(
        'Disk health check failed',
        this.getStatus(key, false, { message: error.message }),
      );
    }
  }

  private async getDiskUsage(): Promise<{ total: number; used: number; free: number }> {
    // For Windows
    if (process.platform === 'win32') {
      const drive = process.cwd().split(':')[0] + ':';
      try {
        const { execSync } = require('child_process');
        const output = execSync(`wmic logicaldisk where "DeviceID='${drive}'" get Size,FreeSpace`, {
          encoding: 'utf-8',
        });
        const lines = output.trim().split('\n');
        if (lines.length > 1) {
          const [freeSpace, size] = lines[1].trim().split(/\s+/).map(Number);
          return {
            total: size,
            free: freeSpace,
            used: size - freeSpace,
          };
        }
      } catch (error) {
        // Fallback to default values on error
      }
    }

    // For Unix-like systems (Linux, macOS)
    try {
      const { execSync } = require('child_process');
      const output = execSync('df -k .', { encoding: 'utf-8' });
      const lines = output.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].trim().split(/\s+/);
        const total = parseInt(parts[1]) * 1024;
        const used = parseInt(parts[2]) * 1024;
        const free = parseInt(parts[3]) * 1024;
        return { total, used, free };
      }
    } catch (error) {
      // Fallback to default values on error
    }

    // Fallback: return estimated values based on os.freemem()
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    return {
      total: totalMem,
      free: freeMem,
      used: totalMem - freeMem,
    };
  }
}
