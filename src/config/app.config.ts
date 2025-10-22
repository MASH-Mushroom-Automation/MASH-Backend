import { ConfigService } from '@nestjs/config';

export const createAppConfig = (configService: ConfigService) => ({
  port: parseInt(configService.get('PORT') || '3000', 10),
  nodeEnv: configService.get('NODE_ENV') || 'development',
  isDevelopment: configService.get('NODE_ENV') === 'development',
  isProduction: configService.get('NODE_ENV') === 'production',
  apiPrefix: configService.get('API_PREFIX') || 'api',
  corsOrigins: configService.get('CORS_ORIGINS')?.split(',') || [
    'https://mash-backend-api.up.railway.app',
    'http://localhost:3000',
  ],
});

export type AppConfig = ReturnType<typeof createAppConfig>;
