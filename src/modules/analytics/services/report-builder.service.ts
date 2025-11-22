import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../common/services/cache.service';
import { CreateReportDto, ReportConfiguration } from '../dto/create-report.dto';
import { ExecuteReportDto } from '../dto/execute-report.dto';
import { ReportResponseDto, ReportExecutionResponseDto } from '../dto/report-response.dto';
import { Report, ReportExecution, ReportType, ExecutionStatus, Prisma } from '@prisma/client';

interface ReportFilters {
  type?: ReportType;
  isActive?: boolean;
}

@Injectable()
export class ReportBuilderService {
  private readonly logger = new Logger(ReportBuilderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Create a new custom report
   */
  async createReport(createReportDto: CreateReportDto, userId: string): Promise<ReportResponseDto> {
    this.logger.log(`Creating report: ${createReportDto.name} for user: ${userId}`);

    const report = await this.prisma.report.create({
      data: {
        name: createReportDto.name,
        description: createReportDto.description,
        type: createReportDto.type,
        configuration: createReportDto.configuration as any,
        schedule: createReportDto.schedule as any,
        createdBy: userId,
        isActive: true,
      },
    });

    // Invalidate cache
    await this.cacheService.delete(`reports:user:${userId}`);

    return this.toReportResponseDto(report);
  }

  /**
   * Get all reports for a user with optional filters
   */
  async getReports(userId: string, filters?: ReportFilters): Promise<ReportResponseDto[]> {
    const cacheKey = `reports:user:${userId}:${JSON.stringify(filters || {})}`;
    const cached = await this.cacheService.get<ReportResponseDto[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const reports = await this.prisma.report.findMany({
      where: {
        createdBy: userId,
        ...(filters?.type && { type: filters.type }),
        ...(filters?.isActive !== undefined && {
          isActive: filters.isActive,
        }),
      },
      orderBy: { createdAt: 'desc' },
    });

    const response = reports.map(report => this.toReportResponseDto(report));

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, response, 300);

    return response;
  }

  /**
   * Get a report by ID
   */
  async getReportById(reportId: string): Promise<ReportResponseDto> {
    const cacheKey = `report:${reportId}`;
    const cached = await this.cacheService.get<ReportResponseDto>(cacheKey);

    if (cached) {
      return cached;
    }

    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    const response = this.toReportResponseDto(report);

    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, response, 600);

    return response;
  }

