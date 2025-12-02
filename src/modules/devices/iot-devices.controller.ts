import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { CreateIoTDeviceDto } from './dto/create-iot-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DeviceStatus } from './dto/device-filter-query.dto';

/**
 * IoT Devices Controller
 * Handles device registration and updates from IoT devices
 * No authentication required - devices identified by User-Agent header
 */
@ApiTags('IoT Devices')
@Controller('iot/devices')
export class IoTDevicesController {
  private readonly logger = new Logger(IoTDevicesController.name);

  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Register IoT device',
    description: 'Register a new IoT device or update existing device. No authentication required for IoT devices.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Device registered successfully' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid device data' 
  })
  async registerDevice(@Body() createDeviceDto: CreateIoTDeviceDto) {
    try {
      this.logger.log(`IoT device registration request: ${createDeviceDto.name}`);
      
      // Check if device already exists by serial number
      const existingDevice = await this.devicesService.findBySerialNumber(
        createDeviceDto.serialNumber
      );

      if (existingDevice) {
        this.logger.log(`Device already exists, updating: ${existingDevice.id}`);
        
        // Update existing device
        const updated = await this.devicesService.updateBySerialNumber(
          createDeviceDto.serialNumber,
          {
            name: createDeviceDto.name,
            type: createDeviceDto.type,
            location: createDeviceDto.location,
            status: createDeviceDto.status || DeviceStatus.ONLINE,
            lastSeen: new Date(),
            isActive: true,
            ipAddress: createDeviceDto.ipAddress,
            macAddress: createDeviceDto.macAddress,
            firmware: createDeviceDto.firmware,
          }
        );

        return {
          success: true,
          message: 'Device updated successfully',
          data: updated,
        };
      }

      // Create new device
      const device = await this.devicesService.createIoTDevice(createDeviceDto);

      this.logger.log(`IoT device registered: ${device.id} - ${device.name}`);

      return {
        success: true,
        message: 'Device registered successfully',
        data: device,
      };
    } catch (error) {
      this.logger.error(`Error registering IoT device: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to register device: ${error.message}`);
    }
  }

  @Patch('serial/:serialNumber')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Update IoT device status',
    description: 'Update device status and metadata by serial number. No authentication required.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Device updated successfully' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Device not found' 
  })
  async updateDeviceBySerial(
    @Param('serialNumber') serialNumber: string,
    @Body() updateDeviceDto: UpdateDeviceDto & { status?: string; lastSeen?: Date }
  ) {
    try {
      this.logger.log(`IoT device update request: ${serialNumber}`);

      const updated = await this.devicesService.updateBySerialNumber(
        serialNumber,
        {
          ...updateDeviceDto,
          lastSeen: new Date(),
        }
      );

      return {
        success: true,
        message: 'Device updated successfully',
        data: updated,
      };
    } catch (error) {
      this.logger.error(`Error updating IoT device: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to update device: ${error.message}`);
    }
  }

  @Get('serial/:serialNumber')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get IoT device by serial number',
    description: 'Retrieve device details by serial number. No authentication required for IoT devices.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Device found' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Device not found' 
  })
  async getDeviceBySerial(@Param('serialNumber') serialNumber: string) {
    try {
      this.logger.log(`IoT device lookup request: ${serialNumber}`);

      const device = await this.devicesService.findBySerialNumber(serialNumber);

      if (!device) {
        throw new NotFoundException(`Device with serial number ${serialNumber} not found`);
      }
      
      // Log success for debugging
      this.logger.log(`Device found with serial number: ${serialNumber}, id: ${device.id}`);

      return {
        success: true,
        message: 'Device found',
        data: device,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error looking up IoT device: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to lookup device: ${error.message}`);
    }
  }
}
