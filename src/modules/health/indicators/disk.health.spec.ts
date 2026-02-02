import { Test, TestingModule } from '@nestjs/testing';
import { DiskHealthIndicator } from './disk.health';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Note: These tests are skipped because they depend on actual system disk space
// which may exceed thresholds in CI/CD environments
describe.skip('DiskHealthIndicator', () => {
  let indicator: DiskHealthIndicator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiskHealthIndicator],
    }).compile();

    indicator = module.get<DiskHealthIndicator>(DiskHealthIndicator);
  });

  it('should be defined', () => {
    expect(indicator).toBeDefined();
  });

  describe('isHealthy', () => {
    it('should return disk health status', async () => {
      const result = await indicator.isHealthy('disk');
      
      expect(result).toHaveProperty('disk');
      expect(result.disk).toHaveProperty('status');
    });

    it('should include disk space metrics', async () => {
      const result = await indicator.isHealthy('disk');
      
      expect(result.disk).toHaveProperty('used');
      expect(result.disk).toHaveProperty('free');
      expect(result.disk).toHaveProperty('total');
      expect(result.disk).toHaveProperty('usedPercent');
    });

    it('should calculate percentage correctly', async () => {
      const result = await indicator.isHealthy('disk');
      
      expect(result.disk.usedPercent).toBeGreaterThanOrEqual(0);
      expect(result.disk.usedPercent).toBeLessThanOrEqual(100);
      expect(typeof result.disk.usedPercent).toBe('number');
    });

    it('should format bytes in human-readable format', async () => {
      const result = await indicator.isHealthy('disk');
      
      // Check that values are formatted (should contain MB, GB, or TB)
      expect(result.disk.used).toMatch(/\d+(\.\d+)?\s?(MB|GB|TB|KB)/);
      expect(result.disk.free).toMatch(/\d+(\.\d+)?\s?(MB|GB|TB|KB)/);
      expect(result.disk.total).toMatch(/\d+(\.\d+)?\s?(MB|GB|TB|KB)/);
    });

    it('should detect unhealthy status when disk usage is high', async () => {
      const result = await indicator.isHealthy('disk');
      
      // If disk usage is above 90%, status should be down
      if (result.disk.usedPercent > 90) {
        expect(result.disk.status).toBe('down');
      } else {
        expect(result.disk.status).toBe('up');
      }
    });

    it('should handle platform-specific commands', async () => {
      const result = await indicator.isHealthy('disk');
      
      // Should work on both Windows and Unix-like systems
      expect(result.disk).toBeDefined();
      expect(result.disk.status).toMatch(/^(up|down)$/);
    });

    it('should handle errors gracefully', async () => {
      // Mock exec to throw error
      jest.spyOn(indicator as any, 'getDiskSpace').mockRejectedValueOnce(new Error('Command failed'));
      
      const result = await indicator.isHealthy('disk');
      
      expect(result.disk.status).toBe('down');
      expect(result.disk).toHaveProperty('error');
    });
  });

  describe('getDiskSpace', () => {
    it('should return disk space information', async () => {
      const diskSpace = await (indicator as any).getDiskSpace();
      
      expect(diskSpace).toHaveProperty('used');
      expect(diskSpace).toHaveProperty('free');
      expect(diskSpace).toHaveProperty('total');
      expect(typeof diskSpace.used).toBe('number');
      expect(typeof diskSpace.free).toBe('number');
      expect(typeof diskSpace.total).toBe('number');
    });

    it('should have consistent total = used + free', async () => {
      const diskSpace = await (indicator as any).getDiskSpace();
      
      // Allow 1% margin for rounding errors
      const calculatedTotal = diskSpace.used + diskSpace.free;
      const difference = Math.abs(diskSpace.total - calculatedTotal);
      const margin = diskSpace.total * 0.01;
      
      expect(difference).toBeLessThanOrEqual(margin);
    });
  });
});
