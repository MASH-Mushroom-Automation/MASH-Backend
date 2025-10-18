import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleLogger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WsJwtGuard } from '../ws-jwt.guard';
import type { AuthenticatedSocket } from '../../interfaces/authenticated-socket.interface';

describe('WsJwtGuard', () => {
  let guard: WsJwtGuard;
  let jwtService: JwtService;

  // Mock JWT payload
  const mockJwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    roles: ['user', 'admin'],
    name: 'Test User',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  };

  // Mock socket factory
  const createMockSocket = (
    options: {
      authToken?: string;
      headerToken?: string;
      queryToken?: string;
    } = {},
  ): Partial<AuthenticatedSocket> => {
    const mockSocket: Partial<AuthenticatedSocket> = {
      id: 'socket-123',
      handshake: {
        auth: options.authToken ? { token: options.authToken } : {},
        headers: options.headerToken
          ? { authorization: options.headerToken }
          : ({} as any),
        query: options.queryToken ? { token: options.queryToken } : {},
        address: '127.0.0.1',
        time: Date.now(),
        secure: false,
        issued: Date.now(),
        url: '/ws',
        xdomain: false,
      } as any,
      rooms: new Set(),
      connected: true,
      emit: jest.fn(),
    };
    return mockSocket;
  };

  // Mock execution context factory
  const createMockContext = (
    socket: Partial<AuthenticatedSocket>,
  ): ExecutionContext => {
    return {
      switchToWs: jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(socket),
      }),
      getType: jest.fn(),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToHttp: jest.fn(),
      switchToRpc: jest.fn(),
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsJwtGuard,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
            sign: jest.fn(),
          },
        },
      ],
    })
      .setLogger(new ConsoleLogger()) // Use ConsoleLogger for NestJS v11 compatibility
      .compile();

    guard = module.get<WsJwtGuard>(WsJwtGuard);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    describe('successful authentication', () => {
      it('should authenticate with token from auth object', async () => {
        const mockToken = 'valid-jwt-token';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockJwtPayload);

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(jwtService.verifyAsync).toHaveBeenCalledWith(mockToken, {
          secret: process.env.JWT_SECRET,
        });
        expect((mockSocket as AuthenticatedSocket).user).toBeDefined();
        expect((mockSocket as AuthenticatedSocket).user.id).toBe('user-123');
        expect((mockSocket as AuthenticatedSocket).user.email).toBe(
          'test@example.com',
        );
      });

      it('should authenticate with Bearer token from authorization header', async () => {
        const mockToken = 'valid-jwt-token';
        const mockSocket = createMockSocket({
          headerToken: `Bearer ${mockToken}`,
        });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockJwtPayload);

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(jwtService.verifyAsync).toHaveBeenCalledWith(mockToken, {
          secret: process.env.JWT_SECRET,
        });
      });

      it('should authenticate with token from authorization header without Bearer prefix', async () => {
        const mockToken = 'valid-jwt-token';
        const mockSocket = createMockSocket({ headerToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockJwtPayload);

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(jwtService.verifyAsync).toHaveBeenCalledWith(mockToken, {
          secret: process.env.JWT_SECRET,
        });
      });

      it('should authenticate with token from query parameter', async () => {
        const mockToken = 'valid-jwt-token';
        const mockSocket = createMockSocket({ queryToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockJwtPayload);

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(jwtService.verifyAsync).toHaveBeenCalledWith(mockToken, {
          secret: process.env.JWT_SECRET,
        });
      });

      it('should attach user data to socket correctly', async () => {
        const mockToken = 'valid-jwt-token';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockJwtPayload);

        await guard.canActivate(mockContext);

        const authenticatedSocket = mockSocket as AuthenticatedSocket;
        expect(authenticatedSocket.user).toBeDefined();
        expect(authenticatedSocket.user.id).toBe('user-123');
        expect(authenticatedSocket.user.email).toBe('test@example.com');
        expect(authenticatedSocket.user.roles).toEqual(['user', 'admin']);
        expect(authenticatedSocket.user.name).toBe('Test User');
        expect(authenticatedSocket.lastActivity).toBeDefined();
        expect(authenticatedSocket.subscriptions).toBeDefined();
      });

      it('should handle JWT payload with alternative field names', async () => {
        const altPayload = {
          userId: 'user-456',
          email: 'alt@example.com',
          username: 'altuser',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const mockToken = 'valid-jwt-token';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(altPayload);

        await guard.canActivate(mockContext);

        const authenticatedSocket = mockSocket as AuthenticatedSocket;
        expect(authenticatedSocket.user.id).toBe('user-456');
        expect(authenticatedSocket.user.email).toBe('alt@example.com');
        expect(authenticatedSocket.user.name).toBe('altuser');
      });

      it('should set default roles when not provided in payload', async () => {
        const payloadWithoutRoles = {
          sub: 'user-123',
          email: 'test@example.com',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const mockToken = 'valid-jwt-token';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest
          .spyOn(jwtService, 'verifyAsync')
          .mockResolvedValue(payloadWithoutRoles);

        await guard.canActivate(mockContext);

        const authenticatedSocket = mockSocket as AuthenticatedSocket;
        expect(authenticatedSocket.user.roles).toEqual(['user']);
      });
    });

    describe('token extraction priority', () => {
      it('should prioritize auth.token over other methods', async () => {
        const authToken = 'auth-token';
        const headerToken = 'header-token';
        const queryToken = 'query-token';

        const mockSocket = createMockSocket({
          authToken,
          headerToken: `Bearer ${headerToken}`,
          queryToken,
        });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockJwtPayload);

        await guard.canActivate(mockContext);

        // Should use auth token (highest priority)
        expect(jwtService.verifyAsync).toHaveBeenCalledWith(authToken, {
          secret: process.env.JWT_SECRET,
        });
      });

      it('should use header token when auth token not present', async () => {
        const headerToken = 'header-token';
        const queryToken = 'query-token';

        const mockSocket = createMockSocket({
          headerToken: `Bearer ${headerToken}`,
          queryToken,
        });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockJwtPayload);

        await guard.canActivate(mockContext);

        expect(jwtService.verifyAsync).toHaveBeenCalledWith(headerToken, {
          secret: process.env.JWT_SECRET,
        });
      });

      it('should use query token as fallback', async () => {
        const queryToken = 'query-token';

        const mockSocket = createMockSocket({ queryToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockJwtPayload);

        await guard.canActivate(mockContext);

        expect(jwtService.verifyAsync).toHaveBeenCalledWith(queryToken, {
          secret: process.env.JWT_SECRET,
        });
      });
    });

    describe('authentication failures', () => {
      it('should throw WsException when token is missing', async () => {
        const mockSocket = createMockSocket({});
        const mockContext = createMockContext(mockSocket);

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          WsException,
        );
        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          'Missing authentication token',
        );
      });

      it('should throw WsException when token is invalid', async () => {
        const mockToken = 'invalid-token';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(error);

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          WsException,
        );
        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          'Invalid token',
        );
      });

      it('should throw WsException when token is expired', async () => {
        const mockToken = 'expired-token';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(error);

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          WsException,
        );
        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          'Token has expired',
        );
      });

      it('should handle payload with expired timestamp', async () => {
        const expiredPayload = {
          ...mockJwtPayload,
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        };

        const mockToken = 'token-with-expired-timestamp';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(expiredPayload);

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          WsException,
        );
        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          'Token has expired',
        );
      });

      it('should handle generic JWT errors', async () => {
        const mockToken = 'malformed-token';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        const error = new Error('Generic JWT error');
        jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(error);

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          WsException,
        );
      });

      it('should throw WsException when JWT service throws unexpected error', async () => {
        const mockToken = 'problematic-token';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest
          .spyOn(jwtService, 'verifyAsync')
          .mockRejectedValue(new Error('Unexpected error'));

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          WsException,
        );
      });
    });

    describe('edge cases', () => {
      it('should handle empty string token', async () => {
        const mockSocket = createMockSocket({ authToken: '' });
        const mockContext = createMockContext(mockSocket);

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          WsException,
        );
      });

      it('should handle whitespace-only token', async () => {
        const mockSocket = createMockSocket({ authToken: '   ' });
        const mockContext = createMockContext(mockSocket);

        jest
          .spyOn(jwtService, 'verifyAsync')
          .mockRejectedValue(new Error('Invalid token'));

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          WsException,
        );
      });

      it('should handle malformed Bearer header', async () => {
        const mockSocket = createMockSocket({ headerToken: 'Bearer' });
        const mockContext = createMockContext(mockSocket);

        // Should extract "Bearer" as the token itself (fallback behavior)
        jest
          .spyOn(jwtService, 'verifyAsync')
          .mockRejectedValue(new Error('Invalid token'));

        await expect(guard.canActivate(mockContext)).rejects.toThrow(
          WsException,
        );
      });

      it('should handle payload without required fields', async () => {
        const incompletePayload = {
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const mockToken = 'token-incomplete-payload';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest
          .spyOn(jwtService, 'verifyAsync')
          .mockResolvedValue(incompletePayload);

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        const authenticatedSocket = mockSocket as AuthenticatedSocket;
        expect(authenticatedSocket.user.id).toBeUndefined();
        expect(authenticatedSocket.user.roles).toEqual(['user']);
      });

      it('should handle very long tokens', async () => {
        const longToken = 'a'.repeat(10000);
        const mockSocket = createMockSocket({ authToken: longToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockJwtPayload);

        const result = await guard.canActivate(mockContext);
        expect(result).toBe(true);
      });

      it('should handle special characters in token', async () => {
        const specialToken = 'token-with-special-chars-!@#$%^&*()';
        const mockSocket = createMockSocket({ authToken: specialToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockJwtPayload);

        const result = await guard.canActivate(mockContext);
        expect(result).toBe(true);
      });
    });

    describe('user data extraction', () => {
      it('should extract user ID from "sub" field', async () => {
        const payload = { sub: 'user-from-sub', email: 'test@example.com' };
        const mockToken = 'valid-token';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);

        await guard.canActivate(mockContext);

        expect((mockSocket as AuthenticatedSocket).user.id).toBe(
          'user-from-sub',
        );
      });

      it('should extract user ID from "userId" field when "sub" is missing', async () => {
        const payload = {
          userId: 'user-from-userId',
          email: 'test@example.com',
        };
        const mockToken = 'valid-token';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);

        await guard.canActivate(mockContext);

        expect((mockSocket as AuthenticatedSocket).user.id).toBe(
          'user-from-userId',
        );
      });

      it('should extract user ID from "id" field when others are missing', async () => {
        const payload = { id: 'user-from-id', email: 'test@example.com' };
        const mockToken = 'valid-token';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);

        await guard.canActivate(mockContext);

        expect((mockSocket as AuthenticatedSocket).user.id).toBe(
          'user-from-id',
        );
      });

      it('should extract Firebase UID when present', async () => {
        const payload = {
          sub: 'user-123',
          email: 'test@example.com',
          firebase_uid: 'firebase-uid-123',
        };
        const mockToken = 'valid-token';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);

        await guard.canActivate(mockContext);

        expect((mockSocket as AuthenticatedSocket).user.firebaseUid).toBe(
          'firebase-uid-123',
        );
      });

      it('should handle multiple role formats', async () => {
        const payload = {
          sub: 'user-123',
          email: 'test@example.com',
          roles: ['admin', 'moderator', 'user'],
        };
        const mockToken = 'valid-token';
        const mockSocket = createMockSocket({ authToken: mockToken });
        const mockContext = createMockContext(mockSocket);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);

        await guard.canActivate(mockContext);

        expect((mockSocket as AuthenticatedSocket).user.roles).toEqual([
          'admin',
          'moderator',
          'user',
        ]);
      });
    });

    describe('concurrent authentication requests', () => {
      it('should handle multiple simultaneous authentication requests', async () => {
        const mockToken = 'valid-token';
        const sockets = Array.from({ length: 10 }, (_, i) =>
          createMockSocket({ authToken: mockToken }),
        );
        const contexts = sockets.map(createMockContext);

        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockJwtPayload);

        const results = await Promise.all(
          contexts.map((ctx) => guard.canActivate(ctx)),
        );

        expect(results).toHaveLength(10);
        expect(results.every((r) => r === true)).toBe(true);
      });
    });
  });

  describe('integration with JwtService', () => {
    it('should pass correct parameters to JwtService.verifyAsync', async () => {
      const mockToken = 'test-token';
      const mockSocket = createMockSocket({ authToken: mockToken });
      const mockContext = createMockContext(mockSocket);

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockJwtPayload);

      await guard.canActivate(mockContext);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(mockToken, {
        secret: process.env.JWT_SECRET,
      });
      expect(jwtService.verifyAsync).toHaveBeenCalledTimes(1);
    });

    it('should handle JwtService returning null or undefined', async () => {
      const mockToken = 'test-token';
      const mockSocket = createMockSocket({ authToken: mockToken });
      const mockContext = createMockContext(mockSocket);

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(null);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(WsException);
    });
  });
});
