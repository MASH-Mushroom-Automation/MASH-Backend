import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesGateway } from './devices.gateway';
import { DevicesController } from './devices.controller';
import { MqttService } from './mqtt.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  providers: [DevicesService, MqttService, DevicesGateway, PrismaService],
  controllers: [DevicesController],
  exports: [DevicesService, MqttService],
})
export class DevicesModule {}
