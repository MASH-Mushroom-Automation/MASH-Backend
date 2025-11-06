import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Super Admin')
@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@ApiBearerAuth()
export class SuperAdminController {
  constructor(private readonly svc: SuperAdminService) {}

  @Get('dashboard/overview')
  @ApiOperation({ summary: 'Get super-admin dashboard overview' })
  @ApiResponse({ status: 200, description: 'Overview retrieved' })
  async getOverview() {
    return this.svc.getOverview();
  }

  @Get('dashboard/sales')
  @ApiOperation({ summary: 'Get daily sales for last N days' })
  async getSales(@Query('days') days = '7') {
    const d = parseInt(days as string, 10) || 7;
    return this.svc.getDailySales(d);
  }

  @Get('dashboard/chambers')
  @ApiOperation({ summary: 'Get chamber registry' })
  async getChambers(@Query('page') page = '1', @Query('limit') limit = '10') {
    const p = parseInt(page as string, 10) || 1;
    const l = parseInt(limit as string, 10) || 10;
    return this.svc.getChamberRegistry(p, l);
  }

  @Get('dashboard/users-stats')
  @ApiOperation({ summary: 'Get users counts by role' })
  async getUsersStats() {
    return this.svc.getUsersStats();
  }

  @Get('dashboard/cards')
  @ApiOperation({ summary: 'Get cards summary counts' })
  async getCards() {
    return this.svc.getCardsSummary();
  }
}
