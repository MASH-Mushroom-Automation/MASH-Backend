import { ConfigService } from '@nestjs/config';

export const createDatabaseConfig = (configService: ConfigService) => ({
  url: configService.get<string>('DATABASE_URL'),
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: parseInt(configService.get<string>('DB_PORT', '5432'), 10),
  username: configService.get<string>('DB_USERNAME', 'postgres'),
  password: configService.get<string>('DB_PASSWORD', ''),
  database: configService.get<string>('DB_NAME', 'mash_backend'),
  synchronize: configService.get<string>('NODE_ENV') === 'development',
  logging: configService.get<string>('NODE_ENV') === 'development',
  ssl: configService.get<string>('NODE_ENV') === 'production',
});

export type DatabaseConfig = ReturnType<typeof createDatabaseConfig>;
