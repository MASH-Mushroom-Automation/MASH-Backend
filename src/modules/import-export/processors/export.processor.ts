import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import { FileStorageService } from '../services/file-storage.service';
import { FileParserFactory } from '../parsers/file-parser.factory';
import { ImportExportGateway } from '../gateways/import-export.gateway';

@Processor('export')
export class ExportProcessor {
  private readonly logger = new Logger(ExportProcessor.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private fileStorage: FileStorageService,
    private fileParserFactory: FileParserFactory,
    private gateway: ImportExportGateway,
  ) {}

  @Process('process-export')
  async handleExport(job: Job) {
    const { jobId, entityType, fileFormat, filters, options } = job.data;

    this.logger.log(`Processing export job ${jobId} for entity ${entityType} in ${fileFormat} format`);

    try {
      // Update job status to PROCESSING
      await this.prisma.importExportJob.update({
        where: { id: jobId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });

      // Emit WebSocket event
      await this.gateway.emitJobProgress({
        jobId,
        processedRecords: 0,
        totalRecords: 0,
        successCount: 0,
        failureCount: 0,
        warningCount: 0,
        progressPercent: 0,
        estimatedTimeMs: 0,
      });

      // Fetch records from database
      const records = await this.fetchRecords(entityType, filters);

      if (records.length === 0) {
        throw new Error('No records found matching the export criteria');
      }

      // Update total records count
      await this.prisma.importExportJob.update({
        where: { id: jobId },
        data: { totalRecords: records.length },
      });

      // Transform records for export
      const transformedRecords = this.transformRecordsForExport(records, entityType);

      // Generate file using appropriate parser
      const parser = this.fileParserFactory.getParser(fileFormat);
      const fileBuffer = await this.generateFile(parser, transformedRecords, options, fileFormat);

      // Generate file name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = this.getFileExtension(fileFormat);
      const fileName = `export-${entityType.toLowerCase()}-${timestamp}.${extension}`;

      // Upload file to storage
      const { url } = await this.fileStorage.uploadFile(
        {
          buffer: fileBuffer,
          originalname: fileName,
          mimetype: this.getMimeType(fileFormat),
        } as any,
        'exports',
      );

      // Update job as completed
      await this.prisma.importExportJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          fileName,
          resultFileUrl: url,
          fileSize: fileBuffer.length,
          processedRecords: records.length,
          successCount: records.length,
          completedAt: new Date(),
        },
      });

      // Emit completion event
      await this.gateway.emitJobCompleted({
        jobId,
        status: 'COMPLETED',
        processedRecords: records.length,
        successCount: records.length,
        failureCount: 0,
        warningCount: 0,
        duration: Date.now() - job.timestamp,
      });

      // Clean up progress tracking in Redis
      await this.redis.delete(`export:progress:${jobId}`);

