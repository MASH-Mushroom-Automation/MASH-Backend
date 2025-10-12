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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { SystemConfigDto } from './dto/system-config.dto';
import { MaintenanceDto } from './dto/maintenance.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard overview statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics retrieved' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users with advanced filters' })
  @ApiResponse({ status: 200, description: 'Users list retrieved' })
  async getAllUsers(@Query() query: any) {
    return this.adminService.getAllUsers(query);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  async updateUserRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, updateRoleDto.role);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Update user active status' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, updateStatusDto.isActive);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get system audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved' })
  async getAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.adminService.getAuditLogs(query);
  }

  @Get('system/health')
  @ApiOperation({ summary: 'Get system health check' })
  @ApiResponse({ status: 200, description: 'System health status' })
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  @Get('system/metrics')
  @ApiOperation({ summary: 'Get system performance metrics' })
  @ApiResponse({ status: 200, description: 'System metrics retrieved' })
  async getSystemMetrics() {
    return this.adminService.getSystemMetrics();
  }

  @Post('system/config')
  @ApiOperation({ summary: 'Update system configuration' })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated successfully',
  })
  async updateSystemConfig(@Body() configDto: SystemConfigDto) {
    return this.adminService.updateSystemConfig(
      configDto.key,
      configDto.value,
      configDto.metadata ? JSON.stringify(configDto.metadata) : undefined,
    );
  }

  @Get('analytics/overview')
  @ApiOperation({ summary: 'Get admin analytics overview' })
  @ApiResponse({ status: 200, description: 'Analytics overview retrieved' })
  async getAnalyticsOverview(@Query() query: any) {
    return this.adminService.getAnalyticsOverview(query);
  }

  @Post('maintenance')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Trigger system maintenance tasks' })
  @ApiResponse({ status: 200, description: 'Maintenance task triggered' })
  async triggerMaintenance(@Body() maintenanceDto: MaintenanceDto) {
    return this.adminService.performMaintenance(maintenanceDto.action);
  }

  @Get('reports/generate')
  @ApiOperation({ summary: 'Generate system reports' })
  @ApiResponse({ status: 200, description: 'Report generated successfully' })
  async generateReport(@Query('type') type: string) {
    return this.adminService.generateReport(type);
  }

  @Delete('cache/clear')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Clear system cache' })
  @ApiResponse({ status: 200, description: 'Cache cleared successfully' })
  async clearCache() {
    return this.adminService.clearCache();
  }
}
