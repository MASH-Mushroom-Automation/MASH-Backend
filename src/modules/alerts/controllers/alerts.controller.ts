import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AlertEngineService } from '../services/alert-engine.service';
import { AlertHistoryService } from '../services/alert-history.service';
import { TriggerAlertDto } from '../dto/trigger-alert.dto';
import { QueryAlertsDto } from '../dto/query-alerts.dto';

@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(
    private readonly alertEngine: AlertEngineService,
    private readonly alertHistory: AlertHistoryService,
  ) {}

  @Post('trigger')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Manually trigger an alert evaluation' })
  @ApiResponse({ status: 200, description: 'Alert evaluation completed' })
  async triggerAlert(@Body() dto: TriggerAlertDto) {
    return this.alertEngine.evaluateEvent({
      eventType: dto.eventType,
      data: dto.data,
      timestamp: new Date(),
    });
  }

  @Get('history')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get alert history' })
  @ApiResponse({ status: 200, description: 'Alert history retrieved' })
  async getHistory(@Query() query: QueryAlertsDto) {
    return this.alertHistory.getAlertHistory(query);
  }

  @Get('active')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get currently active alerts' })
  @ApiResponse({ status: 200, description: 'Active alerts retrieved' })
  async getActiveAlerts() {
    return this.alertHistory.getActiveAlerts();
  }

  @Post(':id/acknowledge')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged' })
  async acknowledgeAlert(@Param('id') id: string) {
    return this.alertHistory.acknowledgeAlert(id);
  }

  @Post(':id/resolve')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Resolve an alert' })
  @ApiResponse({ status: 200, description: 'Alert resolved' })
  async resolveAlert(@Param('id') id: string) {
    return this.alertHistory.resolveAlert(id);
  }

  @Get('statistics')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get alert statistics' })
  @ApiResponse({ status: 200, description: 'Alert statistics retrieved' })
  async getStatistics(@Query('days') days: number = 7): Promise<any> {
    return this.alertHistory.getAlertStatistics(days);
  }
}
