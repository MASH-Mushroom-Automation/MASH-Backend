/**
 * Import Processor
 *
 * Background processor for import jobs using Bull queue.
 * Processes import jobs asynchronously with batch database operations,
 * progress tracking, and error handling.
 */

import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import { FileStorageService } from '../services/file-storage.service';
import { FileParserFactory } from '../parsers/file-parser.factory';
import { ProductImportValidator } from '../validators/product-import.validator';
import { UserImportValidator } from '../validators/user-import.validator';
import { OrderImportValidator } from '../validators/order-import.validator';
import { ImportExportGateway } from '../gateways/import-export.gateway';
import { EntityType, JobStatus, FileFormat } from '@prisma/client';

interface ImportJobData {
  jobId: string;
  entityType: EntityType;
  fileKey: string;
  fileFormat: FileFormat;
  validRecordsCount: number;
  options: any;
}

interface ProcessingProgress {
  processedRecords: number;
  successCount: number;
  failureCount: number;
  warningCount: number;
  progressPercent: number;
  estimatedTimeMs: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
}

// 🔧 TEMPORARILY DISABLED - Processor causes conflicts with Bull auto-discovery
// Re-enable when QueuesModule is properly configured
// @Processor('import')
export class ImportProcessor {
  private readonly logger = new Logger(ImportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly fileStorage: FileStorageService,
    private readonly fileParserFactory: FileParserFactory,
    private readonly productValidator: ProductImportValidator,
    private readonly userValidator: UserImportValidator,
    private readonly orderValidator: OrderImportValidator,
    private readonly gateway: ImportExportGateway,
  ) {}

