import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ThrottleEndpoint } from '../../common/decorators/throttle-endpoint.decorator';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { ReportBuilderService } from './services/report-builder.service';
import { ChartDataService } from './services/chart-data.service';
import { ForecastService } from './services/forecast.service';
import { ComparisonService } from './services/comparison.service';
import { DrillDownService } from './services/drilldown.service';
import { ScheduledReportsService } from './services/scheduled-reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ExecuteReportDto } from './dto/execute-report.dto';
import { ReportResponseDto, ReportExecutionResponseDto } from './dto/report-response.dto';
import { ExportConfigDto, ExportResponseDto } from './dto/export-config.dto';
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
    private readonly forecastService: ForecastService,
    private readonly comparisonService: ComparisonService,
    private readonly drillDownService: DrillDownService,
    private readonly scheduledReportsService: ScheduledReportsService,
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
    return this.chartDataService.getBarChartData(metricsArray, categoriesArray, dateRange);
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
    return this.chartDataService.getAreaChartData(metricsArray, dateRange, groupBy);
  }

  // Export Engine Endpoints

  @Post('export')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new data export' })
  @ApiResponse({
    status: 201,
    description: 'Export created successfully',
    type: ExportResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid export configuration' })
  async createExport(@Body() config: ExportConfigDto) {
    return this.analyticsService.createExport(config);
  }

  @Get('export/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get export status and metadata' })
  @ApiResponse({
    status: 200,
    description: 'Export status retrieved',
    type: ExportResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Export not found' })
  async getExportStatus(@Param('id') id: string) {
    return this.analyticsService.getExportStatus(id);
  }

  @Get('exports')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List all exports' })
  @ApiResponse({
    status: 200,
    description: 'All exports retrieved',
    type: [ExportResponseDto],
  })
  async listExports() {
    return this.analyticsService.listExports();
  }

  @Delete('export/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete an export' })
  @ApiResponse({ status: 200, description: 'Export deleted successfully' })
  @ApiResponse({ status: 404, description: 'Export not found' })
  async deleteExport(@Param('id') id: string) {
    return this.analyticsService.deleteExport(id);
  }

  // Predictive Analytics Endpoints

  @Get('forecast/revenue')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Forecast revenue for next N days' })
  @ApiResponse({ status: 200, description: 'Revenue forecast generated' })
  async forecastRevenue(@Query('days') days?: number) {
    return this.forecastService.forecastRevenue(days ? parseInt(days.toString()) : 30);
  }

  @Get('forecast/demand')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Predict product demand' })
  @ApiResponse({ status: 200, description: 'Demand prediction generated' })
  async predictDemand(@Query('productId') productId?: string, @Query('days') days?: number) {
    return this.forecastService.predictDemand(productId, days ? parseInt(days.toString()) : 30);
  }

  @Get('forecast/anomalies')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Detect anomalies in data patterns' })
  @ApiResponse({ status: 200, description: 'Anomalies detected' })
  async detectAnomalies(
    @Query('type') type?: 'revenue' | 'orders' | 'users',
    @Query('days') days?: number,
  ) {
    return this.forecastService.detectAnomalies(
      type || 'revenue',
      days ? parseInt(days.toString()) : 30,
    );
  }

  // Comparative Analytics Endpoints

  @Get('comparison/periods')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Compare metrics between two time periods' })
  @ApiResponse({ status: 200, description: 'Period comparison generated' })
  async comparePeriods(
    @Query('metric') metric: 'revenue' | 'orders' | 'users' | 'products',
    @Query('currentStart') currentStart: string,
    @Query('currentEnd') currentEnd: string,
    @Query('previousStart') previousStart: string,
    @Query('previousEnd') previousEnd: string,
  ) {
    return this.comparisonService.comparePeriods(
      metric,
      new Date(currentStart),
      new Date(currentEnd),
      new Date(previousStart),
      new Date(previousEnd),
    );
  }

  @Get('comparison/cohorts')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Analyze user cohorts' })
  @ApiResponse({ status: 200, description: 'Cohort analysis generated' })
  async analyzeCohorts(
    @Query('type') type?: 'weekly' | 'monthly',
    @Query('months') months?: number,
  ) {
    return this.comparisonService.analyzeCohorts(
      type || 'monthly',
      months ? parseInt(months.toString()) : 6,
    );
  }

  @Get('comparison/products')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Compare product performance' })
  @ApiResponse({ status: 200, description: 'Product comparison generated' })
  async compareProducts(
    @Query('productIds') productIds: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const ids = productIds.split(',');
    return this.comparisonService.compareProducts(ids, new Date(startDate), new Date(endDate));
  }

  @Get('comparison/categories')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Compare category performance' })
  @ApiResponse({ status: 200, description: 'Category comparison generated' })
  async compareCategories(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.comparisonService.compareCategories(new Date(startDate), new Date(endDate));
  }

  // ==================== Day 6: Drill-Down Analytics ====================

  @Get('drilldown/category/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Drill down from category to products',
    description: 'Get detailed product performance metrics for a specific category',
  })
  @ApiResponse({
    status: 200,
    description: 'Category drill-down data retrieved successfully',
  })
  async drillDownCategory(
    @Param('id') categoryId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const defaultEnd = new Date();

    return this.drillDownService.categoryToProducts(
      categoryId,
      startDate ? new Date(startDate) : defaultStart,
      endDate ? new Date(endDate) : defaultEnd,
    );
  }

  @Get('drilldown/product/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Drill down from product to orders',
    description: 'Get detailed order information for a specific product',
  })
  @ApiResponse({
    status: 200,
    description: 'Product drill-down data retrieved successfully',
  })
  async drillDownProduct(
    @Param('id') productId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const defaultEnd = new Date();

    return this.drillDownService.productToOrders(
      productId,
      startDate ? new Date(startDate) : defaultStart,
      endDate ? new Date(endDate) : defaultEnd,
    );
  }

  @Get('drilldown/user/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Drill down from user to orders',
    description: 'Get detailed order history for a specific user',
  })
  @ApiResponse({
    status: 200,
    description: 'User drill-down data retrieved successfully',
  })
  async drillDownUser(
    @Param('id') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const defaultEnd = new Date();

    return this.drillDownService.userToOrders(
      userId,
      startDate ? new Date(startDate) : defaultStart,
      endDate ? new Date(endDate) : defaultEnd,
    );
  }

  // ==================== Day 6: Scheduled Reports ====================

  @Post('reports/subscribe')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Subscribe to scheduled report',
    description: 'Create a new subscription for automated report delivery',
  })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
  })
  async createReportSubscription(
    @Request() req,
    @Body()
    data: {
      reportId: string;
      frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      format?: string;
      recipients?: string[];
    },
  ) {
    return this.scheduledReportsService.createSubscription(data.reportId, req.user.id, data);
  }

  @Get('reports/subscriptions')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Get user subscriptions',
    description: 'List all report subscriptions for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions retrieved successfully',
  })
  async getSubscriptions(@Request() req) {
    return this.scheduledReportsService.getUserSubscriptions(req.user.id);
  }

  @Delete('reports/subscribe/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Cancel subscription',
    description: 'Delete a report subscription',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription deleted successfully',
  })
  async deleteSubscription(@Param('id') subscriptionId: string, @Request() req) {
    return this.scheduledReportsService.deleteSubscription(subscriptionId, req.user.id);
  }

  @Post('reports/subscribe/:id/trigger')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Manually trigger subscription',
    description: 'Generate and send report immediately for a subscription',
  })
  @ApiResponse({
    status: 200,
    description: 'Report generation triggered successfully',
  })
  async triggerSubscription(@Param('id') subscriptionId: string, @Request() req) {
    return this.scheduledReportsService.triggerSubscription(subscriptionId, req.user.id);
  }
}
