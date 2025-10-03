import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ClerkWebhookDto } from './dto/clerk-webhook.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async handleClerkWebhook(payload: ClerkWebhookDto) {
    const { type, data } = payload;

    switch (type) {
      case 'user.created':
        return this.createUser(data);
      case 'user.updated':
        return this.updateUser(data);
      case 'user.deleted':
        return this.deleteUser(data);
      default:
        return { message: 'Event type not handled' };
    }
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async getSessionInfo(user: any) {
    return {
      userId: user.userId,
      clerkId: user.clerkId,
      role: user.role,
      permissions: this.getUserPermissions(user.role),
      sessionId: user.sessionId,
      expiresAt: user.expiresAt,
    };
  }

  async logout(userId: string) {
    // In a real application, you might want to invalidate tokens
    // For now, we'll just return a success message
    return { message: 'Logout successful' };
  }

  private async createUser(userData: any) {
    const user = await this.prisma.user.create({
      data: {
        clerkId: userData.id,
        email: userData.email_addresses[0]?.email_address,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        imageUrl: userData.image_url,
      },
    });

    return { message: 'User created successfully', userId: user.id };
  }

  private async updateUser(userData: any) {
    const user = await this.prisma.user.update({
      where: { clerkId: userData.id },
      data: {
        email: userData.email_addresses[0]?.email_address,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        imageUrl: userData.image_url,
      },
    });

    return { message: 'User updated successfully', userId: user.id };
  }

  private async deleteUser(userData: any) {
    await this.prisma.user.update({
      where: { clerkId: userData.id },
      data: { isActive: false },
    });

    return { message: 'User deactivated successfully' };
  }

  private getUserPermissions(role: string): string[] {
    const permissions: Record<string, string[]> = {
      USER: ['read:profile', 'update:profile', 'read:devices', 'create:orders'],
      GROWER: [
        'read:profile',
        'update:profile',
        'read:devices',
        'manage:devices',
        'read:sensors',
        'create:products',
      ],
      ADMIN: ['read:all', 'write:all', 'delete:all', 'manage:users'],
      SUPER_ADMIN: ['*'],
    };

    return permissions[role] || permissions.USER;
  }
}
