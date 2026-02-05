import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SelectableFields } from '../../common/decorators/selectable-fields.decorator';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DeviceFilterQueryDto } from './dto/device-filter-query.dto';
import { DeviceCommandDto } from './dto/device-command.dto';
import { DeviceConfigurationDto } from './dto/device-configuration.dto';
import { FirmwareUpdateDto } from './dto/firmware-update.dto';
import { SensorCalibrationDto } from './dto/sensor-calibration.dto';
import { DeviceAnalyticsQueryDto } from './dto/device-analytics-query.dto';
import { DeviceStatusTask } from './tasks/device-status.task';

@ApiTags('devices')
@Controller('devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly deviceStatusTask: DeviceStatusTask,
  ) {}

  // ========== Device CRUD (6 endpoints) ==========

  @Get()
  @SelectableFields({
    allowedFields: [
      'id',
      'name',
      'type',
      'status',
      'isActive',
      'lastSeen',
      'firmware',
      'userId',
      'createdAt',
      'updatedAt',
      'serialNumber',
      'location',
      'description',
      'user',
    ],
    requiredFields: ['id', 'name', 'status'],
    defaultFields: ['id', 'name', 'type', 'status', 'isActive', 'lastSeen', 'serialNumber', 'location', 'description', 'user', 'userId'],
    maxFields: 15,
  })
  @ApiOperation({ summary: 'List all devices with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'Devices retrieved successfully',
  })
  async findAll(@Query() query: DeviceFilterQueryDto, @Request() req) {
    return this.devicesService.findAll(query, req.user);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN', 'GROWER')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create new device' })
  @ApiResponse({ status: 201, description: 'Device created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid device data' })
  async create(@Body() createDeviceDto: CreateDeviceDto, @Request() req) {
    return this.devicesService.create(createDeviceDto, req.user);
  }

  @Get(':id')
  @SelectableFields({
    allowedFields: [
      'id',
      'name',
      'type',
      'status',
      'isActive',
      'lastSeen',
      'firmware',
      'configuration',
      'userId',
      'createdAt',
      'updatedAt',
      'serialNumber',
      'location',
      'description',
      'user',
    ],
    requiredFields: ['id'],
    defaultFields: ['id', 'name', 'type', 'status', 'isActive', 'lastSeen', 'firmware', 'serialNumber', 'location', 'description', 'user'],
    maxFields: 15,
  })
  @ApiOperation({ summary: 'Get device details by ID' })
  @ApiResponse({ status: 200, description: 'Device retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.devicesService.findOne(id, req.user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update device information' })
  @ApiResponse({ status: 200, description: 'Device updated successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async update(@Param('id') id: string, @Body() updateDeviceDto: UpdateDeviceDto, @Request() req) {
    return this.devicesService.update(id, updateDeviceDto, req.user);
  }

  @Put(':id/assign')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Assign device to user' })
  @ApiResponse({ status: 200, description: 'Device assigned successfully' })
  async assign(@Param('id') id: string, @Body('userId') userId: string) {
    return this.devicesService.assignDevice(id, userId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Soft delete device' })
  @ApiResponse({ status: 200, description: 'Device deleted successfully' })
  async remove(@Param('id') id: string) {
    return this.devicesService.remove(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate or deactivate device' })
  @ApiResponse({ status: 200, description: 'Device activation status updated' })
  async toggleActivation(@Param('id') id: string, @Request() req) {
    return this.devicesService.toggleActivation(id, req.user);
  }

  @Post('status/check')
  @ApiOperation({ 
    summary: 'Trigger on-demand device status check',
    description: 'Checks all devices and marks inactive ones as offline. Used by Admin Dashboard.'
  })
  @ApiResponse({ status: 200, description: 'Device status check completed' })
  async checkDeviceStatus() {
    return this.deviceStatusTask.checkDeviceStatusOnDemand();
  }

  // ========== Device Control & Commands (5 endpoints) ==========

  @Post(':id/command')
  @ApiOperation({ summary: 'Send command to device via MQTT' })
  @ApiResponse({ status: 200, description: 'Command sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid command' })
  async sendCommand(@Param('id') id: string, @Body() commandDto: DeviceCommandDto, @Request() req) {
    return this.devicesService.sendCommand(id, commandDto, req.user);
  }

  @Get(':id/commands')
  @ApiOperation({ summary: 'Get device command history' })
  @ApiResponse({ status: 200, description: 'Command history retrieved' })
  async getCommandHistory(@Param('id') id: string, @Request() req) {
    return this.devicesService.getCommandHistory(id, req.user);
  }

  @Get(':id/status')
  @ApiOperation({
    summary: 'Get real-time device status (WebSocket compatible)',
  })
  @ApiResponse({ status: 200, description: 'Device status retrieved' })
  async getStatus(@Param('id') id: string, @Request() req) {
    return this.devicesService.getStatus(id, req.user);
  }

  @Post(':id/restart')
  @ApiOperation({ summary: 'Restart device' })
  @ApiResponse({ status: 200, description: 'Restart command sent' })
  async restart(@Param('id') id: string, @Request() req) {
    return this.devicesService.restart(id, req.user);
  }

  @Post(':id/reset')
  @Roles('ADMIN', 'SUPER_ADMIN', 'GROWER')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Factory reset device' })
  @ApiResponse({ status: 200, description: 'Reset command sent' })
  async reset(@Param('id') id: string, @Request() req) {
    return this.devicesService.reset(id, req.user);
  }

  // ========== Configuration & Firmware (4 endpoints) ==========

  @Get(':id/configuration')
  @ApiOperation({ summary: 'Get device configuration' })
  @ApiResponse({ status: 200, description: 'Configuration retrieved' })
  async getConfiguration(@Param('id') id: string, @Request() req) {
    return this.devicesService.getConfiguration(id, req.user);
  }

  @Put(':id/configuration')
  @ApiOperation({ summary: 'Update device configuration via MQTT' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  async updateConfiguration(
    @Param('id') id: string,
    @Body() configDto: DeviceConfigurationDto,
    @Request() req,
  ) {
    return this.devicesService.updateConfiguration(id, configDto, req.user);
  }

  @Post(':id/firmware')
  @Roles('ADMIN', 'SUPER_ADMIN', 'GROWER')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update device firmware (OTA)' })
  @ApiResponse({ status: 200, description: 'Firmware update initiated' })
  async updateFirmware(
    @Param('id') id: string,
    @Body() firmwareDto: FirmwareUpdateDto,
    @Request() req,
  ) {
    return this.devicesService.updateFirmware(id, firmwareDto, req.user);
  }

  @Get(':id/firmware/history')
  @ApiOperation({ summary: 'Get firmware update history' })
  @ApiResponse({ status: 200, description: 'Firmware history retrieved' })
  async getFirmwareHistory(@Param('id') id: string, @Request() req) {
    return this.devicesService.getFirmwareHistory(id, req.user);
  }

  // ========== Sensors Management (5 endpoints) ==========

  @Get(':id/sensors')
  @ApiOperation({ summary: 'List all sensors for device' })
  @ApiResponse({ status: 200, description: 'Sensors retrieved' })
  async getSensors(@Param('id') id: string, @Request() req) {
    return this.devicesService.getSensors(id, req.user);
  }

  @Post(':id/sensors')
  @Roles('ADMIN', 'SUPER_ADMIN', 'GROWER')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Add sensor to device' })
  @ApiResponse({ status: 201, description: 'Sensor added' })
  async addSensor(@Param('id') id: string, @Body() sensorDto: any) {
    return this.devicesService.addSensor(id, sensorDto);
  }

  @Put(':id/sensors/:sensorId')
  @ApiOperation({ summary: 'Update sensor configuration' })
  @ApiResponse({ status: 200, description: 'Sensor updated' })
  async updateSensor(
    @Param('id') id: string,
    @Param('sensorId') sensorId: string,
    @Body() sensorDto: any,
  ) {
    return this.devicesService.updateSensor(id, sensorId, sensorDto);
  }

  @Delete(':id/sensors/:sensorId')
  @Roles('ADMIN', 'SUPER_ADMIN', 'GROWER')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Remove sensor from device' })
  @ApiResponse({ status: 200, description: 'Sensor removed' })
  async removeSensor(@Param('id') id: string, @Param('sensorId') sensorId: string) {
    return this.devicesService.removeSensor(id, sensorId);
  }

  @Post(':id/sensors/:sensorId/calibrate')
  @ApiOperation({ summary: 'Calibrate sensor' })
  @ApiResponse({ status: 200, description: 'Sensor calibration initiated' })
  async calibrateSensor(
    @Param('id') id: string,
    @Param('sensorId') sensorId: string,
    @Body() calibrationDto: SensorCalibrationDto,
    @Request() req,
  ) {
    return this.devicesService.calibrateSensor(id, sensorId, calibrationDto, req.user);
  }

  // ========== Analytics & Health (2 endpoints) ==========

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get device performance analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved' })
  async getAnalytics(
    @Param('id') id: string,
    @Query() query: DeviceAnalyticsQueryDto,
    @Request() req,
  ) {
    return this.devicesService.getAnalytics(id, query, req.user);
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Get device health and diagnostics' })
  @ApiResponse({ status: 200, description: 'Health status retrieved' })
  async getHealth(@Param('id') id: string, @Request() req) {
    return this.devicesService.getHealth(id, req.user);
  }

  // ========== Device Health Monitoring Endpoints ==========

  @Post(':id/health')
  @ApiOperation({ summary: 'Record device health data' })
  @ApiResponse({ status: 201, description: 'Health data recorded' })
  async recordHealth(
    @Param('id') id: string,
    @Body()
    healthData: {
      status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE' | 'MAINTENANCE';
      cpuUsage?: number;
      memoryUsage?: number;
      diskUsage?: number;
      temperature?: number;
      batteryLevel?: number;
      networkLatency?: number;
      uptime?: number;
      errorCount?: number;
      metadata?: any;
    },
  ) {
    return this.devicesService.recordDeviceHealth(id, healthData);
  }

  @Get(':id/health/history')
  @ApiOperation({ summary: 'Get device health history' })
  @ApiResponse({ status: 200, description: 'Health history retrieved' })
  async getHealthHistory(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.devicesService.getDeviceHealthHistory(id, limit || 50, start, end);
  }

  @Get(':id/health/status')
  @ApiOperation({ summary: 'Get current device health status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved' })
  async getHealthStatus(@Param('id') id: string) {
    return this.devicesService.getDeviceHealthStatus(id);
  }

  @Post(':id/health/check')
  @ApiOperation({ summary: 'Perform health check on device' })
  @ApiResponse({ status: 200, description: 'Health check performed' })
  async performHealthCheck(@Param('id') id: string) {
    return this.devicesService.performHealthCheck(id);
  }

  @Get('health/summary')
  @ApiOperation({ summary: 'Get health summary for all devices' })
  @ApiResponse({ status: 200, description: 'Health summary retrieved' })
  async getHealthSummary(@Request() req) {
    return this.devicesService.getDevicesHealthSummary(req.user?.id);
  }
}
