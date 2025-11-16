/**
 * Import Service
 *
 * Handles file upload, parsing, validation, and job creation for import operations.
 * Creates import jobs and queues them for background processing.
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bull';
import { PrismaService } from '../../../database/prisma.service';
import { FileStorageService } from './file-storage.service';
import { ValidationService } from './validation.service';
import { FileParserFactory } from '../parsers/file-parser.factory';
import { ProductImportValidator } from '../validators/product-import.validator';
import { UserImportValidator } from '../validators/user-import.validator';
import { OrderImportValidator } from '../validators/order-import.validator';
import { FileFormat, EntityType, JobType, JobStatus, JobPriority } from '@prisma/client';
import { StartImportDto } from '../dto/import-export.dto';

export interface UploadedFileInfo {
  originalName: string;
  size: number;
  mimeType: string;
  buffer: Buffer;
}

export interface ImportJobResult {
  jobId: string;
  status: JobStatus;
  entityType: EntityType;
  fileFormat: FileFormat;
  fileName: string;
  fileUrl: string;
  totalRecords: number;
  previewData: any[];
  validationSummary: {
    validRecords: number;
    invalidRecords: number;
    warningRecords: number;
    errors: number;
    warnings: number;
  };
  estimatedTimeMs: number;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    @InjectQueue('import') private importQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
    private readonly validationService: ValidationService,
    private readonly fileParserFactory: FileParserFactory,
    private readonly productValidator: ProductImportValidator,
    private readonly userValidator: UserImportValidator,
    private readonly orderValidator: OrderImportValidator,
  ) {}

  /**
   * Upload and process import file
   */
  async uploadFile(
    file: UploadedFileInfo,
    dto: StartImportDto,
    userId: string,
  ): Promise<ImportJobResult> {
    this.logger.log(`Starting import for entity: ${dto.entityType}, format: ${dto.fileFormat}`);

    const startTime = Date.now();

    try {
      // 1. Validate file
      this.validateFile(file);

      // 2. Store file
      const { url: fileUrl, key: fileKey } = await this.fileStorage.uploadFile(
        {
          originalname: file.originalName,
          buffer: file.buffer,
          size: file.size,
          mimetype: file.mimeType,
        } as any,
        'imports',
      );

      this.logger.log(`File uploaded: ${fileKey}`);

      // 3. Parse file
      const parser = this.fileParserFactory.getParser(dto.fileFormat);
      const parseResult = await parser.parse(file.buffer, dto.options || {});

      if (!parseResult.success || !parseResult.data || parseResult.data.length === 0) {
        throw new BadRequestException(parseResult.error || 'File is empty or invalid');
      }

      this.logger.log(`File parsed: ${parseResult.data.length} records found`);

      // 4. Get validator for entity type
      const validator = this.getValidator(dto.entityType);
      const rules = validator.getRules();

      // 5. Transform data
      const transformedData = parseResult.data.map(record => validator.transformData(record));

      // 6. Validate data
      const validationResult = await this.validationService.validateBatch(transformedData, rules, {
        validateUnique: dto.options?.validateData ?? true,
        validateForeignKeys: dto.options?.validateData ?? true,
        skipInvalid: dto.options?.skipInvalid ?? false,
        maxErrors: 100,
      });

      this.logger.log(
        `Validation completed: ${validationResult.validRecords} valid, ${validationResult.invalidRecords} invalid`,
      );

      // 7. Create import job in database
      const job = await this.prisma.importExportJob.create({
        data: {
          type: JobType.IMPORT,
          entityType: dto.entityType,
          fileFormat: dto.fileFormat,
          status: JobStatus.QUEUED,
          priority: dto.priority || JobPriority.NORMAL,
          fileName: file.originalName,
          fileUrl,
          fileSize: file.size,
          totalRecords: parseResult.data.length,
          processedRecords: 0,
          successCount: 0,
          failureCount: 0,
          warningCount: 0,
          progressPercent: 0,
          options: (dto.options as any) || {},
          createdBy: userId,
        },
      });

      this.logger.log(`Import job created: ${job.id}`);

      // 8. Store validation errors in database
      if (validationResult.errors.length > 0 || validationResult.warnings.length > 0) {
        await this.storeValidationErrors(job.id, [
          ...validationResult.errors,
          ...validationResult.warnings,
        ]);
      }

      // 9. Queue job for background processing
      await this.importQueue.add(
        'process-import',
        {
          jobId: job.id,
          entityType: dto.entityType,
          fileKey,
          fileFormat: dto.fileFormat,
          validRecordsCount: validationResult.validRecords,
          options: dto.options,
        },
        {
          priority: this.getPriority(dto.priority),
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );

      this.logger.log(`Job queued for processing: ${job.id}`);

      // 10. Calculate estimated time (based on 1000 records/30s = ~30ms per record)
      const estimatedTimeMs = validationResult.validRecords * 30;

      // 11. Return job result with preview
      return {
        jobId: job.id,
        status: job.status,
        entityType: job.entityType,
        fileFormat: job.fileFormat,
        fileName: job.fileName,
        fileUrl: job.fileUrl,
        totalRecords: job.totalRecords,
        previewData: transformedData.slice(0, 10), // First 10 records
        validationSummary: {
          validRecords: validationResult.validRecords,
          invalidRecords: validationResult.invalidRecords,
          warningRecords: validationResult.warningRecords,
          errors: validationResult.errors.length,
          warnings: validationResult.warnings.length,
        },
        estimatedTimeMs,
      };
    } catch (error) {
      this.logger.error(`Import upload failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get import job by ID
   */
  async getJob(jobId: string, userId: string): Promise<any> {
    const job = await this.prisma.importExportJob.findUnique({
      where: { id: jobId },
      include: {
        errors: {
          take: 100,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!job) {
      throw new BadRequestException(`Job ${jobId} not found`);
    }

    // Check ownership (optional - remove if admin can view all jobs)
    if (job.createdBy !== userId) {
      throw new BadRequestException('Unauthorized to view this job');
    }

    return {
      id: job.id,
      type: job.type,
      entityType: job.entityType,
      fileFormat: job.fileFormat,
      status: job.status,
      fileName: job.fileName,
      fileUrl: job.fileUrl,
      totalRecords: job.totalRecords,
      processedRecords: job.processedRecords,
      successCount: job.successCount,
      failureCount: job.failureCount,
      warningCount: job.warningCount,
      progressPercent: job.progressPercent,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      estimatedTimeMs: job.estimatedTimeMs,
      errors: job.errors.map(e => ({
        row: e.rowNumber,
        column: e.columnName,
        type: e.errorType,
        severity: e.severity,
        code: e.errorCode,
        message: e.message,
        suggestion: e.suggestion,
      })),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  /**
   * List import jobs
   */
  async listJobs(
    userId: string,
    filters: {
      entityType?: EntityType;
      status?: JobStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<any> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      type: JobType.IMPORT,
      createdBy: userId,
    };

    if (filters.entityType) {
      where.entityType = filters.entityType;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const [jobs, total] = await Promise.all([
      this.prisma.importExportJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          entityType: true,
          fileFormat: true,
          status: true,
          fileName: true,
          totalRecords: true,
          processedRecords: true,
          successCount: true,
          failureCount: true,
          warningCount: true,
          progressPercent: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.importExportJob.count({ where }),
    ]);

    return {
      data: jobs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Cancel import job
   */
  async cancelJob(jobId: string, userId: string): Promise<void> {
    const job = await this.prisma.importExportJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new BadRequestException(`Job ${jobId} not found`);
    }

    if (job.createdBy !== userId) {
      throw new BadRequestException('Unauthorized to cancel this job');
    }

    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
      throw new BadRequestException('Cannot cancel completed or failed job');
    }

    // Remove from queue
    const bullJobs = await this.importQueue.getJobs(['waiting', 'active', 'delayed']);
    const bullJob = bullJobs.find(j => j.data.jobId === jobId);

    if (bullJob) {
      await bullJob.remove();
      this.logger.log(`Removed job ${jobId} from queue`);
    }

    // Update status in database
    await this.prisma.importExportJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    this.logger.log(`Job ${jobId} cancelled`);
  }

  /**
   * Retry failed import job
   */
  async retryJob(jobId: string, userId: string): Promise<{ jobId: string }> {
    const job = await this.prisma.importExportJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new BadRequestException(`Job ${jobId} not found`);
    }

    if (job.createdBy !== userId) {
      throw new BadRequestException('Unauthorized to retry this job');
    }

    if (job.status !== JobStatus.FAILED) {
      throw new BadRequestException('Can only retry failed jobs');
    }

    // Reset job status
    await this.prisma.importExportJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.QUEUED,
        processedRecords: 0,
        successCount: 0,
        failureCount: 0,
        warningCount: 0,
        progressPercent: 0,
        startedAt: null,
        completedAt: null,
      },
    });

    // Re-queue job
    await this.importQueue.add(
      'process-import',
      {
        jobId: job.id,
        entityType: job.entityType,
        fileKey: job.fileUrl.split('/').pop(),
        fileFormat: job.fileFormat,
        validRecordsCount: job.totalRecords - job.failureCount,
        options: job.options,
      },
      {
        priority: this.getPriority(job.priority),
        attempts: 3,
      },
    );

    this.logger.log(`Job ${jobId} retried`);

    return { jobId: job.id };
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: UploadedFileInfo): void {
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '52428800'); // 50MB default

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.size > maxSize) {
      throw new BadRequestException(`File too large. Max size: ${maxSize / 1024 / 1024}MB`);
    }

    if (!file.originalName) {
      throw new BadRequestException('File name is required');
    }
  }

  /**
   * Get validator for entity type
   */
  private getValidator(entityType: EntityType): any {
    switch (entityType) {
      case EntityType.PRODUCT:
        return this.productValidator;
      case EntityType.USER:
        return this.userValidator;
      case EntityType.ORDER:
        return this.orderValidator;
      default:
        throw new BadRequestException(`Validator not implemented for entity type: ${entityType}`);
    }
  }

  /**
   * Store validation errors in database
   */
  private async storeValidationErrors(jobId: string, errors: any[]): Promise<void> {
    const errorRecords = errors.map(error => ({
      jobId,
      rowNumber: error.row,
      columnName: error.column || error.field,
      fieldPath: error.field,
      errorType: error.type,
      severity: error.severity,
      errorCode: error.code,
      message: error.message,
      suggestion: error.suggestion,
      originalValue: error.originalValue ? String(error.originalValue) : null,
      expectedFormat: error.expectedFormat,
    }));

    await this.prisma.importExportError.createMany({
      data: errorRecords,
      skipDuplicates: true,
    });

    this.logger.log(`Stored ${errorRecords.length} validation errors for job ${jobId}`);
  }

  /**
   * Get Bull priority from JobPriority enum
   */
  private getPriority(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.URGENT:
        return 1;
      case JobPriority.NORMAL:
        return 5;
      case JobPriority.LOW:
        return 10;
      default:
        return 5;
    }
  }
}
