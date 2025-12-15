import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { FileStorageService } from './file-storage.service';
import { StartExportDto } from '../dto/import-export.dto';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly queueAvailable: boolean;

  constructor(
    @Optional() @InjectQueue('export') private exportQueue: Queue | null,
    private prisma: PrismaService,
    private fileStorage: FileStorageService,
  ) {
    this.queueAvailable = !!exportQueue;
    if (!this.queueAvailable) {
      this.logger.warn('⚠️ Export queue not available - background processing disabled');
    }
  }

  /**
   * Create export job
   */
  async createExport(dto: StartExportDto, userId: string) {
    this.logger.log(
      `Creating export job for user ${userId}, entity: ${dto.entityType}, format: ${dto.fileFormat}`,
    );

    try {
      // Get estimated record count
      const totalRecords = await this.getRecordCount(dto.entityType, dto.filters);

      if (totalRecords === 0) {
        throw new BadRequestException('No records found matching the export criteria');
      }

      // Calculate estimated time (rough estimate: 100 records per second)
      const estimatedSeconds = Math.ceil(totalRecords / 100);

      // Generate fileName
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `export-${dto.entityType.toLowerCase()}-${timestamp}.${dto.fileFormat.toLowerCase()}`;

      // Create export job in database
      const job = await this.prisma.importExportJob.create({
        data: {
          type: 'EXPORT',
          entityType: dto.entityType,
          fileFormat: dto.fileFormat,
          fileName,
          fileSize: 0, // Will be updated after export is complete
          status: 'QUEUED',
          priority: dto.priority || 'NORMAL',
          totalRecords,
          processedRecords: 0,
          successCount: 0,
          failureCount: 0,
          estimatedTimeMs: estimatedSeconds * 1000, // Convert to milliseconds
          filters: dto.filters || {},
          options: (dto.options as any) || {},
          createdBy: userId,
        },
      });

      // Queue job for background processing (if Redis available)
      if (this.queueAvailable && this.exportQueue) {
        await this.exportQueue.add(
          'process-export',
          {
            jobId: job.id,
            entityType: dto.entityType,
            fileFormat: dto.fileFormat,
            filters: dto.filters || {},
            options: dto.options || {},
            userId,
          },
          {
            priority: this.getPriorityValue(dto.priority),
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        );
        this.logger.log(`Export job ${job.id} created and queued successfully`);
      } else {
        // Redis not available - job will remain in QUEUED status
        this.logger.warn(`Export job ${job.id} created but cannot be processed - Redis queue not available`);
        this.logger.warn('Install Redis locally or enable cloud Redis for background job processing');
      }

      return {
        jobId: job.id,
        status: job.status,
        entityType: job.entityType,
        fileFormat: job.fileFormat,
        totalRecords: job.totalRecords,
        estimatedTime: job.estimatedTimeMs ? job.estimatedTimeMs / 1000 : null, // Convert back to seconds for API
        createdAt: job.createdAt,
      };
    } catch (error) {
      this.logger.error(`Failed to create export job: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get export job by ID
   */
  async getJob(jobId: string, userId: string) {
    const job = await this.prisma.importExportJob.findUnique({
      where: { id: jobId },
      include: {
        errors: {
          take: 100, // Limit to first 100 errors
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }

    if (job.createdBy !== userId) {
      throw new ForbiddenException('Access denied to this export job');
    }

    // Calculate progress percentage
    const progressPercent =
      job.totalRecords > 0 ? Math.round((job.processedRecords / job.totalRecords) * 100) : 0;

    return {
      ...job,
      progressPercent,
      downloadUrl: job.fileUrl,
    };
  }

  /**
   * List export jobs with pagination and filters
   */
  async listJobs(
    userId: string,
    filters: {
      entityType?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const { entityType, status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      createdBy: userId,
      type: 'EXPORT', // Only export jobs
    };

    if (entityType) {
      where.entityType = entityType;
    }

    if (status) {
      where.status = status;
    }

    const [jobs, total] = await Promise.all([
      this.prisma.importExportJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          entityType: true,
          fileFormat: true,
          status: true,
          fileName: true,
          fileUrl: true,
          totalRecords: true,
          processedRecords: true,
          successCount: true,
          failureCount: true,
          estimatedTimeMs: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.importExportJob.count({ where }),
    ]);

    // Add progress percentage to each job
    const jobsWithProgress = jobs.map(job => ({
      ...job,
      progressPercent:
        job.totalRecords > 0 ? Math.round((job.processedRecords / job.totalRecords) * 100) : 0,
    }));

    return {
      jobs: jobsWithProgress,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Cancel export job
   */
  async cancelJob(jobId: string, userId: string) {
    const job = await this.prisma.importExportJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }

    if (job.createdBy !== userId) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      throw new BadRequestException(`Cannot cancel job with status: ${job.status}`);
    }

    // Remove from Bull queue
    const bullJobs = await this.exportQueue.getJobs(['waiting', 'active', 'delayed']);
    const bullJob = bullJobs.find(j => j.data.jobId === jobId);
    if (bullJob) {
      await bullJob.remove();
    }

    // Update job status
    const updatedJob = await this.prisma.importExportJob.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    this.logger.log(`Export job ${jobId} cancelled successfully`);

    return updatedJob;
  }

  /**
   * Retry failed export job
   */
  async retryJob(jobId: string, userId: string) {
    const job = await this.prisma.importExportJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }

    if (job.createdBy !== userId) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }

    if (job.status !== 'FAILED') {
      throw new BadRequestException(`Can only retry failed jobs. Current status: ${job.status}`);
    }

    // Reset job counters
    const updatedJob = await this.prisma.importExportJob.update({
      where: { id: jobId },
      data: {
        status: 'QUEUED',
        processedRecords: 0,
        successCount: 0,
        failureCount: 0,
        startedAt: null,
        completedAt: null,
        // Note: errors is a relation, can't set to null directly. Will be handled separately if needed
      },
    });

    // Re-queue job
    await this.exportQueue.add(
      'process-export',
      {
        jobId: job.id,
        entityType: job.entityType,
        fileFormat: job.fileFormat,
        filters: job.filters || {},
        options: job.options || {},
        userId,
      },
      {
        priority: this.getPriorityValue(job.priority),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    this.logger.log(`Export job ${jobId} retried successfully`);

    return updatedJob;
  }

  /**
   * Download generated export file
   */
  async downloadFile(jobId: string, userId: string) {
    const job = await this.prisma.importExportJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }

    if (job.createdBy !== userId) {
      throw new ForbiddenException('Access denied to this export file');
    }

    if (job.status !== 'COMPLETED') {
      throw new BadRequestException(
        `Export job is not completed yet. Current status: ${job.status}`,
      );
    }

    if (!job.fileUrl) {
      throw new NotFoundException('Export file not found');
    }

    // Check if file exists
    const fileExists = await this.fileStorage.fileExists(job.fileUrl);
    if (!fileExists) {
      throw new NotFoundException('Export file has been deleted or expired');
    }

    // Download file from storage
    const fileBuffer = await this.fileStorage.downloadFile(job.fileUrl);

    return {
      buffer: fileBuffer,
      fileName: job.fileName,
      mimeType: this.getMimeType(job.fileFormat),
    };
  }

  /**
   * Get record count for entity type with filters
   */
  private async getRecordCount(entityType: string, filters?: Record<string, any>): Promise<number> {
    const where = this.buildWhereClause(filters);

    switch (entityType) {
      case 'PRODUCT':
        return this.prisma.product.count({ where });
      case 'USER':
        return this.prisma.user.count({ where });
      case 'ORDER':
        return this.prisma.order.count({ where });
      case 'CATEGORY':
        return this.prisma.category.count({ where });
      default:
        throw new BadRequestException(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters?: Record<string, any>): any {
    if (!filters || Object.keys(filters).length === 0) {
      return {};
    }

    const where: any = {};

    // Handle common filters
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
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

    // Add other custom filters directly
    Object.keys(filters).forEach(key => {
      if (!['status', 'isActive', 'startDate', 'endDate'].includes(key)) {
        where[key] = filters[key];
      }
    });

    return where;
  }

  /**
   * Get Bull priority value from string
   */
  private getPriorityValue(priority?: string): number {
    switch (priority) {
      case 'URGENT':
        return 1;
      case 'NORMAL':
        return 5;
      case 'LOW':
        return 10;
      default:
        return 5;
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
}
