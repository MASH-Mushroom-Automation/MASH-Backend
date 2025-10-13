import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Gateways
import { MainGateway } from './gateways/main.gateway';

// Services
import { ConnectionManagerService } from './services/connection-manager.service';

// Guards
import { WsJwtGuard } from './guards/ws-jwt.guard';

/**
 * WebSocket Module
 *
 * Provides enterprise-grade WebSocket functionality including:
 * - Real-time bidirectional communication
 * - JWT authentication
 * - Connection management
 * - Room-based subscriptions
 * - Broadcasting capabilities
 *
 * @see https://docs.nestjs.com/websockets/gateways
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (
        configService: ConfigService,
      ): Promise<JwtModuleOptions> => ({
        secret: configService.get<string>('JWT_SECRET') ?? '',
        signOptions: {
          // ✅ Explicitly cast to the correct allowed types
          expiresIn: (configService.get<string>('JWT_EXPIRATION') ?? '24h') as
            | number
            | `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Gateways
    MainGateway,

    // Services
    ConnectionManagerService,

    // Guards
    WsJwtGuard,
  ],
  exports: [
    // Export services for use in other modules
    ConnectionManagerService,

    // Export gateway for direct access if needed
    MainGateway,
  ],
})
export class WebsocketModule {}
