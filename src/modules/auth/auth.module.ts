import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { FirebaseStrategy } from './strategies/firebase.strategy';
import { ClerkStrategy } from './strategies/clerk.strategy';
import { ClerkService } from './services/clerk.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { QuotaService } from './services/quota.service';
import { ViolationTrackerService } from './services/violation-tracker.service';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { OAuthModule } from '../oauth/oauth.module';
import clerkConfig from '../../config/clerk.config';
// AuthLegacyController removed - frontend now uses /api/v1/auth/firebase-sync

@Module({
  imports: [
    ConfigModule.forFeature(clerkConfig),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    NotificationsModule, // Import NotificationsModule for email service
    OAuthModule, // Import OAuthModule for Google & Facebook OAuth
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION', '1d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    FirebaseStrategy,
    ClerkStrategy,
    ClerkService,
    SessionService,
    TokenService,
    QuotaService,
    ViolationTrackerService,
    ClerkAuthGuard,
    RolesGuard,
    PermissionsGuard,
    // Removed PrismaService and RedisService - they are provided globally by DatabaseModule
  ],
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    ClerkService,
    SessionService,
    TokenService,
    QuotaService,
    ViolationTrackerService,
    ClerkAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
