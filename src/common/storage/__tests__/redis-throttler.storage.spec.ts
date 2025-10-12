import { RedisThrottlerStorage } from '../redis-throttler.storage';
import { RedisService } from '../../../database/redis.service';

/**
 * Unit Tests for RedisThrottlerStorage
 *
 * Tests distributed rate limiting storage adapter for @nestjs/throttler
 *
 * Test Coverage:
 * 1. Redis-backed increment operations
 * 2. Fallback to in-memory storage when Redis unavailable
 * 3. TTL expiration handling
 * 4. Atomic increment operations
 * 5. Get current throttle record
 * 6. Cleanup expired in-memory records
 */

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    // Create mock RedisService
    redisService = {
      isAvailable: jest.fn(),
      increment: jest.fn(),
      setExpiration: jest.fn(),
      getTTL: jest.fn(),
      get: jest.fn(),
    } as any;

    storage = new RedisThrottlerStorage(redisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with Redis available', () => {
      redisService.isAvailable.mockReturnValue(true);
      const storageWithRedis = new RedisThrottlerStorage(redisService);
      expect(storageWithRedis).toBeDefined();
      expect(redisService.isAvailable).toHaveBeenCalled();
    });

    it('should initialize with Redis unavailable (fallback mode)', () => {
      redisService.isAvailable.mockReturnValue(false);
      const storageWithoutRedis = new RedisThrottlerStorage(redisService);
      expect(storageWithoutRedis).toBeDefined();
      expect(redisService.isAvailable).toHaveBeenCalled();
    });
  });

  describe('increment (Redis mode)', () => {
    beforeEach(() => {
      redisService.isAvailable.mockReturnValue(true);
    });

    it('should increment counter in Redis for first request', async () => {
      redisService.increment.mockResolvedValue(1);
      redisService.setExpiration.mockResolvedValue(true);
      redisService.getTTL.mockResolvedValue(60);

      const result = await storage.increment(
        '192.168.1.1:/api/auth/login',
        60000, // 60 seconds TTL
        5,
        0,
        'short',
      );

      expect(redisService.increment).toHaveBeenCalledWith(
        'throttle:192.168.1.1:/api/auth/login',
      );
      expect(redisService.setExpiration).toHaveBeenCalledWith(
        'throttle:192.168.1.1:/api/auth/login',
        60,
      );
      expect(redisService.getTTL).toHaveBeenCalledWith(
        'throttle:192.168.1.1:/api/auth/login',
      );
      expect(result).toEqual({
        totalHits: 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    });

    it('should increment counter in Redis for subsequent requests', async () => {
      redisService.increment.mockResolvedValue(3);
      redisService.getTTL.mockResolvedValue(45);

      const result = await storage.increment(
        '192.168.1.1:/api/auth/login',
        60000,
        5,
        0,
        'short',
      );

      expect(redisService.increment).toHaveBeenCalled();
      expect(redisService.setExpiration).not.toHaveBeenCalled(); // Only set on first request
      expect(result.totalHits).toBe(3);
      expect(result.timeToExpire).toBe(45);
    });

    it('should handle negative TTL gracefully', async () => {
      redisService.increment.mockResolvedValue(2);
      redisService.getTTL.mockResolvedValue(-1);

      const result = await storage.increment(
        '192.168.1.1:/api/test',
        60000,
        10,
        0,
        'default',
      );

      expect(result.timeToExpire).toBe(0); // Negative TTL converted to 0
    });

    it('should use key prefix for Redis keys', async () => {
      redisService.increment.mockResolvedValue(1);
      redisService.setExpiration.mockResolvedValue(true);
      redisService.getTTL.mockResolvedValue(60);

      await storage.increment('test-key', 60000, 10, 0, 'default');

      expect(redisService.increment).toHaveBeenCalledWith('throttle:test-key');
      expect(redisService.setExpiration).toHaveBeenCalledWith(
        'throttle:test-key',
        60,
      );
    });

    it('should convert milliseconds to seconds for TTL', async () => {
      redisService.increment.mockResolvedValue(1);
      redisService.setExpiration.mockResolvedValue(true);
      redisService.getTTL.mockResolvedValue(900);

      await storage.increment('test-key', 900000, 5, 0, 'short'); // 15 minutes

      expect(redisService.setExpiration).toHaveBeenCalledWith(
        'throttle:test-key',
        900,
      ); // 900 seconds
    });

    it('should round up fractional seconds', async () => {
      redisService.increment.mockResolvedValue(1);
      redisService.setExpiration.mockResolvedValue(true);
      redisService.getTTL.mockResolvedValue(61);

      await storage.increment('test-key', 60500, 10, 0, 'default'); // 60.5 seconds

      expect(redisService.setExpiration).toHaveBeenCalledWith(
        'throttle:test-key',
        61,
      ); // Rounded up
    });

    it('should fallback to memory on Redis error', async () => {
      redisService.increment.mockRejectedValue(
        new Error('Redis connection error'),
      );

      const result = await storage.increment(
        'test-key',
        60000,
        10,
        0,
        'default',
      );

      expect(result.totalHits).toBe(1); // Fallback to memory, first request
      expect(result.timeToExpire).toBeGreaterThan(0);
    });
  });

  describe('increment (in-memory fallback mode)', () => {
    beforeEach(() => {
      redisService.isAvailable.mockReturnValue(false);
    });

    it('should increment counter in memory for first request', async () => {
      const result = await storage.increment(
        '192.168.1.1:/api/test',
        60000,
        10,
        0,
        'default',
      );

      expect(result.totalHits).toBe(1);
      expect(result.timeToExpire).toBeCloseTo(60, 0);
      expect(result.isBlocked).toBe(false);
      expect(result.timeToBlockExpire).toBe(0);
    });

    it('should increment counter in memory for subsequent requests', async () => {
      await storage.increment('test-key', 60000, 10, 0, 'default');
      const result = await storage.increment(
        'test-key',
        60000,
        10,
        0,
        'default',
      );

      expect(result.totalHits).toBe(2);
    });

    it('should reset counter after TTL expiration', async () => {
      // First request
      await storage.increment('test-key', 100, 10, 0, 'default'); // 100ms TTL

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next request should reset counter
      const result = await storage.increment('test-key', 100, 10, 0, 'default');

      expect(result.totalHits).toBe(1); // Reset to 1
    });

    it('should handle multiple keys independently', async () => {
      const result1 = await storage.increment('key1', 60000, 10, 0, 'default');
      const result2 = await storage.increment('key2', 60000, 10, 0, 'default');
      const result3 = await storage.increment('key1', 60000, 10, 0, 'default');

      expect(result1.totalHits).toBe(1);
      expect(result2.totalHits).toBe(1);
      expect(result3.totalHits).toBe(2); // key1 incremented again
    });

    it('should calculate remaining TTL correctly', async () => {
      const result1 = await storage.increment(
        'test-key',
        60000,
        10,
        0,
        'default',
      );
      expect(result1.timeToExpire).toBeCloseTo(60, 0);

      // Wait 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result2 = await storage.increment(
        'test-key',
        60000,
        10,
        0,
        'default',
      );
      expect(result2.timeToExpire).toBeCloseTo(59, 1); // ~59 seconds remaining
    });
  });

  describe('get', () => {
    it('should get current throttle record from Redis', async () => {
      redisService.isAvailable.mockReturnValue(true);
      redisService.get.mockResolvedValue(5);
      redisService.getTTL.mockResolvedValue(45);

      const result = await storage.get('test-key');

      expect(redisService.get).toHaveBeenCalledWith('throttle:test-key');
      expect(redisService.getTTL).toHaveBeenCalledWith('throttle:test-key');
      expect(result).toEqual({
        totalHits: 5,
        timeToExpire: 45,
      });
    });

    it('should return null if key does not exist in Redis', async () => {
      redisService.isAvailable.mockReturnValue(true);
      redisService.get.mockResolvedValue(null);

      const result = await storage.get('nonexistent-key');

      expect(result).toBeNull();
    });

    it('should handle negative TTL from Redis', async () => {
      redisService.isAvailable.mockReturnValue(true);
      redisService.get.mockResolvedValue(3);
      redisService.getTTL.mockResolvedValue(-2); // Key doesn't exist

      const result = await storage.get('test-key');

      expect(result?.timeToExpire).toBe(0);
    });

    it('should fallback to memory on Redis error', async () => {
      redisService.isAvailable.mockReturnValue(true);
      redisService.get.mockRejectedValue(new Error('Redis error'));

      // First, increment in memory (will happen due to fallback)
      await storage.increment('test-key', 60000, 10, 0, 'default');

      // Now get should fallback to memory
      const result = await storage.get('test-key');

      expect(result).toBeNull(); // Memory store is separate, won't have this key
    });

    it('should get record from memory when Redis unavailable', async () => {
      redisService.isAvailable.mockReturnValue(false);

      // Increment to create memory record
      await storage.increment('test-key', 60000, 10, 0, 'default');

      const result = await storage.get('test-key');

      expect(result).not.toBeNull();
      expect(result?.totalHits).toBe(1);
      expect(result?.timeToExpire).toBeCloseTo(60, 1);
    });

    it('should return null for expired memory record', async () => {
      redisService.isAvailable.mockReturnValue(false);

      // Create record with short TTL
      await storage.increment('test-key', 100, 10, 0, 'default');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result = await storage.get('test-key');

      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredRecords', () => {
    beforeEach(() => {
      redisService.isAvailable.mockReturnValue(false);
    });

    it('should remove expired records from memory', async () => {
      // Create records with short TTL
      await storage.increment('key1', 100, 10, 0, 'default');
      await storage.increment('key2', 100, 10, 0, 'default');
      await storage.increment('key3', 60000, 10, 0, 'default'); // Long TTL

      // Wait for short TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Cleanup
      storage.cleanupExpiredRecords();

      // Verify key3 still exists
      const result3 = await storage.get('key3');
      expect(result3).not.toBeNull();
      expect(result3?.totalHits).toBe(1);

      // Verify key1 and key2 are gone
      const result1 = await storage.get('key1');
      const result2 = await storage.get('key2');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should not affect Redis-backed storage', () => {
      redisService.isAvailable.mockReturnValue(true);

      // Cleanup should not throw or affect Redis
      expect(() => storage.cleanupExpiredRecords()).not.toThrow();
    });

    it('should handle empty memory storage', () => {
      expect(() => storage.cleanupExpiredRecords()).not.toThrow();
    });

    it('should handle multiple cleanup calls', async () => {
      await storage.increment('key1', 100, 10, 0, 'default');

      storage.cleanupExpiredRecords(); // First cleanup (not expired yet)

      const result1 = await storage.get('key1');
      expect(result1).not.toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 150)); // Wait for expiration

      storage.cleanupExpiredRecords(); // Second cleanup (should remove)
      storage.cleanupExpiredRecords(); // Third cleanup (no-op)

      const result2 = await storage.get('key1');
      expect(result2).toBeNull();
    });
  });

  describe('distributed rate limiting simulation', () => {
    it('should handle concurrent increments from multiple instances', async () => {
      redisService.isAvailable.mockReturnValue(true);

      // Simulate 5 concurrent requests
      let count = 0;
      redisService.increment.mockImplementation(async () => {
        count++;
        return count;
      });
      redisService.getTTL.mockResolvedValue(60);

      const promises = Array.from({ length: 5 }, () =>
        storage.increment('test-key', 60000, 10, 0, 'default'),
      );

      const results = await Promise.all(promises);

      expect(results.map((r) => r.totalHits)).toEqual([1, 2, 3, 4, 5]);
      expect(redisService.increment).toHaveBeenCalledTimes(5);
    });

    it('should use same Redis key for same IP + endpoint combination', async () => {
      redisService.isAvailable.mockReturnValue(true);
      redisService.increment.mockResolvedValue(1);
      redisService.setExpiration.mockResolvedValue(true);
      redisService.getTTL.mockResolvedValue(60);

      const key1 = '192.168.1.1:/api/auth/login';
      const key2 = '192.168.1.1:/api/auth/login';

      await storage.increment(key1, 60000, 5, 0, 'short');
      await storage.increment(key2, 60000, 5, 0, 'short');

      expect(redisService.increment).toHaveBeenCalledWith('throttle:' + key1);
      expect(redisService.increment).toHaveBeenCalledWith('throttle:' + key2);
      expect(redisService.increment).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle zero TTL', async () => {
      redisService.isAvailable.mockReturnValue(true);
      redisService.increment.mockResolvedValue(1);
      redisService.setExpiration.mockResolvedValue(true);
      redisService.getTTL.mockResolvedValue(0);

      const result = await storage.increment('test-key', 0, 10, 0, 'default');

      expect(result.totalHits).toBe(1);
      expect(result.timeToExpire).toBe(0);
    });

    it('should handle very large TTL', async () => {
      redisService.isAvailable.mockReturnValue(true);
      redisService.increment.mockResolvedValue(1);
      redisService.setExpiration.mockResolvedValue(true);
      redisService.getTTL.mockResolvedValue(86400);

      const result = await storage.increment(
        'test-key',
        86400000, // 1 day
        10,
        0,
        'default',
      );

      expect(redisService.setExpiration).toHaveBeenCalledWith(
        'throttle:test-key',
        86400,
      );
      expect(result.timeToExpire).toBe(86400);
    });

    it('should handle special characters in keys', async () => {
      redisService.isAvailable.mockReturnValue(true);
      redisService.increment.mockResolvedValue(1);
      redisService.setExpiration.mockResolvedValue(true);
      redisService.getTTL.mockResolvedValue(60);

      const specialKey = '192.168.1.1:/api/test?param=value&foo=bar';
      await storage.increment(specialKey, 60000, 10, 0, 'default');

      expect(redisService.increment).toHaveBeenCalledWith(
        'throttle:' + specialKey,
      );
    });

    it('should handle empty string key', async () => {
      redisService.isAvailable.mockReturnValue(true);
      redisService.increment.mockResolvedValue(1);
      redisService.setExpiration.mockResolvedValue(true);
      redisService.getTTL.mockResolvedValue(60);

      await storage.increment('', 60000, 10, 0, 'default');

      expect(redisService.increment).toHaveBeenCalledWith('throttle:');
    });
  });
});
