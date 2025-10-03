import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';
import { IngestSensorDataDto } from './dto/ingest-sensor-data.dto';
import { BatchIngestDto } from './dto/batch-ingest.dto';
import { SensorDataQueryDto } from './dto/sensor-data-query.dto';
import {
  SensorAggregationDto,
  AggregationType,
} from './dto/sensor-aggregation.dto';
import { SensorFilterQueryDto } from './dto/sensor-filter-query.dto';

@Injectable()
export class SensorsService {
  constructor(private prisma: PrismaService) {}

  // 1. List all sensors with filtering and pagination
  async findAll(query: SensorFilterQueryDto, currentUser: any) {
    const { type, deviceId, search, isActive, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Apply filters
    if (type) where.type = type;
    if (deviceId) where.deviceId = deviceId;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    // RBAC: Users can only see sensors from their devices
    if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      const userDevices = await this.prisma.device.findMany({
        where: { userId: currentUser.id },
        select: { id: true },
      });
      where.deviceId = { in: userDevices.map((d) => d.id) };
    }

    const [sensors, total] = await Promise.all([
      this.prisma.sensor.findMany({
        where,
        skip,
        take: limit,
        include: {
          device: { select: { id: true, name: true, type: true } },
          _count: { select: { sensorData: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sensor.count({ where }),
    ]);

    return {
      data: sensors,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 2. Create new sensor
  async create(createSensorDto: CreateSensorDto, currentUser: any) {
    const { deviceId, ...sensorData } = createSensorDto;

    // Verify device exists
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Check ownership
    if (
      device.userId !== currentUser.id &&
      !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)
    ) {
      throw new ForbiddenException('You do not own this device');
    }

    return this.prisma.sensor.create({
      data: {
        ...sensorData,
        deviceId,
      },
      include: {
        device: { select: { id: true, name: true } },
      },
    });
  }

  // 3. Get sensor details by ID
  async findOne(id: string) {
    const sensor = await this.prisma.sensor.findUnique({
      where: { id },
      include: {
        device: true,
        sensorData: {
          take: 100,
          orderBy: { timestamp: 'desc' },
        },
        alerts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { sensorData: true } },
      },
    });

    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    return sensor;
  }

  // 4. Update sensor configuration
  async update(id: string, updateSensorDto: UpdateSensorDto) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });

    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    return this.prisma.sensor.update({
      where: { id },
      data: updateSensorDto,
      include: {
        device: { select: { id: true, name: true } },
      },
    });
  }

  // 5. Delete sensor (soft delete)
  async remove(id: string) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });

    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    return this.prisma.sensor.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // 6. Ingest sensor data point
  async ingestData(
    id: string,
    ingestDto: IngestSensorDataDto,
    currentUser: any,
  ) {
    const sensor = await this.prisma.sensor.findUnique({
      where: { id },
      include: { device: true },
    });

    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    // Validate value against min/max
    if (sensor.minValue !== null && ingestDto.value < sensor.minValue) {
      throw new BadRequestException(
        `Value below minimum threshold (${sensor.minValue})`,
      );
    }
    if (sensor.maxValue !== null && ingestDto.value > sensor.maxValue) {
      throw new BadRequestException(
        `Value above maximum threshold (${sensor.maxValue})`,
      );
    }

    const sensorData = await this.prisma.sensorData.create({
      data: {
        deviceId: sensor.deviceId,
        sensorId: id,
        userId: currentUser.id,
        type: sensor.type,
        value: ingestDto.value,
        unit: sensor.unit,
        quality: ingestDto.metadata?.quality || 'good',
        timestamp: ingestDto.timestamp
          ? new Date(ingestDto.timestamp)
          : new Date(),
      },
    });

    // TODO: Check alerts and send notifications
    // TODO: Emit WebSocket event for real-time updates

    return { success: true, data: sensorData };
  }

  // 7. Batch ingest multiple sensor data points
  async batchIngest(id: string, batchDto: BatchIngestDto, currentUser: any) {
    const sensor = await this.prisma.sensor.findUnique({
      where: { id },
      include: { device: true },
    });

    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    const dataPoints = batchDto.data.map((point) => ({
      deviceId: sensor.deviceId,
      sensorId: id,
      userId: currentUser.id,
      type: sensor.type,
      value: point.value,
      unit: sensor.unit,
      quality: point.metadata?.quality || 'good',
      timestamp: point.timestamp ? new Date(point.timestamp) : new Date(),
    }));

    await this.prisma.sensorData.createMany({
      data: dataPoints,
    });

    return { success: true, count: dataPoints.length };
  }

  // 8. Get sensor data with optional date range filter
  async getData(id: string, query: SensorDataQueryDto) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    const { startDate, endDate, limit = 100, interval } = query;
    const where: any = { sensorId: id };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const data = await this.prisma.sensorData.findMany({
      where,
      take: limit,
      orderBy: { timestamp: 'desc' },
    });

