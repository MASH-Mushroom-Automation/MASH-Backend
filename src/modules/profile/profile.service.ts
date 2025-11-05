import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { User } from '@prisma/client';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user profile by user ID
   */
  async getProfile(userId: string): Promise<any> {
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
        phoneNumber: true,
        role: true,
        preferences: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            sessions: true,
            apiKeys: true,
            devices: true,
            orders: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return {
      ...user,
      stats: {
        activeSessions: user._count.sessions,
        apiKeys: user._count.apiKeys,
        devices: user._count.devices,
        orders: user._count.orders,
      },
      _count: undefined, // Remove _count from response
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateData: UpdateProfileDto): Promise<User> {
    // Check if username is being updated and if it's already taken
    if (updateData.username) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username: updateData.username },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestException('Username already taken');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return updatedUser;
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferences: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Return default preferences if none set
    return (
      user.preferences || {
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        notifications: {
          email: true,
          push: true,
          sms: false,
        },
      }
    );
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferencesData: UpdatePreferencesDto): Promise<any> {
    // Get current preferences
    const currentPreferences = await this.getPreferences(userId);

    // Merge new preferences with existing ones
    const updatedPreferences = {
      ...currentPreferences,
      ...preferencesData,
      notifications: {
        ...currentPreferences.notifications,
        ...(preferencesData.notifications || {}),
      },
    };

    // Update user preferences
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferences: updatedPreferences,
      },
    });

    return updatedPreferences;
  }
}
