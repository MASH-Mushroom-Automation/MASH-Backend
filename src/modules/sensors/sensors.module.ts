import { Module } from '@nestjs/common';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [SensorsController],
  providers: [SensorsService, PrismaService],
  exports: [SensorsService],
})
export class SensorsModule {}