    return {
      sensor,
      data,
      count: data.length,
    };
  }

  // 9. Get latest sensor reading
  async getLatest(id: string) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    const latest = await this.prisma.sensorData.findFirst({
      where: { sensorId: id },
      orderBy: { timestamp: 'desc' },
    });

    if (!latest) {
      throw new NotFoundException('No sensor data found');
    }

    return {
      sensor,
      latestReading: latest,
    };
  }

  // 10. Get aggregated sensor data (avg, min, max, etc.)
  async getAggregations(id: string, query: SensorAggregationDto) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    const { aggregations, startDate, endDate, groupBy } = query;
    const where: any = { sensorId: id };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const aggregateResult = await this.prisma.sensorData.aggregate({
      where,
      _avg: aggregations.includes(AggregationType.AVG)
        ? { value: true }
        : undefined,
      _min: aggregations.includes(AggregationType.MIN)
        ? { value: true }
        : undefined,
      _max: aggregations.includes(AggregationType.MAX)
        ? { value: true }
        : undefined,
      _sum: aggregations.includes(AggregationType.SUM)
        ? { value: true }
        : undefined,
      _count: aggregations.includes(AggregationType.COUNT) ? true : undefined,
    });

    return {
      sensor,
      period: { startDate, endDate },
      aggregations: aggregateResult,
    };
  }

  // 11. Get sensor statistics and insights
  async getStatistics(id: string, query: SensorDataQueryDto) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    const { startDate, endDate } = query;
    const where: any = { sensorId: id };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [stats, totalReadings] = await Promise.all([
      this.prisma.sensorData.aggregate({
        where,
        _avg: { value: true },
        _min: { value: true },
        _max: { value: true },
        _count: true,
      }),
      this.prisma.sensorData.count({ where }),
    ]);

    return {
      sensor,
      statistics: {
        average: stats._avg.value,
        minimum: stats._min.value,
        maximum: stats._max.value,
        totalReadings,
        period: { startDate, endDate },
      },
    };
  }

  // 12. Calibrate sensor
  async calibrate(id: string, calibrationData: any) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    return this.prisma.sensor.update({
      where: { id },
      data: { calibration: calibrationData },
    });
  }

  // 13. Get sensor health and connectivity status
  async getHealth(id: string) {
    const sensor = await this.prisma.sensor.findUnique({
      where: { id },
      include: { device: true },
    });

    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    const latestReading = await this.prisma.sensorData.findFirst({
      where: { sensorId: id },
      orderBy: { timestamp: 'desc' },
    });

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const isOnline = latestReading && latestReading.timestamp > fiveMinutesAgo;

    return {
      sensor,
      health: {
        isOnline,
        lastSeen: latestReading?.timestamp,
        status: sensor.isActive ? 'active' : 'inactive',
      },
    };
  }

  // 14. Clear sensor historical data
  async clearData(id: string, query: SensorDataQueryDto) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    const { startDate, endDate } = query;
    const where: any = { sensorId: id };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const result = await this.prisma.sensorData.deleteMany({ where });

    return {
      success: true,
      deletedCount: result.count,
    };
  }

  // 15. Get sensor alerts and threshold violations
  async getAlerts(id: string) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    const alerts = await this.prisma.alert.findMany({
      where: { sensorId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      sensor,
      alerts,
      count: alerts.length,
    };
  }

  // 16. Get sensor data trends and patterns
  async getTrends(id: string, query: SensorDataQueryDto) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    const { startDate, endDate, limit = 100 } = query;
    const where: any = { sensorId: id };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const data = await this.prisma.sensorData.findMany({
      where,
      take: limit,
      orderBy: { timestamp: 'asc' },
      select: { value: true, timestamp: true },
    });

    // Simple trend calculation
    const values = data.map((d) => d.value);
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const trend = values.length > 1 ? values[values.length - 1] - values[0] : 0;

    return {
      sensor,
      data,
      trends: {
        average,
        trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
        changeValue: trend,
      },
    };
  }

  // 17. Toggle sensor activation status
  async toggleActivation(id: string) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    return this.prisma.sensor.update({
      where: { id },
      data: { isActive: !sensor.isActive },
    });
  }

  // 18. Export sensor data (CSV/JSON)
  async exportData(
    id: string,
    query: SensorDataQueryDto,
    format: 'csv' | 'json',
  ) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor) {
      throw new NotFoundException('Sensor not found');
    }

    const { startDate, endDate, limit = 10000 } = query;
    const where: any = { sensorId: id };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const data = await this.prisma.sensorData.findMany({
      where,
      take: limit,
      orderBy: { timestamp: 'desc' },
    });

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'timestamp,value,unit,quality\n';
      const csvRows = data
        .map((d) => `${d.timestamp},${d.value},${d.unit},${d.quality}`)
        .join('\n');
      return { format: 'csv', content: csvHeader + csvRows };
    }

    return { format: 'json', content: data };
  }
}
