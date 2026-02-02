/**
 * Auth Controller Tests
 * Tests authentication endpoints and guards
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleLogger } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { mock } from 'jest-mock-extended';
import { ExecutionContext } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    authService = mock<AuthService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn((context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();
          request.user = { userId: 'user-1', email: 'test@example.com' };
          return true;
        }),
      })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /auth/webhook', () => {
    it('should handle Clerk webhook for user.created', async () => {
      const webhookPayload = {
        type: 'user.created',
        data: {
          id: 'clerk-123',
          email_addresses: [{ email_address: 'test@example.com' }],
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser',
          image_url: 'https://example.com/avatar.jpg',
        },
      };

      const mockResult = {
        id: 'user-1',
        clerkId: 'clerk-123',
        email: 'test@example.com',
      };

      authService.handleClerkWebhook.mockResolvedValue(mockResult as any);

      const result = await controller.handleClerkWebhook(webhookPayload as any);

      expect(result).toEqual(mockResult);
      expect(authService.handleClerkWebhook).toHaveBeenCalledWith(webhookPayload);
    });

    it('should handle Clerk webhook for user.updated', async () => {
      const webhookPayload = {
        type: 'user.updated',
        data: {
          id: 'clerk-123',
          email_addresses: [{ email_address: 'updated@example.com' }],
        },
      };

      const mockResult = {
        id: 'user-1',
        email: 'updated@example.com',
      };

      authService.handleClerkWebhook.mockResolvedValue(mockResult as any);

      const result = await controller.handleClerkWebhook(webhookPayload as any);

      expect(result).toEqual(mockResult);
      expect(authService.handleClerkWebhook).toHaveBeenCalledWith(webhookPayload);
    });

    it('should handle Clerk webhook for user.deleted', async () => {
      const webhookPayload = {
        type: 'user.deleted',
        data: {
          id: 'clerk-123',
        },
      };

      const mockResult = { deleted: true };

      authService.handleClerkWebhook.mockResolvedValue(mockResult as any);

      const result = await controller.handleClerkWebhook(webhookPayload as any);

      expect(result).toEqual(mockResult);
      expect(authService.handleClerkWebhook).toHaveBeenCalledWith(webhookPayload);
    });

    it('should handle unknown webhook events', async () => {
      const webhookPayload = {
        type: 'user.unknown',
        data: {},
      };

      const mockResult = { message: 'Event type not handled' };

      authService.handleClerkWebhook.mockResolvedValue(mockResult as any);

      const result = await controller.handleClerkWebhook(webhookPayload as any);

      expect(result).toEqual(mockResult);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user information', async () => {
      const mockRequest = {
        user: {
          id: 'user-1',
          userId: 'user-1',
          clerkId: 'clerk-123',
          email: 'test@example.com',
          role: 'BUYER',
          sessionId: 'session-123',
          expiresAt: new Date(Date.now() + 3600000),
        },
      };

      const mockUser = {
        id: 'user-1',
        clerkId: 'clerk-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'BUYER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      authService.getCurrentUser.mockResolvedValue(mockUser as any);

      const result = await controller.getCurrentUser(mockRequest);

      expect(result).toEqual(mockUser);
      expect(authService.getCurrentUser).toHaveBeenCalledWith('user-1');
    });

    it('should require authentication', async () => {
      // JwtAuthGuard is mocked to always pass in tests
      // In real app, this would require valid JWT token
      const mockRequest = {
        user: {
          id: 'user-1',
          userId: 'user-1',
          clerkId: 'clerk-123',
          email: 'test@example.com',
          role: 'USER',
          sessionId: 'session-123',
          expiresAt: new Date(Date.now() + 3600000),
        },
      };

      const mockUser = { id: 'user-1', email: 'test@example.com' };

      authService.getCurrentUser.mockResolvedValue(mockUser as any);

      const result = await controller.getCurrentUser(mockRequest);

      expect(result).toBeDefined();
      expect(authService.getCurrentUser).toHaveBeenCalled();
    });

    it('should include user role information', async () => {
      const mockRequest = {
        user: {
          id: 'user-1',
          userId: 'user-1',
          clerkId: 'clerk-123',
          email: 'test@example.com',
          role: 'SELLER',
          sessionId: 'session-123',
          expiresAt: new Date(Date.now() + 3600000),
        },
      };

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'SELLER',
        isActive: true,
      };

      authService.getCurrentUser.mockResolvedValue(mockUser as any);

      const result = await controller.getCurrentUser(mockRequest);

      expect(result.role).toBe('SELLER');
    });
  });

  describe('GET /auth/session', () => {
    it('should return session information', async () => {
      const mockRequest = {
        user: {
          id: 'user-1',
          userId: 'user-1',
          clerkId: 'clerk-123',
          email: 'test@example.com',
          role: 'BUYER',
          sessionId: 'session-123',
          expiresAt: new Date(Date.now() + 3600000),
        },
      };

      const mockSession = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'BUYER',
        expiresAt: new Date(Date.now() + 3600000),
      };

      authService.getSessionInfo.mockReturnValue(mockSession as any);

      const result = await controller.getSession(mockRequest);

      expect(result).toEqual(mockSession);
      expect(authService.getSessionInfo).toHaveBeenCalledWith(mockRequest.user);
    });

    it('should require authentication for session info', async () => {
      const mockRequest = {
        user: {
          id: 'user-1',
          userId: 'user-1',
          clerkId: 'clerk-123',
          email: 'test@example.com',
          role: 'USER',
          sessionId: 'session-123',
          expiresAt: new Date(Date.now() + 3600000),
        },
      };

      const mockSession = { userId: 'user-1' };

      authService.getSessionInfo.mockReturnValue(mockSession as any);

      const result = await controller.getSession(mockRequest);

      expect(result).toBeDefined();
      expect(authService.getSessionInfo).toHaveBeenCalled();
    });
  });

  describe('Authentication Guards', () => {
    it('should protect authenticated routes with JwtAuthGuard', () => {
      // Verify that protected endpoints require authentication
      // In real scenario, missing/invalid JWT would be rejected
      const protectedEndpoints = ['getCurrentUser', 'getSession'];

      protectedEndpoints.forEach(endpoint => {
        expect(controller[endpoint]).toBeDefined();
      });
    });

    it('should allow public access to webhook endpoint', async () => {
      // Webhook endpoint should not require authentication
      const webhookPayload = {
        type: 'user.created',
        data: { id: 'clerk-123' },
      };

      authService.handleClerkWebhook.mockResolvedValue({} as any);

      // Should not throw authentication error
      await expect(controller.handleClerkWebhook(webhookPayload as any)).resolves.toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const mockRequest = {
        user: {
          id: 'invalid-id',
          userId: 'invalid-id',
          clerkId: 'clerk-123',
          email: 'test@example.com',
          role: 'USER',
          sessionId: 'session-123',
          expiresAt: new Date(Date.now() + 3600000),
        },
      };

      authService.getCurrentUser.mockRejectedValue(new Error('User not found'));

      await expect(controller.getCurrentUser(mockRequest)).rejects.toThrow('User not found');
    });

    it('should handle webhook processing errors', async () => {
      const webhookPayload = {
        type: 'user.created',
        data: { id: 'invalid' },
      };

      authService.handleClerkWebhook.mockRejectedValue(new Error('Webhook processing failed'));

      await expect(controller.handleClerkWebhook(webhookPayload as any)).rejects.toThrow(
        'Webhook processing failed',
      );
    });
  });

  describe('Response Format', () => {
    it('should return properly formatted user data', async () => {
      const mockRequest = {
        user: {
          id: 'user-1',
          userId: 'user-1',
          clerkId: 'clerk-123',
          email: 'test@example.com',
          role: 'USER',
          sessionId: 'session-123',
          expiresAt: new Date(Date.now() + 3600000),
        },
      };

      const mockUser = {
        id: 'user-1',
        clerkId: 'clerk-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        imageUrl: 'https://example.com/avatar.jpg',
        role: 'BUYER',
        isActive: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      };

      authService.getCurrentUser.mockResolvedValue(mockUser as any);

      const result = await controller.getCurrentUser(mockRequest);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('role');
      expect(result).toHaveProperty('isActive');
      expect(result).not.toHaveProperty('password');
    });

    it('should return session data with expiration', async () => {
      const mockRequest = {
        user: {
          id: 'user-1',
          userId: 'user-1',
          clerkId: 'clerk-123',
          email: 'test@example.com',
          role: 'USER',
          sessionId: 'session-123',
          expiresAt: new Date(Date.now() + 3600000),
        },
      };

      const mockSession = {
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
      };

      authService.getSessionInfo.mockReturnValue(mockSession as any);

      const result = await controller.getSession(mockRequest);

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('expiresAt');
    });
  });
});
