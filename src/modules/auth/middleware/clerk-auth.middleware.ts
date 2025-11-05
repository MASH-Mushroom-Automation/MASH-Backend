import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClerkService } from '../services/clerk.service';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ClerkAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ClerkAuthMiddleware.name);

  constructor(
    private clerkService: ClerkService,
    private prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Extract session token from Authorization header or cookie
      const sessionToken = this.extractToken(req);

      if (!sessionToken) {
        // Allow request to proceed without auth (let guards handle it)
        return next();
      }

      // Verify session token with Clerk
      const session = await this.clerkService.verifySessionToken(sessionToken);

      if (!session || !session.userId) {
        throw new UnauthorizedException('Invalid session token');
      }

      // Get user from Clerk
      const clerkUser = await this.clerkService.getUserById(session.userId);

      // Find or sync user in our database
      const user = await this.findOrSyncUser(clerkUser);

      // Attach user and session to request
      req.user = user;
      req.clerkUser = clerkUser;
      req.sessionId = session.id;

      this.logger.log(`✅ Authenticated user: ${user.email}`);

      next();
    } catch (error) {
      this.logger.error('Authentication failed:', error);
      // Don't throw - let guards handle unauthorized requests
      next();
    }
  }

  /**
   * Extract token from Authorization header or cookies
   */
  private extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check __session cookie (Clerk's default)
    const sessionCookie = req.cookies?.__session;
    if (sessionCookie) {
      return sessionCookie;
    }

    // Check custom session cookie
    const customCookie = req.cookies?.session;
    if (customCookie) {
      return customCookie;
    }

    return null;
  }

  /**
   * Find user in database or sync from Clerk
   */
  private async findOrSyncUser(clerkUser: any) {
    try {
      // Try to find existing user
      let user = await this.prisma.user.findUnique({
        where: { clerkId: clerkUser.id },
      });

      if (!user) {
        // Create user from Clerk data
        user = await this.prisma.user.create({
          data: {
            clerkId: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress || '',
            username: clerkUser.username || undefined,
            firstName: clerkUser.firstName || undefined,
            lastName: clerkUser.lastName || undefined,
            imageUrl: clerkUser.imageUrl || undefined,
            phoneNumber: clerkUser.phoneNumbers[0]?.phoneNumber || undefined,
            lastLoginAt: new Date(),
          },
        });

        this.logger.log(`✅ Created new user from Clerk: ${user.email}`);
      } else {
        // Update last login
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }

      return user;
    } catch (error) {
      this.logger.error('Failed to find or sync user:', error);
      throw new UnauthorizedException('User sync failed');
    }
  }
}
