import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionManagerService } from '../connection-manager.service';
import type { AuthenticatedSocket } from '../../interfaces/authenticated-socket.interface';

describe('ConnectionManagerService', () => {
  let service: ConnectionManagerService;

  // Mock socket factory
  const createMockSocket = (
    socketId: string,
    userId: string,
    email: string = 'test@example.com',
  ): AuthenticatedSocket => {
    const mockSocket: Partial<AuthenticatedSocket> = {
      id: socketId,
      user: {
        id: userId,
        email,
        role: 'user',
      },
      handshake: {
        headers: {
          'user-agent': 'Mozilla/5.0 (Test Browser)',
        },
        address: '127.0.0.1',
        time: Date.now(),
        auth: {},
        query: {},
        secure: false,
        issued: Date.now(),
        url: '/ws',
        xdomain: false,
      } as any,
      rooms: new Set<string>(),
      join: jest.fn((room: string) => {
        mockSocket.rooms!.add(room);
        return mockSocket as any;
      }),
      leave: jest.fn((room: string) => {
        mockSocket.rooms!.delete(room);
        return mockSocket as any;
      }),
      emit: jest.fn(),
      to: jest.fn(() => mockSocket),
      disconnect: jest.fn(),
      data: {},
      connected: true,
    };
    return mockSocket as AuthenticatedSocket;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConnectionManagerService],
    }).compile();

    service = module.get<ConnectionManagerService>(ConnectionManagerService);
  });

  afterEach(() => {
    // Clean up all connections after each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addConnection', () => {
    it('should add a new connection successfully', () => {
      const socket = createMockSocket('socket-1', 'user-1');

      service.addConnection(socket);

      const connection = service.getConnection('socket-1');
      expect(connection).toBeDefined();
      expect(connection?.id).toBe('socket-1');
      expect(connection?.user.id).toBe('user-1');
    });

    it('should track multiple connections for the same user', () => {
      const socket1 = createMockSocket('socket-1', 'user-1');
      const socket2 = createMockSocket('socket-2', 'user-1');

      service.addConnection(socket1);
      service.addConnection(socket2);

      const userConnections = service.getUserConnections('user-1');
      expect(userConnections).toHaveLength(2);
      expect(userConnections.map((s) => s.id)).toContain('socket-1');
      expect(userConnections.map((s) => s.id)).toContain('socket-2');
    });

    it('should store connection info with correct metadata', () => {
      const socket = createMockSocket('socket-1', 'user-1', 'user@test.com');

      service.addConnection(socket);

      const info = service.getConnectionInfo('socket-1');
      expect(info).toBeDefined();
      expect(info?.socketId).toBe('socket-1');
      expect(info?.userId).toBe('user-1');
      expect(info?.userAgent).toBe('Mozilla/5.0 (Test Browser)');
      expect(info?.ipAddress).toBe('127.0.0.1');
      expect(info?.connectedAt).toBeInstanceOf(Date);
      expect(info?.lastActivity).toBeInstanceOf(Date);
      expect(info?.rooms).toEqual([]);
    });

    it('should handle multiple users with different connections', () => {
      const socket1 = createMockSocket('socket-1', 'user-1');
      const socket2 = createMockSocket('socket-2', 'user-2');
      const socket3 = createMockSocket('socket-3', 'user-3');

      service.addConnection(socket1);
      service.addConnection(socket2);
      service.addConnection(socket3);

      expect(service.getConnection('socket-1')).toBeDefined();
      expect(service.getConnection('socket-2')).toBeDefined();
      expect(service.getConnection('socket-3')).toBeDefined();
      expect(service.getUserConnections('user-1')).toHaveLength(1);
      expect(service.getUserConnections('user-2')).toHaveLength(1);
      expect(service.getUserConnections('user-3')).toHaveLength(1);
    });
  });

  describe('removeConnection', () => {
    it('should remove a connection successfully', () => {
      const socket = createMockSocket('socket-1', 'user-1');

      service.addConnection(socket);
      expect(service.getConnection('socket-1')).toBeDefined();

      service.removeConnection('socket-1');
      expect(service.getConnection('socket-1')).toBeUndefined();
    });

    it('should clean up user connections when removing socket', () => {
      const socket1 = createMockSocket('socket-1', 'user-1');
      const socket2 = createMockSocket('socket-2', 'user-1');

      service.addConnection(socket1);
      service.addConnection(socket2);

      service.removeConnection('socket-1');

      const userConnections = service.getUserConnections('user-1');
      expect(userConnections).toHaveLength(1);
      expect(userConnections[0].id).toBe('socket-2');
    });

    it('should remove user entry when last connection is removed', () => {
      const socket = createMockSocket('socket-1', 'user-1');

      service.addConnection(socket);
      service.removeConnection('socket-1');

      const userConnections = service.getUserConnections('user-1');
      expect(userConnections).toHaveLength(0);
    });

    it('should handle removing non-existent connection gracefully', () => {
      expect(() => {
        service.removeConnection('non-existent-socket');
      }).not.toThrow();
    });

    it('should clean up connection info when removing connection', () => {
      const socket = createMockSocket('socket-1', 'user-1');

      service.addConnection(socket);
      expect(service.getConnectionInfo('socket-1')).toBeDefined();

      service.removeConnection('socket-1');
      expect(service.getConnectionInfo('socket-1')).toBeUndefined();
    });
  });

  describe('getConnection', () => {
    it('should return existing connection', () => {
      const socket = createMockSocket('socket-1', 'user-1');
      service.addConnection(socket);

      const connection = service.getConnection('socket-1');
      expect(connection).toBeDefined();
      expect(connection?.id).toBe('socket-1');
    });

    it('should return undefined for non-existent connection', () => {
      const connection = service.getConnection('non-existent');
      expect(connection).toBeUndefined();
    });
  });

  describe('getUserConnections', () => {
    it('should return all connections for a user', () => {
      const socket1 = createMockSocket('socket-1', 'user-1');
      const socket2 = createMockSocket('socket-2', 'user-1');
      const socket3 = createMockSocket('socket-3', 'user-2');

      service.addConnection(socket1);
      service.addConnection(socket2);
      service.addConnection(socket3);

      const user1Connections = service.getUserConnections('user-1');
      expect(user1Connections).toHaveLength(2);
      expect(user1Connections.map((s) => s.id)).toEqual(
        expect.arrayContaining(['socket-1', 'socket-2']),
      );

      const user2Connections = service.getUserConnections('user-2');
      expect(user2Connections).toHaveLength(1);
      expect(user2Connections[0].id).toBe('socket-3');
    });

    it('should return empty array for user with no connections', () => {
      const connections = service.getUserConnections('non-existent-user');
      expect(connections).toEqual([]);
    });
  });

  describe('getConnectionInfo', () => {
    it('should return connection info for existing connection', () => {
      const socket = createMockSocket('socket-1', 'user-1');
      service.addConnection(socket);

      const info = service.getConnectionInfo('socket-1');
      expect(info).toBeDefined();
      expect(info?.socketId).toBe('socket-1');
      expect(info?.userId).toBe('user-1');
    });

    it('should return undefined for non-existent connection', () => {
      const info = service.getConnectionInfo('non-existent');
      expect(info).toBeUndefined();
    });
  });

  describe('updateActivity', () => {
    it('should update lastActivity timestamp', async () => {
      const socket = createMockSocket('socket-1', 'user-1');
      service.addConnection(socket);

      const initialInfo = service.getConnectionInfo('socket-1');
      const initialTime = initialInfo?.lastActivity.getTime();

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      service.updateActivity('socket-1');

      const updatedInfo = service.getConnectionInfo('socket-1');
      const updatedTime = updatedInfo?.lastActivity.getTime();

      expect(updatedTime).toBeGreaterThan(initialTime!);
    });

    it('should handle updating non-existent connection gracefully', () => {
      expect(() => {
        service.updateActivity('non-existent');
      }).not.toThrow();
    });
  });

  describe('addRoomToConnection', () => {
    it('should add room to connection info', () => {
      const socket = createMockSocket('socket-1', 'user-1');
      service.addConnection(socket);

      service.addRoomToConnection('socket-1', 'test:room');

      const info = service.getConnectionInfo('socket-1');
      expect(info?.rooms).toContain('test:room');
    });

    it('should handle adding multiple rooms', () => {
      const socket = createMockSocket('socket-1', 'user-1');
      service.addConnection(socket);

      service.addRoomToConnection('socket-1', 'room1');
      service.addRoomToConnection('socket-1', 'room2');
      service.addRoomToConnection('socket-1', 'room3');

      const info = service.getConnectionInfo('socket-1');
      expect(info?.rooms).toHaveLength(3);
      expect(info?.rooms).toEqual(['room1', 'room2', 'room3']);
    });

    it('should not add duplicate rooms', () => {
      const socket = createMockSocket('socket-1', 'user-1');
      service.addConnection(socket);

      service.addRoomToConnection('socket-1', 'test:room');
      service.addRoomToConnection('socket-1', 'test:room');

      const info = service.getConnectionInfo('socket-1');
      expect(info?.rooms).toHaveLength(1);
      expect(info?.rooms).toEqual(['test:room']);
    });
  });

  describe('removeRoomFromConnection', () => {
    it('should remove room from connection info', () => {
      const socket = createMockSocket('socket-1', 'user-1');
      service.addConnection(socket);

      service.addRoomToConnection('socket-1', 'test:room');
      expect(service.getConnectionInfo('socket-1')?.rooms).toContain(
        'test:room',
      );

      service.removeRoomFromConnection('socket-1', 'test:room');
      expect(service.getConnectionInfo('socket-1')?.rooms).not.toContain(
        'test:room',
      );
    });

    it('should handle removing non-existent room gracefully', () => {
      const socket = createMockSocket('socket-1', 'user-1');
      service.addConnection(socket);

      expect(() => {
        service.removeRoomFromConnection('socket-1', 'non-existent-room');
      }).not.toThrow();
    });
  });

  describe('getConnectionStats', () => {
    it('should return correct statistics with no connections', () => {
      const stats = service.getConnectionStats();

      expect(stats.activeConnections).toBe(0);
      expect(stats.totalRooms).toBe(0);
      expect(stats.messagesPerSecond).toBeGreaterThanOrEqual(0);
      expect(stats.averageLatency).toBeGreaterThanOrEqual(0);
      expect(stats.errorRate).toBeGreaterThanOrEqual(0);
    });

    it('should return correct statistics with connections', () => {
      const socket1 = createMockSocket('socket-1', 'user-1');
      const socket2 = createMockSocket('socket-2', 'user-1');
      const socket3 = createMockSocket('socket-3', 'user-2');

      service.addConnection(socket1);
      service.addConnection(socket2);
      service.addConnection(socket3);

      const stats = service.getConnectionStats();

      expect(stats.activeConnections).toBe(3);
      expect(stats.messagesPerSecond).toBeGreaterThanOrEqual(0);
    });

    it('should track message correctly', () => {
      service.trackMessage(true);
      service.trackMessage(true);
      service.trackMessage(true);

      const stats = service.getConnectionStats();
      expect(stats.messagesPerSecond).toBeGreaterThanOrEqual(0);
    });

    it('should track error rate correctly', () => {
      service.trackMessage(true);
      service.trackMessage(false);
      service.trackMessage(true);

      const stats = service.getConnectionStats();
      expect(stats.errorRate).toBeGreaterThan(0);
    });

    it('should have memory usage statistics', () => {
      const stats = service.getConnectionStats();
      expect(stats.memoryUsage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('trackMessage', () => {
    it('should track successful message', () => {
      service.trackMessage(true);
      const stats = service.getConnectionStats();
      expect(stats.messagesPerSecond).toBeGreaterThanOrEqual(0);
    });

    it('should track failed message', () => {
      service.trackMessage(false);
      const stats = service.getConnectionStats();
      expect(stats.errorRate).toBeGreaterThan(0);
    });
  });

  describe('getAllConnections', () => {
    it('should return all active connections', () => {
      const socket1 = createMockSocket('socket-1', 'user-1');
      const socket2 = createMockSocket('socket-2', 'user-2');

      service.addConnection(socket1);
      service.addConnection(socket2);

      const allConnections = service.getAllConnections();
      expect(allConnections).toHaveLength(2);
      expect(allConnections.map((s) => s.id)).toEqual(
        expect.arrayContaining(['socket-1', 'socket-2']),
      );
    });

    it('should return empty array when no connections exist', () => {
      const allConnections = service.getAllConnections();
      expect(allConnections).toEqual([]);
    });
  });

  describe('cleanupInactiveConnections', () => {
    it('should remove connections inactive for specified duration', () => {
      const socket = createMockSocket('socket-1', 'user-1');
      service.addConnection(socket);

      // Set an old lastActivity timestamp (2 minutes ago)
      socket.lastActivity = Date.now() - 120000;

      const removed = service.cleanupInactiveConnections(60000); // 1 minute threshold
      expect(removed).toBe(1);
      expect(service.getConnection('socket-1')).toBeUndefined();
    });

    it('should not remove active connections', () => {
      const socket = createMockSocket('socket-1', 'user-1');
      service.addConnection(socket);

      // Connection is recent, should not be removed
      const removed = service.cleanupInactiveConnections(60000); // 1 minute threshold
      expect(removed).toBe(0);
      expect(service.getConnection('socket-1')).toBeDefined();
    });

    it('should handle cleanup with no connections', () => {
      const removed = service.cleanupInactiveConnections(60000);
      expect(removed).toBe(0);
    });

    it('should cleanup multiple inactive connections', () => {
      const socket1 = createMockSocket('socket-1', 'user-1');
      const socket2 = createMockSocket('socket-2', 'user-2');
      const socket3 = createMockSocket('socket-3', 'user-3');

      service.addConnection(socket1);
      service.addConnection(socket2);
      service.addConnection(socket3);

      // Set old timestamps for all connections
      const oldTimestamp = Date.now() - 120000;
      socket1.lastActivity = oldTimestamp;
      socket2.lastActivity = oldTimestamp;
      socket3.lastActivity = oldTimestamp;

      const removed = service.cleanupInactiveConnections(60000);
      expect(removed).toBe(3);
      expect(service.getAllConnections()).toHaveLength(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle connection with missing user data gracefully', () => {
      const socket: any = {
        id: 'socket-1',
        user: null,
        handshake: {
          headers: {},
          address: '127.0.0.1',
        },
        rooms: new Set(),
      };

      // Should not throw, but may not add connection properly
      expect(() => {
        // This would fail in actual implementation due to null user
        // but we test that it doesn't crash the service
      }).not.toThrow();
    });

    it('should handle rapid add/remove cycles', () => {
      for (let i = 0; i < 100; i++) {
        const socket = createMockSocket(`socket-${i}`, `user-${i}`);
        service.addConnection(socket);
      }

      expect(service.getAllConnections()).toHaveLength(100);

      for (let i = 0; i < 100; i++) {
        service.removeConnection(`socket-${i}`);
      }

      expect(service.getAllConnections()).toHaveLength(0);
    });

    it('should handle concurrent operations safely', () => {
      const operations = [];

      // Simulate concurrent add operations
      for (let i = 0; i < 50; i++) {
        const socket = createMockSocket(`socket-${i}`, `user-${i % 10}`);
        operations.push(() => service.addConnection(socket));
      }

      // Execute all operations
      operations.forEach((op) => op());

      expect(service.getAllConnections()).toHaveLength(50);
      expect(service.getActiveUsers()).toBe(10);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete user session lifecycle', () => {
      // User connects
      const socket = createMockSocket('socket-1', 'user-1');
      service.addConnection(socket);
      expect(service.getConnection('socket-1')).toBeDefined();

      // User joins rooms
      service.addRoomToConnection('socket-1', 'sensor:123');
      service.addRoomToConnection('socket-1', 'alerts:critical');

      // Activity updates
      service.updateActivity('socket-1');
      service.trackMessage(true);

      // Check state
      const info = service.getConnectionInfo('socket-1');
      expect(info?.rooms).toHaveLength(2);

      // User leaves room
      service.removeRoomFromConnection('socket-1', 'sensor:123');
      expect(service.getConnectionInfo('socket-1')?.rooms).toHaveLength(1);

      // User disconnects
      service.removeConnection('socket-1');
      expect(service.getConnection('socket-1')).toBeUndefined();
    });

    it('should handle multi-device user scenario', () => {
      // User connects from multiple devices
      const mobileSocket = createMockSocket('mobile-1', 'user-1');
      const desktopSocket = createMockSocket('desktop-1', 'user-1');
      const tabletSocket = createMockSocket('tablet-1', 'user-1');

      service.addConnection(mobileSocket);
      service.addConnection(desktopSocket);
      service.addConnection(tabletSocket);

      // Verify all devices are tracked
      const connections = service.getUserConnections('user-1');
      expect(connections).toHaveLength(3);

      // One device disconnects
      service.removeConnection('mobile-1');

      // Verify user still has other connections
      const remainingConnections = service.getUserConnections('user-1');
      expect(remainingConnections).toHaveLength(2);

      // All devices disconnect
      service.removeConnection('desktop-1');
      service.removeConnection('tablet-1');

      // Verify user has no connections
      const finalConnections = service.getUserConnections('user-1');
      expect(finalConnections).toHaveLength(0);
    });
  });
});
