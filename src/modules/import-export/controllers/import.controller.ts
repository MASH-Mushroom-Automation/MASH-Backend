/**
 * Import Controller
 * 
 * REST API endpoints for importing data from files.
 * Handles file uploads, job management, and error reporting.
 */

import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
  ValidationPipe,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { ImportService } from '../services/import.service';
import { StartImportDto } from '../dto/import-export.dto';
import { EntityType, JobStatus } from '@prisma/client';

@ApiTags('Import')
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /**
   * Upload file for import
   */
  @Post('upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload file for import',
    description: 'Upload a file (CSV, Excel, JSON, XML) to import data. The file will be validated and queued for processing.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'entityType'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (CSV, XLSX, XLS, JSON, XML)',
        },
        entityType: {
          type: 'string',
          enum: Object.values(EntityType),
          description: 'Type of entity to import',
        },
        priority: {
          type: 'string',
          enum: ['URGENT', 'NORMAL', 'LOW'],
          description: 'Job priority',
          default: 'NORMAL',
        },
        skipInvalid: {
          type: 'boolean',
          description: 'Skip invalid records and continue processing',
          default: false,
        },
        batchSize: {
          type: 'number',
          description: 'Batch size for processing',
          default: 1000,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'File uploaded successfully and queued for processing',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', format: 'uuid' },
        status: { type: 'string', enum: Object.values(JobStatus) },
        fileName: { type: 'string' },
        fileSize: { type: 'number' },
        totalRecords: { type: 'number' },
        validRecords: { type: 'number' },
        invalidRecords: { type: 'number' },
        preview: {
          type: 'array',
          items: { type: 'object' },
        },
        estimatedTime: { type: 'number', description: 'Estimated time in milliseconds' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file format or validation failed',
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body(ValidationPipe) dto: StartImportDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 'system';
    
    // Transform Express.Multer.File to UploadedFileInfo
    const fileInfo = {
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      buffer: file.buffer,
    };
    
    return this.importService.uploadFile(fileInfo, dto, userId);
  }

  /**
   * Get job details
   */
  @Get('jobs/:jobId')
  @ApiOperation({
    summary: 'Get job details',
    description: 'Retrieve detailed information about an import job including status and errors',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        entityType: { type: 'string', enum: Object.values(EntityType) },
        status: { type: 'string', enum: Object.values(JobStatus) },
        fileName: { type: 'string' },
        fileSize: { type: 'number' },
        totalRecords: { type: 'number' },
        processedRecords: { type: 'number' },
        successCount: { type: 'number' },
        failureCount: { type: 'number' },
        warningCount: { type: 'number' },
        progressPercent: { type: 'number' },
        estimatedTimeMs: { type: 'number' },
        createdAt: { type: 'string', format: 'date-time' },
        startedAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'number' },
              column: { type: 'string' },
              field: { type: 'string' },
              errorType: { type: 'string' },
              severity: { type: 'string' },
              errorCode: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  async getJob(@Param('jobId', ParseUUIDPipe) jobId: string, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.importService.getJob(jobId, userId);
  }

  /**
   * List jobs
   */
  @Get('jobs')
  @ApiOperation({
    summary: 'List import jobs',
    description: 'Retrieve a paginated list of import jobs with optional filters',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Jobs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        jobs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              entityType: { type: 'string', enum: Object.values(EntityType) },
              status: { type: 'string', enum: Object.values(JobStatus) },
              fileName: { type: 'string' },
              totalRecords: { type: 'number' },
              processedRecords: { type: 'number' },
              successCount: { type: 'number' },
              failureCount: { type: 'number' },
              progressPercent: { type: 'number' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async listJobs(
    @Query('entityType') entityType?: EntityType,
    @Query('status') status?: JobStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id || 'system';
    return this.importService.listJobs(userId, {
      entityType,
      status,
      page: page ? parseInt(page.toString(), 10) : undefined,
      limit: limit ? parseInt(limit.toString(), 10) : undefined,
    });
  }

  /**
   * Cancel job
   */
  @Post('jobs/:jobId/cancel')
  @ApiOperation({
    summary: 'Cancel import job',
    description: 'Cancel a pending or processing import job',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job cancelled successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Job cannot be cancelled (already completed or failed)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  async cancelJob(@Param('jobId', ParseUUIDPipe) jobId: string, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.importService.cancelJob(jobId, userId);
  }

  /**
   * Retry failed job
   */
  @Post('jobs/:jobId/retry')
  @ApiOperation({
    summary: 'Retry failed import job',
    description: 'Retry a failed import job',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job queued for retry successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Job cannot be retried (not in failed state)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  async retryJob(@Param('jobId', ParseUUIDPipe) jobId: string, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.importService.retryJob(jobId, userId);
  }

  /**
   * Download error report
   */
  @Get('jobs/:jobId/errors/download')
  @ApiOperation({
    summary: 'Download error report',
    description: 'Download a CSV or JSON file containing all errors for a job',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Error report downloaded successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found or no errors',
  })
  async downloadErrors(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Res() res: Response,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 'system';
    const job = await this.importService.getJob(jobId, userId);

    if (!job || !job.errors || job.errors.length === 0) {
      res.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No errors found for this job',
      });
      return;
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=errors-${jobId}.json`);
      res.send(JSON.stringify(job.errors, null, 2));
    } else {
      // CSV format
      const headers = ['Row', 'Column', 'Field', 'Error Type', 'Severity', 'Code', 'Message', 'Suggestion'];
      const csvRows = [
        headers.join(','),
        ...job.errors.map((error) =>
          [
            error.row,
            error.column || '',
            error.field || '',
            error.errorType || '',
            error.severity,
            error.errorCode || '',
            `"${error.message.replace(/"/g, '""')}"`,
            `"${error.suggestion?.replace(/"/g, '""') || ''}"`,
          ].join(','),
        ),
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=errors-${jobId}.csv`);
      res.send(csvRows.join('\n'));
    }
  }
}
