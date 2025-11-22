import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../common/services/cache.service';
import { ExportConfigDto, ExportFormat, ExportResponseDto } from '../dto/export-config.dto';
import { CsvExportService } from './csv-export.service';
import { ExcelExportService } from './excel-export.service';
import { PdfExportService } from './pdf-export.service';
import { ReportBuilderService } from './report-builder.service';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly exportCache = new Map<string, ExportResponseDto>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly csvExportService: CsvExportService,
    private readonly excelExportService: ExcelExportService,
    private readonly pdfExportService: PdfExportService,
    private readonly reportBuilderService: ReportBuilderService,
  ) {}

  /**
   * Export data based on configuration
   */
  async exportData(config: ExportConfigDto): Promise<ExportResponseDto> {
    try {
      this.logger.log(`Starting export: ${config.format} format`);

      // Generate export ID
      const exportId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Fetch data to export
      const data = await this.fetchDataForExport(config);

      if (!data || data.length === 0) {
        throw new BadRequestException('No data available for export');
      }

      // Generate filename
      const filename = config.filename || `analytics-export-${config.reportType || 'general'}`;

      // Export based on format
      let result: { filePath: string; fileSize: number };

      switch (config.format) {
        case ExportFormat.CSV:
          result = await this.csvExportService.exportToCSV(data, filename, config.columns);
          break;

        case ExportFormat.EXCEL:
          result = await this.excelExportService.exportToExcel(
            data,
            filename,
            config.columns,
            config.reportType || 'Report',
          );
          break;

        case ExportFormat.PDF:
          result = await this.pdfExportService.exportToPDF(data, filename, {
            title: config.reportType || 'Analytics Report',
            columns: config.columns,
            includeCharts: config.includeCharts,
          });
          break;

        case ExportFormat.JSON:
          result = await this.exportToJSON(data, filename);
          break;

        default:
          throw new BadRequestException(`Unsupported export format: ${config.format}`);
      }

      // Create export response
      const exportResponse: ExportResponseDto = {
        id: exportId,
        status: 'COMPLETED',
        fileUrl: result.filePath,
        fileSize: result.fileSize,
        rowCount: data.length,
        createdAt: new Date(),
        completedAt: new Date(),
      };

      // Cache export metadata
      this.exportCache.set(exportId, exportResponse);

      this.logger.log(
        `Export completed: ${exportId} (${result.fileSize} bytes, ${data.length} rows)`,
      );

      return exportResponse;
    } catch (error) {
      this.logger.error(`Export failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get export status
   */
  async getExportStatus(exportId: string): Promise<ExportResponseDto> {
    const cached = this.exportCache.get(exportId);
    if (!cached) {
      throw new BadRequestException('Export not found');
    }
    return cached;
  }

  /**
   * Fetch data for export based on configuration
   */
  private async fetchDataForExport(config: ExportConfigDto): Promise<any[]> {
    try {
      // If report type is specified, use custom fetch logic
      if (config.reportType) {
        return await this.fetchReportTypeData(config.reportType, config.filters || {});
      }

      // Default: fetch recent orders for demo
      const orders = await this.prisma.order.findMany({
        take: 1000,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          userId: true,
        },
      });

      return orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: Number(order.total),
        createdAt: order.createdAt,
        userId: order.userId,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch export data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch data by report type
   */
  private async fetchReportTypeData(reportType: string, filters: any): Promise<any[]> {
    switch (reportType) {
      case 'SALES':
        return this.fetchSalesData(filters);
      case 'REVENUE':
        return this.fetchRevenueData(filters);
      case 'USERS':
        return this.fetchUsersData(filters);
      case 'PRODUCTS':
        return this.fetchProductsData(filters);
      default:
        throw new BadRequestException(`Unsupported report type: ${reportType}`);
    }
  }

  private async fetchSalesData(filters: any): Promise<any[]> {
    const orders = await this.prisma.order.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(o => ({ ...o, total: Number(o.total) }));
  }

  private async fetchRevenueData(filters: any): Promise<any[]> {
    const orders = await this.prisma.order.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(o => ({ ...o, total: Number(o.total) }));
  }

  private async fetchUsersData(filters: any): Promise<any[]> {
    const users = await this.prisma.user.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });
    return users;
  }

  private async fetchProductsData(filters: any): Promise<any[]> {
    const products = await this.prisma.product.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });
    return products.map(p => ({ ...p, price: Number(p.price) }));
  }

  /**
   * Export to JSON format
   */
  private async exportToJSON(
    data: any[],
    filename: string,
  ): Promise<{ filePath: string; fileSize: number }> {
    const fs = await import('fs');
    const path = await import('path');

    const EXPORT_DIR = './uploads/exports';
    if (!fs.existsSync(EXPORT_DIR)) {
      fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonFilename = `${filename}-${timestamp}.json`;
    const filePath = path.join(EXPORT_DIR, jsonFilename);

    // Write JSON file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    this.logger.log(`JSON export completed: ${jsonFilename} (${fileSize} bytes)`);

    return {
      filePath: `/exports/${jsonFilename}`,
      fileSize,
    };
  }

  /**
   * Delete export
   */
  async deleteExport(exportId: string): Promise<void> {
    const exportData = this.exportCache.get(exportId);
    if (!exportData) {
      throw new BadRequestException('Export not found');
    }

    const filename = exportData.fileUrl.split('/').pop();
    if (!filename) {
      throw new BadRequestException('Invalid export file');
    }

    // Delete file based on format
    if (filename.endsWith('.csv')) {
      await this.csvExportService.deleteExport(filename);
    } else if (filename.endsWith('.xlsx')) {
      await this.excelExportService.deleteExport(filename);
    } else if (filename.endsWith('.pdf')) {
      await this.pdfExportService.deleteExport(filename);
    }

    this.exportCache.delete(exportId);
    this.logger.log(`Export deleted: ${exportId}`);
  }

  /**
   * List all exports
   */
  async listExports(): Promise<ExportResponseDto[]> {
    return Array.from(this.exportCache.values());
  }
}