  /**
   * Update a report
   */
  async updateReport(
    reportId: string,
    updateDto: Partial<CreateReportDto>,
  ): Promise<ReportResponseDto> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        ...(updateDto.name && { name: updateDto.name }),
        ...(updateDto.description !== undefined && {
          description: updateDto.description,
        }),
        ...(updateDto.type && { type: updateDto.type }),
        ...(updateDto.configuration && {
          configuration: updateDto.configuration as any,
        }),
        ...(updateDto.schedule && { schedule: updateDto.schedule as any }),
      },
    });

    // Invalidate cache
    await this.cacheService.delete(`report:${reportId}`);
    await this.cacheService.delete(`reports:user:${report.createdBy}`);

    return this.toReportResponseDto(updated);
  }

  /**
   * Delete a report
   */
  async deleteReport(reportId: string): Promise<void> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    await this.prisma.report.delete({
      where: { id: reportId },
    });

    // Invalidate cache
    await this.cacheService.delete(`report:${reportId}`);
    await this.cacheService.delete(`reports:user:${report.createdBy}`);

    this.logger.log(`Report ${reportId} deleted successfully`);
  }

  /**
   * Execute a report
   */
  async executeReport(
    reportId: string,
    userId: string,
    executeDto?: ExecuteReportDto,
  ): Promise<ReportExecutionResponseDto> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    this.logger.log(`Executing report: ${report.name} (${reportId})`);

    // Create execution record
    const execution = await this.prisma.reportExecution.create({
      data: {
        reportId,
        executedBy: userId,
        status: ExecutionStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      // Execute report based on type
      const configuration = report.configuration as unknown as ReportConfiguration;
      const filters = executeDto?.overrideFilters
        ? { ...configuration.filters, ...executeDto.overrideFilters }
        : configuration.filters;

      let resultData: any;

      switch (report.type) {
        case ReportType.SALES:
          resultData = await this.executeSalesReport(filters, configuration);
          break;
        case ReportType.REVENUE:
          resultData = await this.executeRevenueReport(filters, configuration);
          break;
        case ReportType.ORDERS:
          resultData = await this.executeOrdersReport(filters, configuration);
          break;
        case ReportType.PRODUCTS:
          resultData = await this.executeProductsReport(filters, configuration);
          break;
        case ReportType.USERS:
          resultData = await this.executeUsersReport(filters, configuration);
          break;
        case ReportType.DEVICES:
          resultData = await this.executeDevicesReport(filters, configuration);
          break;
        case ReportType.CUSTOM:
          resultData = await this.executeCustomReport(filters, configuration);
          break;
        default:
          throw new Error(`Unsupported report type: ${report.type}`);
      }

      // Update execution with results
      const completed = await this.prisma.reportExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.COMPLETED,
          completedAt: new Date(),
          duration: new Date().getTime() - new Date(execution.startedAt).getTime(),
          resultData: resultData,
        },
      });

      return this.toReportExecutionResponseDto(completed);
    } catch (error) {
      // Update execution with error
      const failed = await this.prisma.reportExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.FAILED,
          completedAt: new Date(),
          duration: new Date().getTime() - new Date(execution.startedAt).getTime(),
          errorMessage: error.message,
        },
      });

      this.logger.error(`Report execution failed: ${error.message}`, error);

      return this.toReportExecutionResponseDto(failed);
    }
  }

  /**
   * Get report execution history
   */
  async getReportExecutions(
    reportId: string,
    limit: number = 10,
  ): Promise<ReportExecutionResponseDto[]> {
    const executions = await this.prisma.reportExecution.findMany({
      where: { reportId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return executions.map(exec => this.toReportExecutionResponseDto(exec));
  }

  /**
   * Get scheduled reports
   */
  async getScheduledReports(): Promise<ReportResponseDto[]> {
    const reports = await this.prisma.report.findMany({
      where: {
        isActive: true,
        schedule: { not: Prisma.JsonNull },
      },
    });

    return reports.map(report => this.toReportResponseDto(report));
  }

  /**
   * Execute sales report
   */
  private async executeSalesReport(filters: any, config: ReportConfiguration): Promise<any> {
    const { start, end } = filters.dateRange;

    const sales = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: new Date(start), lte: new Date(end) },
        status: { in: ['DELIVERED'] },
        // TODO: Add category filtering when Product-Category relation is established
      },
      include: {
        orderItems: {
          include: { product: true },
        },
        user: true,
      },
      ...(config.limit && { take: config.limit }),
    });

    return {
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, order) => sum + Number(order.total), 0),
      sales: sales.map(order => ({
        orderId: order.id,
        date: order.createdAt,
        customer: order.user?.email || 'N/A',
        amount: Number(order.total),
        items: order.orderItems?.length || 0,
      })),
    };
  }

  /**
   * Execute revenue report
   */
  private async executeRevenueReport(filters: any, config: ReportConfiguration): Promise<any> {
    const { start, end } = filters.dateRange;

    const revenue = await this.prisma.order.aggregate({
      where: {
        createdAt: { gte: new Date(start), lte: new Date(end) },
        status: { in: ['DELIVERED'] },
      },
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    });

    return {
      totalRevenue: Number(revenue._sum.total || 0),
      totalOrders: revenue._count,
      averageOrderValue: Number(revenue._avg.total || 0),
      period: { start, end },
    };
  }

  /**
   * Execute orders report
   */
  private async executeOrdersReport(filters: any, config: ReportConfiguration): Promise<any> {
    const { start, end } = filters.dateRange;

    const orders = await this.prisma.order.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: new Date(start), lte: new Date(end) },
      },
      _count: true,
      _sum: { total: true },
    });

    return {
      ordersByStatus: orders.map(group => ({
        status: group.status,
        count: group._count,
        totalRevenue: Number(group._sum.total || 0),
      })),
    };
  }

  /**
   * Execute products report
   */
  private async executeProductsReport(filters: any, config: ReportConfiguration): Promise<any> {
    const { start, end } = filters.dateRange;

    const products = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          createdAt: { gte: new Date(start), lte: new Date(end) },
          status: { in: ['DELIVERED'] },
        },
      },
      _sum: { quantity: true, price: true },
      _count: true,
      orderBy: { _sum: { quantity: 'desc' } },
      ...(config.limit && { take: config.limit }),
    });

    const productDetails = await this.prisma.product.findMany({
      where: { id: { in: products.map(p => p.productId) } },
    });

    return {
      topProducts: products.map(item => {
        const product = productDetails.find(p => p.id === item.productId);
        return {
          productId: item.productId,
          productName: product?.name || 'Unknown',
          quantitySold: item._sum?.quantity || 0,
          revenue: item._sum?.price || 0,
          orderCount: item._count,
        };
      }),
    };
  }

  /**
   * Execute users report
   */
  private async executeUsersReport(filters: any, config: ReportConfiguration): Promise<any> {
    const { start, end } = filters.dateRange;

    const users = await this.prisma.user.count({
      where: {
        createdAt: { gte: new Date(start), lte: new Date(end) },
      },
    });

    const activeUsers = await this.prisma.user.count({
      where: {
        lastLoginAt: { gte: new Date(start), lte: new Date(end) },
      },
    });

    return {
      totalUsers: users,
      activeUsers,
      period: { start, end },
    };
  }

  /**
   * Execute devices report
   */
  private async executeDevicesReport(filters: any, config: ReportConfiguration): Promise<any> {
    const { start, end } = filters.dateRange;

    const devices = await this.prisma.device.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: new Date(start), lte: new Date(end) },
      },
      _count: true,
    });

    return {
      devicesByStatus: devices.map(group => ({
        status: group.status,
        count: group._count,
      })),
    };
  }

  /**
   * Execute custom report (placeholder)
   */
  private async executeCustomReport(filters: any, config: ReportConfiguration): Promise<any> {
    // Custom report logic would be implemented based on config
    return {
      message: 'Custom report execution not yet implemented',
      config,
    };
  }

  /**
   * Convert Report entity to ReportResponseDto
   */
  private toReportResponseDto(report: Report): ReportResponseDto {
    return {
      id: report.id,
      name: report.name,
      description: report.description ?? undefined,
      type: report.type,
      configuration: report.configuration as unknown as ReportConfiguration,
      schedule: report.schedule as any,
      isActive: report.isActive,
      createdBy: report.createdBy,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      executionCount: 0, // Would need to count from ReportExecution table
    };
  }

  /**
   * Convert ReportExecution entity to ReportExecutionResponseDto
   */
  private toReportExecutionResponseDto(execution: ReportExecution): ReportExecutionResponseDto {
    return {
      id: execution.id,
      reportId: execution.reportId,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt ?? undefined,
      duration: execution.duration ?? undefined,
      resultData: execution.resultData,
      resultUrl: execution.resultUrl ?? undefined,
      errorMessage: execution.errorMessage ?? undefined,
      executedBy: execution.executedBy ?? '',
    };
  }
}
