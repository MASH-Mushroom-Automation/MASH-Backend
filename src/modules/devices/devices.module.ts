import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesGateway } from './devices.gateway';
import { DevicesController } from './devices.controller';
import { IoTDevicesController } from './iot-devices.controller';
import { MqttService } from './mqtt.service';

@Module({
  providers: [DevicesService, MqttService, DevicesGateway], // PrismaService provided globally by DatabaseModule
  controllers: [DevicesController, IoTDevicesController],
  exports: [DevicesService, MqttService],
})
export class DevicesModule {}
