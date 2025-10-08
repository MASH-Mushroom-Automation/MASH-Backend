import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { MainGateway } from '../main.gateway';
import { ConnectionManagerService } from '../../services/connection-manager.service';
import { WsJwtGuard } from '../../guards/ws-jwt.guard';
import type { AuthenticatedSocket } from '../../interfaces/authenticated-socket.interface';

describe('MainGateway', () => {
  let gateway: MainGateway;
  let connectionManager: ConnectionManagerService;
  let mockServer: Partial<Server>;

  // Mock socket factory
  const createMockSocket = (
    socketId: string,
    userId?: string,
    email?: string,
  ): Partial<AuthenticatedSocket> => {
    const mockSocket: Partial<AuthenticatedSocket> = {
      id: socketId,
      handshake: {
        headers: {
          'user-agent': 'Mozilla/5.0 (Test)',
          origin: 'http://localhost:3000',
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
        return Promise.resolve(mockSocket as any);
      }),
      leave: jest.fn((room: string) => {
        mockSocket.rooms!.delete(room);
        return Promise.resolve(mockSocket as any);
      }),
      emit: jest.fn(),
      to: jest.fn(() => mockSocket),
      disconnect: jest.fn(),
      data: {},
      connected: true,
    };

    if (userId) {
      mockSocket.user = {
        id: userId,
        email: email || `${userId}@test.com`,
        roles: ['user'],
      };
    }

    return mockSocket;
  };

  beforeEach(async () => {
    // Create mock server
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: {
        sockets: new Map(),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MainGateway,
        ConnectionManagerService,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<MainGateway>(MainGateway);
    connectionManager = module.get<ConnectionManagerService>(
      ConnectionManagerService,
    );

    // Assign mock server to gateway
    gateway.server = mockServer as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('afterInit', () => {
    it('should log initialization messages', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.afterInit(mockServer as Server);

      expect(logSpy).toHaveBeenCalledWith('WebSocket Gateway initialized');
      expect(logSpy).toHaveBeenCalledTimes(4);
    });
  });

  describe('handleConnection', () => {
    it('should handle new client connection', async () => {
      const mockSocket = createMockSocket('socket-1') as AuthenticatedSocket;
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'connected',
        expect.objectContaining({
          socketId: 'socket-1',
          message: 'Connected to WebSocket server. Please authenticate.',
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('socket-1'));
    });

    it('should log client details on connection', async () => {
      const mockSocket = createMockSocket('socket-1') as AuthenticatedSocket;
      const debugSpy = jest.spyOn(gateway['logger'], 'debug');

      await gateway.handleConnection(mockSocket);

      expect(debugSpy).toHaveBeenCalled();
    });

    it('should disconnect client on connection error', async () => {
      const mockSocket = createMockSocket('socket-1') as AuthenticatedSocket;
      mockSocket.emit = jest.fn(() => {
        throw new Error('Connection error');
      });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should remove authenticated user from connection manager', () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      connectionManager.addConnection(mockSocket);

      gateway.handleDisconnect(mockSocket);

      expect(connectionManager.getConnection('socket-1')).toBeUndefined();
    });

    it('should handle disconnection of unauthenticated client', () => {
      const mockSocket = createMockSocket('socket-1') as AuthenticatedSocket;
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.handleDisconnect(mockSocket);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unauthenticated'),
      );
    });

    it('should log active connections count after disconnect', () => {
      const mockSocket1 = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      const mockSocket2 = createMockSocket(
        'socket-2',
        'user-2',
      ) as AuthenticatedSocket;

      connectionManager.addConnection(mockSocket1);
      connectionManager.addConnection(mockSocket2);

      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.handleDisconnect(mockSocket1);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Active: 1'),
      );
    });

    it('should handle error during disconnection gracefully', () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      
      jest
        .spyOn(connectionManager, 'removeConnection')
        .mockImplementation(() => {
          throw new Error('Removal error');
        });

      const errorSpy = jest.spyOn(gateway['logger'], 'error');

      expect(() => gateway.handleDisconnect(mockSocket)).not.toThrow();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('handlePing', () => {
    it('should respond with pong and timestamp', () => {
      const mockSocket = createMockSocket('socket-1') as AuthenticatedSocket;

      const result = gateway.handlePing(mockSocket);

      expect(result).toEqual({
        event: 'pong',
        data: expect.objectContaining({
          timestamp: expect.any(String),
          latency: expect.any(Number),
        }),
      });
    });

    it('should track message on ping', () => {
      const mockSocket = createMockSocket('socket-1') as AuthenticatedSocket;
      const trackSpy = jest.spyOn(connectionManager, 'trackMessage');

      gateway.handlePing(mockSocket);

      expect(trackSpy).toHaveBeenCalledWith(true);
    });

    it('should calculate latency correctly', () => {
      const mockSocket = createMockSocket('socket-1') as AuthenticatedSocket;
      const testTime = Date.now() - 1000;
      mockSocket.handshake.time = testTime;

      const result = gateway.handlePing(mockSocket);

      expect(result.data.latency).toBeGreaterThanOrEqual(1000);
    });

    it('should handle missing handshake time', () => {
      const mockSocket = createMockSocket('socket-1') as AuthenticatedSocket;
      delete (mockSocket.handshake as any).time;

      const result = gateway.handlePing(mockSocket);

      expect(result.data.latency).toBeDefined();
      expect(result.data.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('handleSubscribe', () => {
    it('should subscribe authenticated user to room', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      connectionManager.addConnection(mockSocket);

      const result = await gateway.handleSubscribe(mockSocket, {
        room: 'test:room',
      });

      expect(mockSocket.join).toHaveBeenCalledWith('test:room');
      expect(result.event).toBe('subscribed');
      expect(result.data.room).toBe('test:room');
    });

    it('should add user to connection manager on first authenticated message', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;

      const addSpy = jest.spyOn(connectionManager, 'addConnection');

      await gateway.handleSubscribe(mockSocket, { room: 'test:room' });

      expect(addSpy).toHaveBeenCalledWith(mockSocket);
    });

    it('should track room in connection manager', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      connectionManager.addConnection(mockSocket);

      const addRoomSpy = jest.spyOn(connectionManager, 'addRoomToConnection');

      await gateway.handleSubscribe(mockSocket, { room: 'test:room' });

      expect(addRoomSpy).toHaveBeenCalledWith('socket-1', 'test:room');
    });

    it('should update activity on subscribe', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      connectionManager.addConnection(mockSocket);

      const updateSpy = jest.spyOn(connectionManager, 'updateActivity');

      await gateway.handleSubscribe(mockSocket, { room: 'test:room' });

      expect(updateSpy).toHaveBeenCalledWith('socket-1');
    });

    it('should track successful message', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      connectionManager.addConnection(mockSocket);

      const trackSpy = jest.spyOn(connectionManager, 'trackMessage');

      await gateway.handleSubscribe(mockSocket, { room: 'test:room' });

      expect(trackSpy).toHaveBeenCalledWith(true);
    });

    it('should reject invalid room name (empty)', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;

      const result = await gateway.handleSubscribe(mockSocket, {
        room: '',
      });

      expect(result.event).toBe('error');
      expect(result.data.message).toContain('Invalid room name');
    });

    it('should reject invalid room name format (special chars)', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;

      const result = await gateway.handleSubscribe(mockSocket, {
        room: 'room@#$%',
      });

      expect(result.event).toBe('error');
      expect(result.data.message).toContain('Invalid room name format');
    });

    it('should accept valid room name formats', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      connectionManager.addConnection(mockSocket);

      const validRooms = [
        'simple',
        'sensor:123',
        'alert_critical',
        'room-name',
        'Room123',
      ];

      for (const room of validRooms) {
        const result = await gateway.handleSubscribe(mockSocket, { room });
        expect(result.event).toBe('subscribed');
      }
    });

    it('should track failed message on error', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      const trackSpy = jest.spyOn(connectionManager, 'trackMessage');

      await gateway.handleSubscribe(mockSocket, { room: '' });

      expect(trackSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('handleUnsubscribe', () => {
    it('should unsubscribe user from room', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      connectionManager.addConnection(mockSocket);

      // First subscribe
      await gateway.handleSubscribe(mockSocket, { room: 'test:room' });

      // Then unsubscribe
      const result = await gateway.handleUnsubscribe(mockSocket, {
        room: 'test:room',
      });

      expect(mockSocket.leave).toHaveBeenCalledWith('test:room');
      expect(result.event).toBe('unsubscribed');
      expect(result.data.room).toBe('test:room');
    });

    it('should remove room from connection manager', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      connectionManager.addConnection(mockSocket);

      await gateway.handleSubscribe(mockSocket, { room: 'test:room' });

      const removeSpy = jest.spyOn(
        connectionManager,
        'removeRoomFromConnection',
      );

      await gateway.handleUnsubscribe(mockSocket, { room: 'test:room' });

      expect(removeSpy).toHaveBeenCalledWith('socket-1', 'test:room');
    });

    it('should update activity on unsubscribe', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      connectionManager.addConnection(mockSocket);

      const updateSpy = jest.spyOn(connectionManager, 'updateActivity');

      await gateway.handleUnsubscribe(mockSocket, { room: 'test:room' });

      expect(updateSpy).toHaveBeenCalledWith('socket-1');
    });

    it('should reject invalid room name', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;

      const result = await gateway.handleUnsubscribe(mockSocket, {
        room: '',
      });

      expect(result.event).toBe('error');
      expect(result.data.message).toContain('Invalid room name');
    });
  });

  describe('handleConnectionInfo', () => {
    it('should return connection info for authenticated user', () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      connectionManager.addConnection(mockSocket);

      const result = gateway.handleConnectionInfo(mockSocket);

      expect(result.event).toBe('connection:info');
      expect(result.data).toHaveProperty('socketId');
      expect(result.data).toHaveProperty('activeConnections');
    });

    it('should update activity when requesting connection info', () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      connectionManager.addConnection(mockSocket);

      const updateSpy = jest.spyOn(connectionManager, 'updateActivity');

      gateway.handleConnectionInfo(mockSocket);

      expect(updateSpy).toHaveBeenCalledWith('socket-1');
    });

    it('should track message when getting connection info', () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      connectionManager.addConnection(mockSocket);

      const trackSpy = jest.spyOn(connectionManager, 'trackMessage');

      gateway.handleConnectionInfo(mockSocket);

      expect(trackSpy).toHaveBeenCalledWith(true);
    });

    it('should handle error when getting connection info', () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;

      jest
        .spyOn(connectionManager, 'getConnectionInfo')
        .mockImplementation(() => {
          throw new Error('Info error');
        });

      const result = gateway.handleConnectionInfo(mockSocket);

      expect(result.event).toBe('error');
    });
  });

  describe('broadcastToRoom', () => {
    it('should broadcast message to specific room', () => {
      const testData = { message: 'Hello room' };

      gateway.broadcastToRoom('test:room', 'room-event', testData);

      expect(mockServer.to).toHaveBeenCalledWith('test:room');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'room-event',
        expect.objectContaining({
          message: 'Hello room',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should log broadcast details', () => {
      const debugSpy = jest.spyOn(gateway['logger'], 'debug');

      gateway.broadcastToRoom('test:room', 'room-event', { test: true });

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Broadcasted room-event to room: test:room'),
      );
    });

    it('should handle broadcast error gracefully', () => {
      mockServer.to = jest.fn(() => {
        throw new Error('Broadcast error');
      });

      const errorSpy = jest.spyOn(gateway['logger'], 'error');

      expect(() =>
        gateway.broadcastToRoom('test:room', 'event', {}),
      ).not.toThrow();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('broadcastToUser', () => {
    it('should broadcast to all user connections', () => {
      const mockSocket1 = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      const mockSocket2 = createMockSocket(
        'socket-2',
        'user-1',
      ) as AuthenticatedSocket;

      connectionManager.addConnection(mockSocket1);
      connectionManager.addConnection(mockSocket2);

      gateway.broadcastToUser('user-1', 'user-event', { message: 'Hello' });

      expect(mockSocket1.emit).toHaveBeenCalledWith(
        'user-event',
        expect.objectContaining({
          message: 'Hello',
          timestamp: expect.any(String),
        }),
      );
      expect(mockSocket2.emit).toHaveBeenCalledWith(
        'user-event',
        expect.objectContaining({
          message: 'Hello',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should handle user with no connections', () => {
      const debugSpy = jest.spyOn(gateway['logger'], 'debug');

      expect(() =>
        gateway.broadcastToUser('non-existent', 'event', {}),
      ).not.toThrow();
    });

    it('should log number of connections reached', () => {
      const mockSocket1 = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      const mockSocket2 = createMockSocket(
        'socket-2',
        'user-1',
      ) as AuthenticatedSocket;

      connectionManager.addConnection(mockSocket1);
      connectionManager.addConnection(mockSocket2);

      const debugSpy = jest.spyOn(gateway['logger'], 'debug');

      gateway.broadcastToUser('user-1', 'event', {});

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('2 connections'),
      );
    });
  });

  describe('broadcastGlobal', () => {
    it('should broadcast to all connected clients', () => {
      gateway.broadcastGlobal('global-event', { announcement: 'Hello all' });

      expect(mockServer.emit).toHaveBeenCalledWith(
        'global-event',
        expect.objectContaining({
          announcement: 'Hello all',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should log global broadcast', () => {
      const debugSpy = jest.spyOn(gateway['logger'], 'debug');

      gateway.broadcastGlobal('global-event', {});

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Global broadcast: global-event'),
      );
    });

    it('should handle global broadcast error', () => {
      mockServer.emit = jest.fn(() => {
        throw new Error('Broadcast error');
      });

      const errorSpy = jest.spyOn(gateway['logger'], 'error');

      expect(() => gateway.broadcastGlobal('event', {})).not.toThrow();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('getConnectionStats', () => {
    it('should return connection statistics', () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      connectionManager.addConnection(mockSocket);

      const stats = gateway.getConnectionStats();

      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('totalRooms');
      expect(stats.activeConnections).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getActiveConnections', () => {
    it('should return all active connection info', () => {
      const mockSocket1 = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      const mockSocket2 = createMockSocket(
        'socket-2',
        'user-2',
      ) as AuthenticatedSocket;

      connectionManager.addConnection(mockSocket1);
      connectionManager.addConnection(mockSocket2);

      const connections = gateway.getActiveConnections();

      expect(connections).toBeInstanceOf(Array);
      expect(connections.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array when no connections', () => {
      const connections = gateway.getActiveConnections();

      expect(connections).toBeInstanceOf(Array);
      expect(connections.length).toBe(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete user session lifecycle', async () => {
      const mockSocket = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;

      // Connect
      await gateway.handleConnection(mockSocket);
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', expect.any(Object));

      // Subscribe to room
      await gateway.handleSubscribe(mockSocket, { room: 'test:room' });
      expect(connectionManager.getConnection('socket-1')).toBeDefined();

      // Get connection info
      const info = gateway.handleConnectionInfo(mockSocket);
      expect(info.event).toBe('connection:info');

      // Unsubscribe from room
      await gateway.handleUnsubscribe(mockSocket, { room: 'test:room' });
      expect(mockSocket.leave).toHaveBeenCalledWith('test:room');

      // Disconnect
      gateway.handleDisconnect(mockSocket);
      expect(connectionManager.getConnection('socket-1')).toBeUndefined();
    });

    it('should handle multiple users and rooms', async () => {
      const user1Socket1 = createMockSocket(
        'socket-1',
        'user-1',
      ) as AuthenticatedSocket;
      const user1Socket2 = createMockSocket(
        'socket-2',
        'user-1',
      ) as AuthenticatedSocket;
      const user2Socket = createMockSocket(
        'socket-3',
        'user-2',
      ) as AuthenticatedSocket;

      await gateway.handleConnection(user1Socket1);
      await gateway.handleConnection(user1Socket2);
      await gateway.handleConnection(user2Socket);

      await gateway.handleSubscribe(user1Socket1, { room: 'room-a' });
      await gateway.handleSubscribe(user1Socket2, { room: 'room-a' });
      await gateway.handleSubscribe(user2Socket, { room: 'room-b' });

      const stats = gateway.getConnectionStats();
      expect(stats.activeConnections).toBe(3);
      expect(connectionManager.getActiveUsers()).toBe(2);
    });
  });
});
