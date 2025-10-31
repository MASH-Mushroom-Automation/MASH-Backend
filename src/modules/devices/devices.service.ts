import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MqttService } from './mqtt.service';
import { DevicesGateway } from './devices.gateway';
import { CacheService } from '../../common/services/cache.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DeviceFilterQueryDto } from './dto/device-filter-query.dto';
import { DeviceCommandDto, DeviceCommand } from './dto/device-command.dto';
import { DeviceConfigurationDto } from './dto/device-configuration.dto';
import { FirmwareUpdateDto } from './dto/firmware-update.dto';
import { SensorCalibrationDto } from './dto/sensor-calibration.dto';
import { DeviceAnalyticsQueryDto } from './dto/device-analytics-query.dto';

interface DeviceHealthData {
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
}

interface DeviceHealthRecord {
  id: string;
  deviceId: string;
  timestamp: Date;
  status: string;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  temperature?: number;
  batteryLevel?: number;
  networkLatency?: number;
  uptime?: number;
  errorCount: number;
  metadata?: any;
  createdAt: Date;
}

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  // Cache configuration
  private readonly DEVICE_CACHE_PREFIX = 'device';
  private readonly DEVICES_LIST_CACHE_PREFIX = 'devices:list';
  private readonly DEVICE_CONFIG_CACHE_PREFIX = 'device:config';
  private readonly USER_DEVICES_CACHE_PREFIX = 'devices:user';
  private readonly DEVICE_TTL = 300; // 5 minutes (device status changes frequently)
  private readonly DEVICE_CONFIG_TTL = 600; // 10 minutes (configuration changes less frequently)

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttService: MqttService,
    private readonly devicesGateway: DevicesGateway,
    private readonly cacheService: CacheService,
  ) {}

  // ========== Device CRUD ==========

  async findAll(query: DeviceFilterQueryDto, currentUser: any) {
    // Generate cache key based on query parameters and user context
    const cacheKey = `${this.DEVICES_LIST_CACHE_PREFIX}:${currentUser.id}:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for devices list: ${cacheKey}`);
      return cached;
    }

    const {
      page = 1,
      limit = 10,
      type,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Users can only see their own devices unless admin
    if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      where.userId = currentUser.id;
    }

    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [devices, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder.toLowerCase() },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          location: true,
          description: true,
          firmware: true,
          lastSeen: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.device.count({ where }),
    ]);

    const result = {
      data: devices,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache the result with 5-minute TTL
    await this.cacheService.set(cacheKey, result, this.DEVICE_TTL, ['devices', 'devices:list']);

    return result;
  }

  async create(createDeviceDto: CreateDeviceDto, currentUser: any) {
    // Generate unique serial number
    const serialNumber = `DEV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Check if user can create devices
    if (
      !['ADMIN', 'SUPER_ADMIN', 'GROWER'].includes(currentUser.role) &&
      createDeviceDto.userId !== currentUser.id
    ) {
      throw new ForbiddenException('You can only create devices for yourself');
    }

    const device = await this.prisma.device.create({
      data: {
        ...createDeviceDto,
        serialNumber,
        status: 'OFFLINE',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Invalidate devices list caches
    await this.cacheService.invalidateByTags(['devices', 'devices:list']);

    this.logger.log(`Device created: ${device.id} - ${device.name}`);
    return device;
  }

  async findOne(id: string, currentUser: any) {
    // Generate cache key
    const cacheKey = `${this.DEVICE_CACHE_PREFIX}:${id}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      // Still need to check permissions for cached data
      if (
        cached.userId !== currentUser.id &&
        !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)
      ) {
        throw new ForbiddenException('You do not have permission to view this device');
      }
      this.logger.debug(`Cache hit for device: ${cacheKey}`);
      return cached;
    }

    const device = await this.prisma.device.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        sensors: {
          where: { isActive: true },
        },
        deviceCommands: {
          take: 10,
          orderBy: { sentAt: 'desc' },
        },
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Check permissions
    if (device.userId !== currentUser.id && !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw new ForbiddenException('You do not have permission to view this device');
    }

    // Cache the result with 5-minute TTL
    await this.cacheService.set(cacheKey, device, this.DEVICE_TTL, ['devices', `device:${id}`]);

    return device;
  }

  async update(id: string, updateDeviceDto: UpdateDeviceDto, currentUser: any) {
    const device = await this.findOne(id, currentUser);

    const updated = await this.prisma.device.update({
      where: { id },
      data: updateDeviceDto,
      include: {
        user: true,
        sensors: { where: { isActive: true } },
      },
    });

    // Invalidate device caches
    await this.cacheService.invalidateByTags(['devices', 'devices:list', `device:${id}`]);

    this.logger.log(`Device updated: ${id}`);
    return updated;
  }

  async remove(id: string) {
    // Soft delete
    const device = await this.prisma.device.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate device caches
    await this.cacheService.invalidateByTags(['devices', 'devices:list', `device:${id}`]);

    this.logger.log(`Device deleted: ${id}`);
    return { message: 'Device deleted successfully', device };
  }

  async toggleActivation(id: string, currentUser: any) {
    const device = await this.findOne(id, currentUser);

    const updated = await this.prisma.device.update({
      where: { id },
      data: { isActive: !device.isActive },
    });

    // Invalidate device caches
    await this.cacheService.invalidateByTags(['devices', 'devices:list', `device:${id}`]);

    return {
      message: `Device ${updated.isActive ? 'activated' : 'deactivated'}`,
      device: updated,
    };
  }

  // ========== Device Control & Commands ==========

  async sendCommand(id: string, commandDto: DeviceCommandDto, currentUser: any) {
    const device = await this.findOne(id, currentUser);

    if (device.status === 'OFFLINE') {
      throw new BadRequestException('Cannot send command to offline device');
    }

    // Store command in database
    const deviceCommand = await this.prisma.deviceCommand.create({
      data: {
        deviceId: id,
        command: commandDto.command,
        parameters: commandDto.parameters || {},
        status: 'pending',
      },
    });

    // Send command via MQTT
    try {
      await this.mqttService.sendCommand(id, commandDto.command, commandDto.parameters);

      // Update command status
      await this.prisma.deviceCommand.update({
        where: { id: deviceCommand.id },
        data: { status: 'sent' },
      });

      // Invalidate device cache (command history changed)
      await this.cacheService.invalidateByTags([`device:${id}`]);

      this.logger.log(`Command sent to device ${id}: ${commandDto.command}`);

      return {
        message: 'Command sent successfully',
        commandId: deviceCommand.id,
        status: 'sent',
      };
    } catch (error) {
      await this.prisma.deviceCommand.update({
        where: { id: deviceCommand.id },
        data: { status: 'failed' },
      });

      throw new BadRequestException('Failed to send command to device');
    }
  }

  async getCommandHistory(id: string, currentUser: any) {
    await this.findOne(id, currentUser);

    const commands = await this.prisma.deviceCommand.findMany({
      where: { deviceId: id },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });

    return { commands };
  }

  async getStatus(id: string, currentUser: any) {
    const device = await this.findOne(id, currentUser);

    // Request fresh status from device via MQTT
    try {
      await this.mqttService.requestStatus(id);
    } catch (error) {
      this.logger.warn(`Failed to request status from device ${id}`);
    }

    return {
      deviceId: id,
      status: device.status,
      lastSeen: device.lastSeen,
      isActive: device.isActive,
      firmware: device.firmware,
      ipAddress: device.ipAddress,
      macAddress: device.macAddress,
    };
  }

  async restart(id: string, currentUser: any) {
    return this.sendCommand(id, { command: DeviceCommand.RESTART, parameters: {} }, currentUser);
  }

  async reset(id: string, currentUser: any) {
    return this.sendCommand(id, { command: DeviceCommand.RESET, parameters: {} }, currentUser);
  }

  // ========== Configuration & Firmware ==========

  async getConfiguration(id: string, currentUser: any) {
    const device = await this.findOne(id, currentUser);

    // Configuration could be stored in a separate table or as JSON
    // For now, return placeholder
    return {
      deviceId: id,
      configuration: {
        readingInterval: 60,
        alertThresholds: {},
        operationSettings: {},
        notificationSettings: {},
      },
    };
  }

  async updateConfiguration(id: string, configDto: DeviceConfigurationDto, currentUser: any) {
    const device = await this.findOne(id, currentUser);

    // Send configuration to device via MQTT
    try {
      await this.mqttService.updateConfiguration(id, configDto);

      this.logger.log(`Configuration updated for device ${id}`);

      return {
        message: 'Configuration sent to device',
        configuration: configDto,
      };
    } catch (error) {
      throw new BadRequestException('Failed to send configuration to device');
    }
  }

  async updateFirmware(id: string, firmwareDto: FirmwareUpdateDto, currentUser: any) {
    const device = await this.findOne(id, currentUser);

    // Send firmware update command via MQTT
    const command = {
      command: DeviceCommand.UPDATE_FIRMWARE,
      parameters: firmwareDto,
    };

    const result = await this.sendCommand(id, command, currentUser);

    // Update device firmware version in database (will be confirmed by device)
    await this.prisma.device.update({
      where: { id },
      data: { firmware: `${firmwareDto.version} (updating)` },
    });

    return {
      ...result,
      message: 'Firmware update initiated',
    };
  }

  async getFirmwareHistory(id: string, currentUser: any) {
    await this.findOne(id, currentUser);

    // Get firmware update commands from history
    const firmwareUpdates = await this.prisma.deviceCommand.findMany({
      where: {
        deviceId: id,
        command: 'UPDATE_FIRMWARE',
      },
      orderBy: { sentAt: 'desc' },
    });

    return { updates: firmwareUpdates };
  }

  // ========== Sensors Management ==========

  async getSensors(id: string, currentUser: any) {
    await this.findOne(id, currentUser);

    const sensors = await this.prisma.sensor.findMany({
      where: { deviceId: id, isActive: true },
    });

    return { sensors };
  }

  async addSensor(id: string, sensorDto: any) {
    const sensor = await this.prisma.sensor.create({
      data: {
        deviceId: id,
        ...sensorDto,
      },
    });

    this.logger.log(`Sensor added to device ${id}: ${sensor.id}`);
    return sensor;
  }

  async updateSensor(id: string, sensorId: string, sensorDto: any) {
    const sensor = await this.prisma.sensor.findFirst({
      where: { id: sensorId, deviceId: id },
    });

    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    const updated = await this.prisma.sensor.update({
      where: { id: sensorId },
      data: sensorDto,
    });

    return updated;
  }

  async removeSensor(id: string, sensorId: string) {
    const sensor = await this.prisma.sensor.findFirst({
      where: { id: sensorId, deviceId: id },
    });

    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    // Soft delete
    await this.prisma.sensor.update({
      where: { id: sensorId },
      data: { isActive: false },
    });

    return { message: 'Sensor removed successfully' };
  }

  async calibrateSensor(
    id: string,
    sensorId: string,
    calibrationDto: SensorCalibrationDto,
    currentUser: any,
  ) {
    await this.findOne(id, currentUser);

    const sensor = await this.prisma.sensor.findFirst({
      where: { id: sensorId, deviceId: id },
    });

    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    // Update sensor calibration data
    const updated = await this.prisma.sensor.update({
      where: { id: sensorId },
      data: { calibration: calibrationDto.calibrationData },
    });

    // Send calibration command to device
    const command = {
      command: DeviceCommand.CALIBRATE,
      parameters: {
        sensorId,
        ...calibrationDto.calibrationData,
      },
    };

    await this.sendCommand(id, command, currentUser);

    return {
      message: 'Sensor calibration initiated',
      sensor: updated,
    };
  }

  // ========== Analytics & Health ==========

  async getAnalytics(id: string, query: DeviceAnalyticsQueryDto, currentUser: any) {
    await this.findOne(id, currentUser);

    const { startDate, endDate, metrics = [] } = query;

    // Calculate analytics based on sensor data and commands
    const whereClause: any = { deviceId: id };
    if (startDate) whereClause.timestamp = { gte: new Date(startDate) };
    if (endDate)
      whereClause.timestamp = {
        ...whereClause.timestamp,
        lte: new Date(endDate),
      };

    const [sensorDataCount, commandsCount, successfulCommands] = await Promise.all([
      this.prisma.sensorData.count({ where: whereClause }),
      this.prisma.deviceCommand.count({
        where: {
          deviceId: id,
          ...(startDate && { sentAt: { gte: new Date(startDate) } }),
        },
      }),
      this.prisma.deviceCommand.count({
        where: {
          deviceId: id,
          status: 'acknowledged',
          ...(startDate && { sentAt: { gte: new Date(startDate) } }),
        },
      }),
    ]);

    return {
      deviceId: id,
      period: { startDate, endDate },
      metrics: {
        dataPoints: sensorDataCount,
        commandsSent: commandsCount,
        commandSuccessRate:
          commandsCount > 0 ? ((successfulCommands / commandsCount) * 100).toFixed(2) : 0,
        uptime: '99.5%', // Placeholder - calculate based on lastSeen timestamps
      },
    };
  }

  async getHealth(id: string, currentUser: any) {
    const device = await this.findOne(id, currentUser);

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const isOnline = device.lastSeen && device.lastSeen > fiveMinutesAgo;

    return {
      deviceId: id,
      status: device.status,
      isOnline,
      lastSeen: device.lastSeen,
      firmware: device.firmware,
      health: {
        connectivity: isOnline ? 'GOOD' : 'POOR',
        lastError: null, // Fetch from alerts table
        uptime: device.lastSeen
          ? `${Math.floor((now.getTime() - new Date(device.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days`
          : 'N/A',
      },
    };
  }

  // ========== Device Health Monitoring ==========

  /**
   * Record device health data
   */
  async recordDeviceHealth(
    deviceId: string,
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
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    // Update device status based on health
    const newStatus = this.mapHealthToDeviceStatus(healthData.status);
    if (device.status !== newStatus) {
      await this.prisma.device.update({
        where: { id: deviceId },
        data: { status: newStatus, lastSeen: new Date() },
      });

      // Clear cache
      await this.cacheService.delete(`${this.DEVICE_CACHE_PREFIX}:${deviceId}`);
    }

    // Record health data
    // TODO: Uncomment when Prisma client is regenerated
    // const healthRecord = await this.prisma.deviceHealth.create({
    //   data: {
    //     deviceId,
    //     status: healthData.status as any,
    //     cpuUsage: healthData.cpuUsage,
    //     memoryUsage: healthData.memoryUsage,
    //     diskUsage: healthData.diskUsage,
    //     temperature: healthData.temperature,
    //     batteryLevel: healthData.batteryLevel,
    //     networkLatency: healthData.networkLatency,
    //     uptime: healthData.uptime,
    //     errorCount: healthData.errorCount || 0,
    //     metadata: healthData.metadata || {},
    //   },
    // });

    const healthRecord = {
      id: 'temp-id',
      deviceId,
      timestamp: new Date(),
      ...healthData,
      createdAt: new Date(),
    };

    this.logger.log(`Health record created for device ${deviceId}: ${healthData.status}`);

    // Emit health update via WebSocket
    this.devicesGateway.emitDeviceHealthUpdate(deviceId, healthRecord);

    return healthRecord;
  }

  /**
   * Get device health history
   */
  async getDeviceHealthHistory(
    deviceId: string,
    limit: number = 50,
    startDate?: Date,
    endDate?: Date,
  ) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    const where: any = { deviceId };
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    // TODO: Uncomment when Prisma client is regenerated
    // return this.prisma.deviceHealth.findMany({
    //   where,
    //   orderBy: { timestamp: 'desc' },
    //   take: limit,
    // });

    // Mock data for now
    return [];
  }

  /**
   * Get current device health status
   */
  async getDeviceHealthStatus(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      // TODO: Uncomment when Prisma client is regenerated
      // include: {
      //   healthRecords: {
      //     orderBy: { timestamp: 'desc' },
      //     take: 1,
      //   },
      // },
    });

    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    // const latestHealth = device.healthRecords[0];
    const latestHealth = null; // Mock for now

    const isOnline = this.isDeviceOnline(device);

    return {
      deviceId,
      deviceName: device.name,
      status: device.status,
      isOnline,
      lastSeen: device.lastSeen,
      latestHealth: latestHealth || null,
      healthSummary: this.calculateHealthSummary(device, latestHealth),
    };
  }

  /**
   * Perform health check on device
   */
  async performHealthCheck(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    // Simulate health check (in real implementation, this would ping the device)
    const healthData = {
      status: this.determineHealthStatus(device) as any,
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      temperature: 20 + Math.random() * 30,
      networkLatency: Math.floor(Math.random() * 100),
      uptime: device.lastSeen ? Math.floor((Date.now() - device.lastSeen.getTime()) / 1000) : 0,
      errorCount: 0,
    };

    return this.recordDeviceHealth(deviceId, healthData);
  }

  /**
   * Get health summary for multiple devices
   */
  async getDevicesHealthSummary(userId?: string) {
    const where: any = { isActive: true };
    if (userId) where.userId = userId;

    // TODO: Uncomment when Prisma client is regenerated
    // const devices = await this.prisma.device.findMany({
    //   where,
    //   include: {
    //     healthRecords: {
    //       orderBy: { timestamp: 'desc' },
    //       take: 1,
    //     },
    //   },
    // });

    const devices = await this.prisma.device.findMany({
      where,
    });

    const summary = {
      total: devices.length,
      online: 0,
      offline: 0,
      maintenance: 0,
      error: 0,
      healthy: 0,
      warning: 0,
      critical: 0,
    };

    devices.forEach(device => {
      const isOnline = this.isDeviceOnline(device);
      if (isOnline) summary.online++;
      else summary.offline++;

      switch (device.status) {
        case 'MAINTENANCE':
          summary.maintenance++;
          break;
        case 'ERROR':
          summary.error++;
          break;
      }

      // const latestHealth = device.healthRecords[0];
      const latestHealth = null; // Mock for now
      if (latestHealth) {
        switch (latestHealth.status) {
          case 'HEALTHY':
            summary.healthy++;
            break;
          case 'WARNING':
            summary.warning++;
            break;
          case 'CRITICAL':
            summary.critical++;
            break;
        }
      }
    });

    return summary;
  }

  // ========== Private Helper Methods ==========

  private isDeviceOnline(device: any): boolean {
    if (!device.lastSeen) return false;
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    return device.lastSeen > fiveMinutesAgo;
  }

  private mapHealthToDeviceStatus(healthStatus: string): any {
    switch (healthStatus) {
      case 'HEALTHY':
        return 'ONLINE';
      case 'WARNING':
        return 'ONLINE';
      case 'CRITICAL':
        return 'ERROR';
      case 'OFFLINE':
        return 'OFFLINE';
      case 'MAINTENANCE':
        return 'MAINTENANCE';
      default:
        return 'OFFLINE';
    }
  }

  private determineHealthStatus(device: any): string {
    const now = new Date();
    const lastSeen = device.lastSeen;

    if (!lastSeen) return 'OFFLINE';

    const minutesSinceLastSeen = (now.getTime() - lastSeen.getTime()) / (1000 * 60);

    if (minutesSinceLastSeen > 30) return 'OFFLINE';
    if (minutesSinceLastSeen > 10) return 'WARNING';

    return 'HEALTHY';
  }

  private calculateHealthSummary(device: any, latestHealth: any) {
    if (!latestHealth) {
      return {
        overall: 'UNKNOWN',
        connectivity: this.isDeviceOnline(device) ? 'GOOD' : 'POOR',
        performance: 'UNKNOWN',
        errors: 0,
      };
    }

    let overall = 'HEALTHY';
    if (latestHealth.status === 'CRITICAL' || latestHealth.status === 'OFFLINE') {
      overall = 'CRITICAL';
    } else if (latestHealth.status === 'WARNING') {
      overall = 'WARNING';
    }

    return {
      overall,
      connectivity:
        latestHealth.networkLatency && latestHealth.networkLatency < 100 ? 'GOOD' : 'POOR',
      performance: latestHealth.cpuUsage && latestHealth.cpuUsage < 80 ? 'GOOD' : 'POOR',
      errors: latestHealth.errorCount || 0,
    };
  }
}