      this.logger.log(`Export job ${jobId} completed successfully. Generated file: ${fileName}`);
    } catch (error) {
      this.logger.error(`Export job ${jobId} failed: ${error.message}`, error.stack);

      // Update job as failed
      await this.prisma.importExportJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });

      // Emit failure event
      await this.gateway.emitJobFailed({
        jobId,
        error: error.message,
      });

      // Clean up progress tracking
      await this.redis.delete(`export:progress:${jobId}`);

      throw error;
    }
  }

  /**
   * Fetch records from database based on entity type and filters
   */
  private async fetchRecords(entityType: string, filters: Record<string, any>): Promise<any[]> {
    const where = this.buildWhereClause(filters);

    switch (entityType) {
      case 'PRODUCT':
        return this.prisma.product.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        });

      case 'USER':
        return this.prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            clerkId: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            phoneNumber: true,
            role: true,
            isActive: true,
            twoFactorEnabled: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

      case 'ORDER':
        return this.prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            orderItems: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    price: true,
                  },
                },
              },
            },
          },
        });

      case 'CATEGORY':
        return this.prisma.category.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        });

      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Transform records for export (flatten nested objects, format dates, etc.)
   */
  private transformRecordsForExport(records: any[], entityType: string): any[] {
    return records.map((record) => {
      const transformed: any = { ...record };

      // Format dates to ISO string
      Object.keys(transformed).forEach((key) => {
        if (transformed[key] instanceof Date) {
          transformed[key] = transformed[key].toISOString();
        }

        // Stringify JSON fields
        if (typeof transformed[key] === 'object' && transformed[key] !== null && !(transformed[key] instanceof Date)) {
          // For nested objects (like order items), flatten or stringify
          if (Array.isArray(transformed[key])) {
            transformed[key] = JSON.stringify(transformed[key]);
          } else {
            // Flatten nested objects for CSV/Excel compatibility
            transformed[key] = JSON.stringify(transformed[key]);
          }
        }
      });

      // Entity-specific transformations
      if (entityType === 'ORDER' && record.user) {
        transformed.userEmail = record.user.email;
        transformed.userName = `${record.user.firstName || ''} ${record.user.lastName || ''}`.trim();
        delete transformed.user;
      }

      return transformed;
    });
  }

  /**
   * Generate file using appropriate parser
   */
  private async generateFile(
    parser: any,
    records: any[],
    options: any,
    fileFormat: string,
  ): Promise<Buffer> {
    switch (fileFormat) {
      case 'CSV':
        return Buffer.from(
          parser.generate(records, {
            delimiter: options.delimiter || ',',
            includeHeaders: options.includeHeaders !== false,
          }),
        );

      case 'EXCEL':
        return parser.generate(records, {
          sheetName: options.sheetName || 'Sheet1',
          includeHeaders: options.includeHeaders !== false,
        });

      case 'JSON':
        return Buffer.from(
          parser.generate(records, {
            prettyPrint: options.prettyPrint !== false,
            wrapInArray: true,
          }),
        );

      case 'XML':
        return Buffer.from(
          parser.generate(records, {
            rootElement: options.rootElement || 'records',
            itemElement: options.itemElement || 'record',
            prettyPrint: options.prettyPrint !== false,
          }),
        );

      default:
        throw new Error(`Unsupported file format: ${fileFormat}`);
    }
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters: Record<string, any>): any {
    if (!filters || Object.keys(filters).length === 0) {
      return {};
    }

    const where: any = {};

    // Handle common filters
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true' || filters.isActive === true;
    }

    if (filters.isFeatured !== undefined) {
      where.isFeatured = filters.isFeatured === 'true' || filters.isFeatured === true;
    }

    // Date range filters
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    // Search filters (for text fields)
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Price range filters (for products)
    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) {
        where.price.gte = parseFloat(filters.minPrice);
      }
      if (filters.maxPrice) {
        where.price.lte = parseFloat(filters.maxPrice);
      }
    }

    // Category filter (for products)
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    // Role filter (for users)
    if (filters.role) {
      where.role = filters.role;
    }

    // Add other custom filters directly
    const excludeKeys = ['status', 'isActive', 'isFeatured', 'startDate', 'endDate', 'search', 'minPrice', 'maxPrice', 'categoryId', 'role'];
    Object.keys(filters).forEach((key) => {
      if (!excludeKeys.includes(key) && filters[key] !== undefined) {
        where[key] = filters[key];
      }
    });

    return where;
  }

  /**
   * Get file extension for format
   */
  private getFileExtension(format: string): string {
    switch (format) {
      case 'CSV':
        return 'csv';
      case 'EXCEL':
        return 'xlsx';
      case 'JSON':
        return 'json';
      case 'XML':
        return 'xml';
      default:
        return 'txt';
    }
  }

  /**
   * Get MIME type for file format
   */
  private getMimeType(format: string): string {
    switch (format) {
      case 'CSV':
        return 'text/csv';
      case 'EXCEL':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'JSON':
        return 'application/json';
      case 'XML':
        return 'application/xml';
      default:
        return 'application/octet-stream';
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onComplete(job: Job) {
    this.logger.log(`Completed job ${job.id} of type ${job.name}`);
  }

  @OnQueueFailed()
  onError(job: Job, error: Error) {
    this.logger.error(`Failed job ${job.id} of type ${job.name}: ${error.message}`, error.stack);
  }
}
