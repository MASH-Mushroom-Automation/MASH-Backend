import {
  Controller,
  Get,
  Post,
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
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ThrottleEndpoint } from '../../common/decorators/throttle-endpoint.decorator';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { ReportBuilderService } from './services/report-builder.service';
import { ChartDataService } from './services/chart-data.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ExecuteReportDto } from './dto/execute-report.dto';
import {
  ReportResponseDto,
  ReportExecutionResponseDto,
} from './dto/report-response.dto';
import { ReportType } from '@prisma/client';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ThrottleEndpoint('EXPENSIVE') // All analytics endpoints limited to 10 req/min
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly reportBuilderService: ReportBuilderService,
    private readonly chartDataService: ChartDataService,
  ) {}

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

  // ==================== REPORT BUILDER ENDPOINTS ====================

  @Post('reports')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create custom report' })
  @ApiResponse({
    status: 201,
    description: 'Report created successfully',
    type: ReportResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async createReport(
    @Body() createReportDto: CreateReportDto,
    @Request() req,
  ): Promise<ReportResponseDto> {
    return this.reportBuilderService.createReport(createReportDto, req.user.id);
  }

  @Get('reports')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all reports' })
  @ApiResponse({
    status: 200,
    description: 'Reports retrieved successfully',
    type: [ReportResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getReports(
    @Request() req,
    @Query('type') type?: ReportType,
    @Query('isActive') isActive?: boolean,
  ): Promise<ReportResponseDto[]> {
    return this.reportBuilderService.getReports(req.user.id, {
      type,
      isActive,
    });
  }

  @Get('reports/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get report by ID' })
  @ApiResponse({
    status: 200,
    description: 'Report retrieved successfully',
    type: ReportResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getReportById(@Param('id') id: string): Promise<ReportResponseDto> {
    return this.reportBuilderService.getReportById(id);
  }

  @Post('reports/:id/execute')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Execute report' })
  @ApiResponse({
    status: 200,
    description: 'Report executed successfully',
    type: ReportExecutionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async executeReport(
    @Param('id') id: string,
    @Body() executeDto: ExecuteReportDto,
    @Request() req,
  ): Promise<ReportExecutionResponseDto> {
    return this.reportBuilderService.executeReport(id, req.user.id, executeDto);
  }

  @Get('reports/:id/executions')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get report execution history' })
  @ApiResponse({
    status: 200,
    description: 'Execution history retrieved successfully',
    type: [ReportExecutionResponseDto],
  })
  async getReportExecutions(
    @Param('id') id: string,
    @Query('limit') limit: number = 10,
  ): Promise<ReportExecutionResponseDto[]> {
    return this.reportBuilderService.getReportExecutions(id, limit);
  }

  // ==================== CHART VISUALIZATION ENDPOINTS ====================

  @Get('visualizations/line-chart')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get line chart data for time-series metrics' })
  @ApiResponse({ status: 200, description: 'Line chart data retrieved' })
  async getLineChartData(
    @Query('metric') metric: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy: 'day' | 'week' | 'month' = 'day',
  ) {
    const dateRange = { start: new Date(startDate), end: new Date(endDate) };
    return this.chartDataService.getLineChartData(metric, dateRange, groupBy);
  }

  @Get('visualizations/bar-chart')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get bar chart data for metric comparisons' })
  @ApiResponse({ status: 200, description: 'Bar chart data retrieved' })
  async getBarChartData(
    @Query('metrics') metrics: string,
    @Query('categories') categories: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const metricsArray = metrics.split(',');
    const categoriesArray = categories.split(',');
    const dateRange = { start: new Date(startDate), end: new Date(endDate) };
    return this.chartDataService.getBarChartData(
      metricsArray,
      categoriesArray,
      dateRange,
    );
  }

  @Get('visualizations/pie-chart')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get pie chart data for metric distribution' })
  @ApiResponse({ status: 200, description: 'Pie chart data retrieved' })
  async getPieChartData(
    @Query('metric') metric: string,
    @Query('groupBy') groupBy: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const dateRange = { start: new Date(startDate), end: new Date(endDate) };
    return this.chartDataService.getPieChartData(metric, groupBy, dateRange);
  }

  @Get('visualizations/area-chart')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get area chart data for multiple metrics' })
  @ApiResponse({ status: 200, description: 'Area chart data retrieved' })
  async getAreaChartData(
    @Query('metrics') metrics: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy: 'day' | 'week' | 'month' = 'day',
  ) {
    const metricsArray = metrics.split(',');
    const dateRange = { start: new Date(startDate), end: new Date(endDate) };
    return this.chartDataService.getAreaChartData(
      metricsArray,
      dateRange,
      groupBy,
    );
  }
}
