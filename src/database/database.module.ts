import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global Database Module
 * 
 * This module provides database services throughout the application.
 * It's marked as @Global() so PrismaService can be injected anywhere
 * without importing DatabaseModule in every feature module.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}