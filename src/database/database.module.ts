import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

/**
 * Global Database Module
 *
 * This module provides database services throughout the application.
 * It's marked as @Global() so PrismaService and RedisService can be injected anywhere
 * without importing DatabaseModule in every feature module.
 */
@Global()
@Module({
  providers: [PrismaService, RedisService],
  exports: [PrismaService, RedisService],
})
export class DatabaseModule {}
