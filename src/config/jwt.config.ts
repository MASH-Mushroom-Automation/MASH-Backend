import { ConfigService } from '@nestjs/config';

export const createJwtConfig = (configService: ConfigService) => ({
  secret: configService.get<string>('JWT_SECRET', 'fallback-secret-key'),
  signOptions: {
    expiresIn: configService.get<string>('JWT_EXPIRATION', '1d'),
  },
  refreshSecret: configService.get<string>('JWT_REFRESH_SECRET', 'fallback-refresh-secret'),
  refreshExpiresIn: configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
});

export type JwtConfig = ReturnType<typeof createJwtConfig>;
