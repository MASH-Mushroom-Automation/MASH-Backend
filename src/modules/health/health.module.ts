import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    RedisService,
    PrismaHealthIndicator,
    RedisHealthIndicator,
  ],
})
export class HealthModule {}