  @OnQueueActive()
  onActive(job: Job<ImportJobData>) {
    this.logger.log(`Processing job ${job.id} (Import: ${job.data.jobId})`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<ImportJobData>) {
    this.logger.log(`Job ${job.id} completed (Import: ${job.data.jobId})`);
  }

  @OnQueueFailed()
  onFailed(job: Job<ImportJobData>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed (Import: ${job.data.jobId}): ${error.message}`,
      error.stack,
    );
  }

  @Process('process-import')
  async processImport(job: Job<ImportJobData>): Promise<void> {
    const { jobId, entityType, fileKey, fileFormat, validRecordsCount, options } = job.data;
    const startTime = Date.now();

    this.logger.log(`Starting import job: ${jobId}`);

    try {
      // 1. Update job status to PROCESSING
      await this.updateJobStatus(jobId, JobStatus.PROCESSING, {
        startedAt: new Date(),
      });

      // 2. Download file from storage
      const fileBuffer = await this.fileStorage.downloadFile(fileKey);
      this.logger.log(`File downloaded: ${fileKey}`);

      // 3. Parse file
      const parser = this.fileParserFactory.getParser(fileFormat as any);
      const parseResult = await parser.parse(fileBuffer, options || {});

      if (!parseResult.success || !parseResult.data || parseResult.data.length === 0) {
        throw new Error('File parsing failed or file is empty');
      }

      const records = parseResult.data;
      this.logger.log(`Parsed ${records.length} records`);

      // 4. Get validator and transform data
      const validator = this.getValidator(entityType);
      const transformedRecords = await Promise.all(
        records.map(async record => {
          const transformed = validator.transformData(record);
          return validator.transformForDatabase(transformed);
        }),
      );

      // 5. Process records in batches
      const batchSize = options?.batchSize || 1000;
      const totalBatches = Math.ceil(transformedRecords.length / batchSize);
      let processedCount = 0;
      let successCount = 0;
      let failureCount = 0;
      const errors: Array<{ row: number; message: string }> = [];

      this.logger.log(`Processing ${totalBatches} batches of ${batchSize} records each`);

      for (let i = 0; i < totalBatches; i++) {
        const batchStart = i * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, transformedRecords.length);
        const batch = transformedRecords.slice(batchStart, batchEnd);

        this.logger.log(`Processing batch ${i + 1}/${totalBatches} (${batch.length} records)`);

        try {
          // 6. Insert batch into database
          const result = await this.insertBatch(entityType, batch, options);
          successCount += result.successCount;
          failureCount += result.failureCount;
          errors.push(...result.errors);

          processedCount += batch.length;

          // 7. Update progress
          const progressPercent = Math.round((processedCount / transformedRecords.length) * 100);
          const elapsedTime = Date.now() - startTime;
          const estimatedTotalTime = (elapsedTime / processedCount) * transformedRecords.length;
          const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime);

          await this.updateProgress(jobId, {
            processedRecords: processedCount,
            successCount,
            failureCount,
            warningCount: 0,
            progressPercent,
            estimatedTimeMs: estimatedTimeRemaining,
            errors: errors.slice(-10), // Keep last 10 errors
          });

          this.logger.log(
            `Batch ${i + 1} completed: ${result.successCount} success, ${result.failureCount} failed (${progressPercent}% total)`,
          );

          // 8. Small delay between batches to avoid overwhelming DB
          if (i < totalBatches - 1) {
            await this.delay(100);
          }
        } catch (error) {
          this.logger.error(`Batch ${i + 1} failed: ${error.message}`);
          failureCount += batch.length;
          errors.push({
            row: batchStart + 1,
            message: `Batch insert failed: ${error.message}`,
          });

          // Continue with next batch if skipInvalid is true
          if (!options?.skipInvalid) {
            throw error;
          }
        }
      }

      // 9. Complete job
      const duration = Date.now() - startTime;
      await this.updateJobStatus(jobId, JobStatus.COMPLETED, {
        completedAt: new Date(),
        processedRecords: processedCount,
        successCount,
        failureCount,
        progressPercent: 100,
        estimatedTimeMs: duration,
      });

      // 10. Store errors in database if any
      if (errors.length > 0) {
        await this.storeProcessingErrors(jobId, errors);
      }

      // 11. Emit completion event
      await this.gateway.emitJobCompleted({
        jobId,
        status: JobStatus.COMPLETED,
        processedRecords: processedCount,
        successCount,
        failureCount,
        warningCount: 0,
        duration,
      });

      // 12. Clean up progress tracking
      const progressKey = `import:progress:${jobId}`;
      await this.redis.delete(progressKey);

      this.logger.log(
        `Import job ${jobId} completed: ${successCount} success, ${failureCount} failed in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error(`Import job ${jobId} failed: ${error.message}`, error.stack);

      // Mark job as failed
      await this.updateJobStatus(jobId, JobStatus.FAILED, {
        completedAt: new Date(),
        progressPercent: 0,
      });

      // Store fatal error
      await this.storeProcessingErrors(jobId, [
        {
          row: 0,
          message: `Fatal error: ${error.message}`,
        },
      ]);

      // Emit failure event
      await this.gateway.emitJobFailed({
        jobId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Insert batch of records into database
   */
  private async insertBatch(
    entityType: EntityType,
    batch: any[],
    options: any,
  ): Promise<{
    successCount: number;
    failureCount: number;
    errors: Array<{ row: number; message: string }>;
  }> {
    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ row: number; message: string }> = [];

    try {
      // Get entity model
      const model = this.getEntityModel(entityType);

      // Try bulk insert
      try {
        const result = await model.createMany({
          data: batch,
          skipDuplicates: options?.skipInvalid || false,
        });

        successCount = result.count;
        this.logger.log(`Bulk insert succeeded: ${successCount} records`);
      } catch (bulkError) {
        this.logger.warn(
          `Bulk insert failed: ${bulkError.message}, falling back to individual inserts`,
        );

        // Fallback to individual inserts if bulk fails
        for (let i = 0; i < batch.length; i++) {
          try {
            await model.create({ data: batch[i] });
            successCount++;
          } catch (individualError) {
            failureCount++;
            errors.push({
              row: i + 1,
              message: individualError.message,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(`Batch insert failed: ${error.message}`);
      failureCount = batch.length;
      errors.push({
        row: 0,
        message: `Batch insert failed: ${error.message}`,
      });
    }

    return { successCount, failureCount, errors };
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    additionalData?: Partial<any>,
  ): Promise<void> {
    await this.prisma.importExportJob.update({
      where: { id: jobId },
      data: {
        status,
        ...additionalData,
      },
    });
  }

  /**
   * Update job progress in Redis and database
   */
  private async updateProgress(jobId: string, progress: ProcessingProgress): Promise<void> {
    // Store in Redis for real-time access
    await this.redis.set(
      `import:progress:${jobId}`,
      JSON.stringify(progress),
      3600, // 1 hour TTL
    );

    // Update in database
    await this.prisma.importExportJob.update({
      where: { id: jobId },
      data: {
        processedRecords: progress.processedRecords,
        successCount: progress.successCount,
        failureCount: progress.failureCount,
        warningCount: progress.warningCount,
        progressPercent: progress.progressPercent,
        estimatedTimeMs: progress.estimatedTimeMs,
      },
    });

    // Emit WebSocket progress event
    const job = await this.prisma.importExportJob.findUnique({
      where: { id: jobId },
      select: { totalRecords: true },
    });

    if (job) {
      await this.gateway.emitJobProgress({
        jobId,
        processedRecords: progress.processedRecords,
        totalRecords: job.totalRecords,
        successCount: progress.successCount,
        failureCount: progress.failureCount,
        warningCount: progress.warningCount,
        progressPercent: progress.progressPercent,
        estimatedTimeMs: progress.estimatedTimeMs,
        errors: progress.errors,
      });
    }
  }

  /**
   * Store processing errors in database
   */
  private async storeProcessingErrors(
    jobId: string,
    errors: Array<{ row: number; message: string }>,
  ): Promise<void> {
    const errorRecords = errors.map(error => ({
      jobId,
      rowNumber: error.row,
      columnName: null,
      fieldPath: null,
      errorType: 'CONSTRAINT' as any,
      severity: 'ERROR' as any,
      errorCode: 'PROCESSING_ERROR',
      message: error.message,
      suggestion: 'Check data format and database constraints',
      originalValue: null,
      expectedFormat: null,
    }));

    await this.prisma.importExportError.createMany({
      data: errorRecords,
      skipDuplicates: true,
    });

    this.logger.log(`Stored ${errorRecords.length} processing errors for job ${jobId}`);
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
        throw new Error(`Validator not implemented for entity type: ${entityType}`);
    }
  }

  /**
   * Get Prisma entity model by type
   */
  private getEntityModel(entityType: EntityType): any {
    switch (entityType) {
      case EntityType.PRODUCT:
        return this.prisma.product;
      case EntityType.USER:
        return this.prisma.user;
      case EntityType.ORDER:
        return this.prisma.order;
      default:
        throw new Error(`Entity model not found for type: ${entityType}`);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
