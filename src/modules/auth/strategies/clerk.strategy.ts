import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ClerkService } from '../services/clerk.service';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ClerkStrategy extends PassportStrategy(Strategy, 'clerk') {
  private readonly logger = new Logger(ClerkStrategy.name);

  constructor(
    private configService: ConfigService,
    private clerkService: ClerkService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('clerk.jwtKey') || 'clerk-secret',
      issuer: 'https://clerk.com', // Clerk's JWT issuer
      algorithms: ['RS256'], // Clerk uses RS256
    });
  }

  /**
   * Validate JWT payload and return user
   */
  async validate(payload: any) {
    try {
      this.logger.debug(`Validating Clerk JWT for user: ${payload.sub}`);

      // The 'sub' claim contains the Clerk user ID
      const clerkId = payload.sub;

      if (!clerkId) {
        throw new UnauthorizedException('Invalid token: missing user ID');
      }

      // Verify user exists in Clerk
      const clerkUser = await this.clerkService.getUserById(clerkId);

      if (!clerkUser) {
        throw new UnauthorizedException('User not found in Clerk');
      }

      // Find user in our database
      let user = await this.prisma.user.findUnique({
        where: { clerkId },
      });

      // Sync user if not exists
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            clerkId,
            email: clerkUser.emailAddresses[0]?.emailAddress || '',
            username: clerkUser.username || undefined,
            firstName: clerkUser.firstName || undefined,
            lastName: clerkUser.lastName || undefined,
            imageUrl: clerkUser.imageUrl || undefined,
            phoneNumber: clerkUser.phoneNumbers[0]?.phoneNumber || undefined,
            lastLoginAt: new Date(),
          },
        });

        this.logger.log(`✅ Created user from Clerk JWT: ${user.email}`);
      }

      // Return user object for request.user
      return {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        imageUrl: user.imageUrl,
        isActive: user.isActive,
      };
    } catch (error) {
      this.logger.error('JWT validation failed:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
