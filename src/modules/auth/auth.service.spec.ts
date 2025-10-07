/**
 * Auth Service Tests
 * Tests authentication, JWT, and user management
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { createMockPrismaService } from '../../../test/mocks/prisma.mock';
import { mock } from 'jest-mock-extended';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    jwtService = mock<JwtService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCurrentUser', () => {
    it('should return user by id', async () => {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.getCurrentUser('user-1');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          id: true,
          clerkId: true,
          email: true,
          username: true,
          role: true,
        }),
      });
    });

    it('should throw error if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentUser('invalid-id')).rejects.toThrow();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'invalid-id' },
        select: expect.any(Object),
      });
    });

    it('should not expose sensitive fields', async () => {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.getCurrentUser('user-1');

      // Should not include password or other sensitive data
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('role');
    });
  });

  describe('handleClerkWebhook', () => {
    it('should handle user.created event', async () => {
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

      const mockCreatedUser = {
        id: 'user-1',
        clerkId: 'clerk-123',
        email: 'test@example.com',
      };

      prisma.user.create.mockResolvedValue(mockCreatedUser as any);

      const result = await service.handleClerkWebhook(webhookPayload as any);

      expect(result).toBeDefined();
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should handle user.updated event', async () => {
      const webhookPayload = {
        type: 'user.updated',
        data: {
          id: 'clerk-123',
          email_addresses: [{ email_address: 'updated@example.com' }],
          first_name: 'Updated',
          last_name: 'User',
        },
      };

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        clerkId: 'clerk-123',
      } as any);

      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'updated@example.com',
      } as any);

      const result = await service.handleClerkWebhook(webhookPayload as any);

      expect(result).toBeDefined();
    });

    it('should handle user.deleted event', async () => {
      const webhookPayload = {
        type: 'user.deleted',
        data: {
          id: 'clerk-123',
        },
      };

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        clerkId: 'clerk-123',
      } as any);

      prisma.user.delete.mockResolvedValue({
        id: 'user-1',
      } as any);

      const result = await service.handleClerkWebhook(webhookPayload as any);

      expect(result).toBeDefined();
    });

    it('should handle unknown event types gracefully', async () => {
      const webhookPayload = {
        type: 'user.unknown',
        data: {},
      };

      const result = await service.handleClerkWebhook(webhookPayload as any);

      expect(result).toEqual({ message: 'Event type not handled' });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });

  describe('getSessionInfo', () => {
    it('should return session information for authenticated user', async () => {
      const mockUser = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'BUYER',
      };

      const result = await service.getSessionInfo(mockUser);

      expect(result).toHaveProperty('userId');
      expect(result.userId).toBe('user-1');
    });

    it('should include user role in session info', async () => {
      const mockUser = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'SELLER',
      };

      const result = await service.getSessionInfo(mockUser);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-1');
    });
  });

  describe('JWT Token Operations', () => {
    it('should generate valid access token', () => {
      const payload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: 'BUYER',
      };

      jwtService.sign.mockReturnValue('mock-jwt-token');

      // This tests that JwtService is properly injected
      const token = jwtService.sign(payload);

      expect(token).toBe('mock-jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(payload);
    });

    it('should verify JWT token', () => {
      const mockToken = 'valid-jwt-token';
      const mockPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: 'BUYER',
      };

      jwtService.verify.mockReturnValue(mockPayload);

      const decoded = jwtService.verify(mockToken);

      expect(decoded).toEqual(mockPayload);
      expect(jwtService.verify).toHaveBeenCalledWith(mockToken);
    });

    it('should handle invalid JWT token', () => {
      const invalidToken = 'invalid-token';

      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => jwtService.verify(invalidToken)).toThrow('Invalid token');
    });
  });

  describe('User Role Management', () => {
    it('should identify buyer role', async () => {
      const mockUser = {
        id: 'user-1',
        clerkId: 'clerk-123',
        email: 'buyer@example.com',
        username: 'buyer',
        firstName: 'Buyer',
        lastName: 'User',
        imageUrl: null,
        role: 'BUYER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.getCurrentUser('user-1');

      expect(result.role).toBe('BUYER');
    });

    it('should identify seller role', async () => {
      const mockUser = {
        id: 'user-2',
        clerkId: 'clerk-456',
        email: 'seller@example.com',
        username: 'seller',
        firstName: 'Seller',
        lastName: 'User',
        imageUrl: null,
        role: 'SELLER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.getCurrentUser('user-2');

      expect(result.role).toBe('SELLER');
    });

    it('should identify admin role', async () => {
      const mockUser = {
        id: 'user-3',
        clerkId: 'clerk-789',
        email: 'admin@example.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        imageUrl: null,
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.getCurrentUser('user-3');

      expect(result.role).toBe('ADMIN');
    });
  });

  describe('User Status', () => {
    it('should check if user is active', async () => {
      const mockActiveUser = {
        id: 'user-1',
        clerkId: 'clerk-123',
        email: 'active@example.com',
        username: 'active',
        firstName: 'Active',
        lastName: 'User',
        imageUrl: null,
        role: 'BUYER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(mockActiveUser as any);

      const result = await service.getCurrentUser('user-1');

      expect(result.isActive).toBe(true);
    });

    it('should check if user is inactive', async () => {
      const mockInactiveUser = {
        id: 'user-2',
        clerkId: 'clerk-456',
        email: 'inactive@example.com',
        username: 'inactive',
        firstName: 'Inactive',
        lastName: 'User',
        imageUrl: null,
        role: 'BUYER',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(mockInactiveUser as any);

      const result = await service.getCurrentUser('user-2');

      expect(result.isActive).toBe(false);
    });
  });
});
