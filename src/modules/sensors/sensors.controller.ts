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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SensorsService } from './sensors.service';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';
import { IngestSensorDataDto } from './dto/ingest-sensor-data.dto';
import { BatchIngestDto } from './dto/batch-ingest.dto';
import { SensorDataQueryDto } from './dto/sensor-data-query.dto';
import { SensorAggregationDto } from './dto/sensor-aggregation.dto';
import { SensorFilterQueryDto } from './dto/sensor-filter-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Sensors')
@Controller('sensors')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SensorsController {
  constructor(private readonly sensorsService: SensorsService) {}

  // 1. GET /sensors - List all sensors with filters
  @Get()
  @ApiOperation({ summary: 'List all sensors with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Sensors retrieved successfully' })
  async findAll(@Query() query: SensorFilterQueryDto, @Request() req) {
    return this.sensorsService.findAll(query, req.user);
  }

  // 2. POST /sensors - Create new sensor
  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN', 'GROWER')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create new sensor' })
  @ApiResponse({ status: 201, description: 'Sensor created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createSensorDto: CreateSensorDto, @Request() req) {
    return this.sensorsService.create(createSensorDto, req.user);
  }

  // 3. GET /sensors/:id - Get sensor details
  @Get(':id')
  @ApiOperation({ summary: 'Get sensor details by ID' })
  @ApiResponse({ status: 200, description: 'Sensor retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async findOne(@Param('id') id: string) {
    return this.sensorsService.findOne(id);
  }

  // 4. PUT /sensors/:id - Update sensor
  @Put(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'GROWER')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update sensor configuration' })
  @ApiResponse({ status: 200, description: 'Sensor updated successfully' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async update(
    @Param('id') id: string,
    @Body() updateSensorDto: UpdateSensorDto,
  ) {
    return this.sensorsService.update(id, updateSensorDto);
  }

  // 5. DELETE /sensors/:id - Delete sensor
  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'GROWER')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Delete sensor (soft delete)' })
  @ApiResponse({ status: 200, description: 'Sensor deleted successfully' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async remove(@Param('id') id: string) {
    return this.sensorsService.remove(id);
  }

  // 6. POST /sensors/:id/data - Ingest sensor data
  @Post(':id/data')
  @ApiOperation({ summary: 'Ingest sensor data point' })
  @ApiResponse({
    status: 201,
    description: 'Sensor data ingested successfully',
  })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async ingestData(
    @Param('id') id: string,
    @Body() ingestDto: IngestSensorDataDto,
    @Request() req,
  ) {
    return this.sensorsService.ingestData(id, ingestDto, req.user);
  }

  // 7. POST /sensors/:id/data/batch - Batch ingest sensor data
  @Post(':id/data/batch')
  @ApiOperation({ summary: 'Batch ingest multiple sensor data points' })
  @ApiResponse({ status: 201, description: 'Batch data ingested successfully' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async batchIngest(
    @Param('id') id: string,
    @Body() batchDto: BatchIngestDto,
    @Request() req,
  ) {
    return this.sensorsService.batchIngest(id, batchDto, req.user);
  }

  // 8. GET /sensors/:id/data - Get sensor data with date range
  @Get(':id/data')
  @ApiOperation({ summary: 'Get sensor data with optional date range filter' })
  @ApiResponse({
    status: 200,
    description: 'Sensor data retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async getData(@Param('id') id: string, @Query() query: SensorDataQueryDto) {
    return this.sensorsService.getData(id, query);
  }

  // 9. GET /sensors/:id/data/latest - Get latest reading
  @Get(':id/data/latest')
  @ApiOperation({ summary: 'Get latest sensor reading' })
  @ApiResponse({
    status: 200,
    description: 'Latest reading retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Sensor or data not found' })
  async getLatest(@Param('id') id: string) {
    return this.sensorsService.getLatest(id);
  }

  // 10. GET /sensors/:id/data/aggregations - Get aggregated data
  @Get(':id/data/aggregations')
  @ApiOperation({ summary: 'Get aggregated sensor data (avg, min, max, etc.)' })
  @ApiResponse({
    status: 200,
    description: 'Aggregated data retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async getAggregations(
    @Param('id') id: string,
    @Query() query: SensorAggregationDto,
  ) {
    return this.sensorsService.getAggregations(id, query);
  }

  // 11. GET /sensors/:id/statistics - Get sensor statistics
  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get sensor statistics and insights' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async getStatistics(
    @Param('id') id: string,
    @Query() query: SensorDataQueryDto,
  ) {
    return this.sensorsService.getStatistics(id, query);
  }

  // 12. POST /sensors/:id/calibrate - Calibrate sensor
  @Post(':id/calibrate')
  @Roles('ADMIN', 'SUPER_ADMIN', 'GROWER')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Calibrate sensor' })
  @ApiResponse({ status: 200, description: 'Sensor calibrated successfully' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async calibrate(@Param('id') id: string, @Body() calibrationData: any) {
    return this.sensorsService.calibrate(id, calibrationData);
  }

  // 13. GET /sensors/:id/health - Get sensor health status
  @Get(':id/health')
  @ApiOperation({ summary: 'Get sensor health and connectivity status' })
  @ApiResponse({
    status: 200,
    description: 'Health status retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async getHealth(@Param('id') id: string) {
    return this.sensorsService.getHealth(id);
  }

  // 14. DELETE /sensors/:id/data - Clear sensor data
  @Delete(':id/data')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Clear sensor historical data' })
  @ApiResponse({ status: 200, description: 'Sensor data cleared successfully' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async clearData(@Param('id') id: string, @Query() query: SensorDataQueryDto) {
    return this.sensorsService.clearData(id, query);
  }

  // 15. GET /sensors/:id/alerts - Get sensor alerts
  @Get(':id/alerts')
  @ApiOperation({ summary: 'Get sensor alerts and threshold violations' })
  @ApiResponse({ status: 200, description: 'Alerts retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async getAlerts(@Param('id') id: string) {
    return this.sensorsService.getAlerts(id);
  }

  // 16. GET /sensors/:id/trends - Get sensor trends
  @Get(':id/trends')
  @ApiOperation({ summary: 'Get sensor data trends and patterns' })
  @ApiResponse({ status: 200, description: 'Trends retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async getTrends(@Param('id') id: string, @Query() query: SensorDataQueryDto) {
    return this.sensorsService.getTrends(id, query);
  }

  // 17. POST /sensors/:id/activate - Activate/deactivate sensor
  @Post(':id/activate')
  @Roles('ADMIN', 'SUPER_ADMIN', 'GROWER')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Toggle sensor activation status' })
  @ApiResponse({
    status: 200,
    description: 'Sensor activation toggled successfully',
  })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async toggleActivation(@Param('id') id: string) {
    return this.sensorsService.toggleActivation(id);
  }

  // 18. GET /sensors/:id/export - Export sensor data
  @Get(':id/export')
  @ApiOperation({ summary: 'Export sensor data (CSV/JSON)' })
  @ApiResponse({ status: 200, description: 'Data exported successfully' })
  @ApiResponse({ status: 404, description: 'Sensor not found' })
  async exportData(
    @Param('id') id: string,
    @Query() query: SensorDataQueryDto,
    @Query('format') format: 'csv' | 'json' = 'json',
  ) {
    return this.sensorsService.exportData(id, query, format);
  }
}
