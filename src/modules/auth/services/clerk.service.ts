import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import type { ClerkClient } from '@clerk/backend';
import { Webhook } from 'svix';

@Injectable()
export class ClerkService {
  private readonly logger = new Logger(ClerkService.name);
  private clerkClient: ClerkClient;
  private webhookSecret: string;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('clerk.secretKey');
    const webhookSecret =
      this.configService.get<string>('clerk.webhookSecret');

    if (!secretKey) {
      this.logger.warn('⚠️ Clerk secret key not configured');
      throw new Error('CLERK_SECRET_KEY is required');
    }

    if (!webhookSecret) {
      this.logger.warn('⚠️ Clerk webhook secret not configured');
      this.webhookSecret = '';
    } else {
      this.webhookSecret = webhookSecret;
    }

    this.clerkClient = createClerkClient({ secretKey });
    this.logger.log('✅ Clerk client initialized');
  }

  /**
   * Get Clerk client instance
   */
  getClient(): ClerkClient {
    return this.clerkClient;
  }

  /**
   * Verify Clerk webhook signature using Svix
   */
  verifyWebhook(
    payload: string,
    headers: Record<string, string>,
  ): Promise<any> {
    try {
      const wh = new Webhook(this.webhookSecret);
      const evt = wh.verify(payload, headers);
      return Promise.resolve(evt);
    } catch (err) {
      this.logger.error('❌ Webhook verification failed', err);
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  /**
   * Get user by Clerk ID
   */
  async getUserById(clerkId: string) {
    try {
      const user = await this.clerkClient.users.getUser(clerkId);
      return user;
    } catch (error) {
      this.logger.error(`Failed to get user ${clerkId}:`, error);
      throw new BadRequestException(`User not found: ${clerkId}`);
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string) {
    try {
      const users = await this.clerkClient.users.getUserList({
        emailAddress: [email],
      });
      return users.data[0] || null;
    } catch (error) {
      this.logger.error(`Failed to get user by email ${email}:`, error);
      return null;
    }
  }

  /**
   * Create a new user in Clerk
   */
  async createUser(data: {
    emailAddress: string[];
    password?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }) {
    try {
      const user = await this.clerkClient.users.createUser(data);
      this.logger.log(`✅ Created user: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error('Failed to create user:', error);
      throw new BadRequestException('Failed to create user');
    }
  }

  /**
   * Update user metadata
   */
  async updateUser(
    clerkId: string,
    data: {
      firstName?: string;
      lastName?: string;
      username?: string;
      publicMetadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
    },
  ) {
    try {
      const user = await this.clerkClient.users.updateUser(clerkId, data);
      this.logger.log(`✅ Updated user: ${clerkId}`);
      return user;
    } catch (error) {
      this.logger.error(`Failed to update user ${clerkId}:`, error);
      throw new BadRequestException('Failed to update user');
    }
  }

  /**
   * Delete user from Clerk
   */
  async deleteUser(clerkId: string) {
    try {
      await this.clerkClient.users.deleteUser(clerkId);
      this.logger.log(`✅ Deleted user: ${clerkId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete user ${clerkId}:`, error);
      throw new BadRequestException('Failed to delete user');
    }
  }

  /**
   * Verify session token
   */
  async verifySessionToken(sessionToken: string) {
    try {
      const session = await this.clerkClient.sessions.verifySession(
        sessionToken,
        sessionToken,
      );
      return session;
    } catch (error) {
      this.logger.error('Session verification failed:', error);
      throw new UnauthorizedException('Invalid session token');
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(clerkId: string) {
    try {
      const sessions = await this.clerkClient.users.getUserList({
        userId: [clerkId],
      });
      return sessions;
    } catch (error) {
      this.logger.error(`Failed to get sessions for user ${clerkId}:`, error);
      return [];
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string) {
    try {
      await this.clerkClient.sessions.revokeSession(sessionId);
      this.logger.log(`✅ Revoked session: ${sessionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to revoke session ${sessionId}:`, error);
      throw new BadRequestException('Failed to revoke session');
    }
  }

  /**
   * Ban/unban a user
   */
  async banUser(clerkId: string) {
    try {
      await this.clerkClient.users.banUser(clerkId);
      this.logger.log(`✅ Banned user: ${clerkId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to ban user ${clerkId}:`, error);
      throw new BadRequestException('Failed to ban user');
    }
  }

  async unbanUser(clerkId: string) {
    try {
      await this.clerkClient.users.unbanUser(clerkId);
      this.logger.log(`✅ Unbanned user: ${clerkId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to unban user ${clerkId}:`, error);
      throw new BadRequestException('Failed to unban user');
    }
  }
}
