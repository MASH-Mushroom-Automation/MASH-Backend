import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ThrottleEndpoint } from '../../common/decorators/throttle-endpoint.decorator';
import { DateRangeQueryDto } from './dto/date-range-query.dto';

@ApiTags('Analytics')
@Controller('api/v1/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ThrottleEndpoint('EXPENSIVE') // All analytics endpoints limited to 10 req/min
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get dashboard overview statistics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getDashboardStats(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getDashboardStats(query);
  }

  @Get('sales')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get sales analytics with date range filtering' })
  @ApiResponse({
    status: 200,
    description: 'Sales analytics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getSalesAnalytics(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getSalesAnalytics(query);
  }

  @Get('products')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get product performance metrics' })
  @ApiResponse({
    status: 200,
    description: 'Product metrics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getProductMetrics(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getProductMetrics(query);
  }

  @Get('users')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get user engagement metrics' })
  @ApiResponse({
    status: 200,
    description: 'User engagement metrics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getUserEngagement(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getUserEngagement(query);
  }

  @Get('devices')
  @Roles('ADMIN', 'SUPER_ADMIN', 'GROWER')
  @ApiOperation({ summary: 'Get device usage statistics' })
  @ApiResponse({
    status: 200,
    description: 'Device statistics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDeviceStatistics(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getDeviceStatistics(query);
  }

  @Get('orders')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get order trends (daily/weekly/monthly)' })
  @ApiResponse({
    status: 200,
    description: 'Order trends retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getOrderTrends(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getOrderTrends(query);
  }

  @Get('revenue')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get revenue reports with aggregations' })
  @ApiResponse({
    status: 200,
    description: 'Revenue reports retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getRevenueReports(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getRevenueReports(query);
  }

  @Get('growth')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get growth metrics (MoM, YoY comparisons)' })
  @ApiResponse({
    status: 200,
    description: 'Growth metrics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getGrowthMetrics(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getGrowthMetrics(query);
  }

  @Get('top-products')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get best-selling products' })
  @ApiResponse({
    status: 200,
    description: 'Top products retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getTopProducts(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getTopProducts(query);
  }

  @Get('top-categories')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get popular product categories' })
  @ApiResponse({
    status: 200,
    description: 'Top categories retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getTopCategories(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getTopCategories(query);
  }
}
