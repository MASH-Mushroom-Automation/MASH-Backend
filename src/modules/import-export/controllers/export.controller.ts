import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Req,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportService } from '../services/export.service';
import { StartExportDto, GetJobsQueryDto } from '../dto/import-export.dto';

@ApiTags('Export')
@Controller('export')
// @UseGuards(AuthGuard) // Enable when authentication is ready
export class ExportController {
  private readonly logger = new Logger(ExportController.name);

  constructor(private readonly exportService: ExportService) {}

  /**
   * Create export job
   * POST /export/create
   */
  @Post('create')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Create export job',
    description:
      'Create a new export job to generate a file with filtered data from the database. The job is processed asynchronously in the background.',
  })
  @ApiBody({ type: StartExportDto })
  @ApiResponse({
    status: 202,
    description: 'Export job created successfully and queued for processing.',
    schema: {
      example: {
        jobId: 'cm123abc456def',
        status: 'QUEUED',
        entityType: 'PRODUCT',
        fileFormat: 'CSV',
        totalRecords: 1250,
        estimatedTime: 13,
        createdAt: '2025-10-25T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid entity type or filters',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createExport(@Body() dto: StartExportDto, @Req() req: any) {
    // TODO: Get userId from authentication guard (req.user.id)
    const userId = 'system-user-id'; // Temporary placeholder

    this.logger.log(`Creating export job for entity ${dto.entityType} in ${dto.fileFormat} format`);
    return this.exportService.createExport(dto, userId);
  }

  /**
   * Get export job status
   * GET /export/jobs/:jobId
   */
  @Get('jobs/:jobId')
  @ApiOperation({
    summary: 'Get export job status',
    description:
      'Retrieve detailed information about an export job including progress, status, and download URL when completed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Export job details retrieved successfully.',
    schema: {
      example: {
        id: 'cm123abc456def',
        type: 'EXPORT',
        entityType: 'PRODUCT',
        fileFormat: 'CSV',
        status: 'COMPLETED',
        fileName: 'export-product-2025-10-25T10-30-00-000Z.csv',
        fileUrl: 'http://localhost:3000/uploads/import-export/exports/...',
        fileSize: 524288,
        totalRecords: 1250,
        processedRecords: 1250,
        successCount: 1250,
        progressPercent: 100,
        startedAt: '2025-10-25T10:30:05.000Z',
        completedAt: '2025-10-25T10:30:18.000Z',
        createdAt: '2025-10-25T10:30:00.000Z',
        updatedAt: '2025-10-25T10:30:18.000Z',
        downloadUrl: 'http://localhost:3000/uploads/import-export/exports/...',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Export job not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getJob(@Param('jobId', ParseUUIDPipe) jobId: string, @Req() req: any) {
    const userId = 'system-user-id'; // TODO: Get from req.user.id
    return this.exportService.getJob(jobId, userId);
  }

  /**
   * List export jobs
   * GET /export/jobs
   */
  @Get('jobs')
  @ApiOperation({
    summary: 'List export jobs',
    description:
      'List all export jobs for the authenticated user with optional filtering and pagination.',
  })
  @ApiQuery({
    name: 'entityType',
    required: false,
    description: 'Filter by entity type',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Export jobs list retrieved successfully.',
    schema: {
      example: {
        jobs: [
          {
            id: 'cm123abc456def',
            entityType: 'PRODUCT',
            fileFormat: 'CSV',
            status: 'COMPLETED',
            fileName: 'export-product-2025-10-25T10-30-00-000Z.csv',
            fileUrl: 'http://localhost:3000/uploads/import-export/exports/...',
            totalRecords: 1250,
            processedRecords: 1250,
            progressPercent: 100,
            createdAt: '2025-10-25T10:30:00.000Z',
          },
        ],
        total: 15,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listJobs(@Query() query: GetJobsQueryDto, @Req() req: any) {
    const userId = 'system-user-id'; // TODO: Get from req.user.id
    return this.exportService.listJobs(userId, query);
  }

  /**
   * Cancel export job
   * POST /export/jobs/:jobId/cancel
   */
  @Post('jobs/:jobId/cancel')
  @ApiOperation({
    summary: 'Cancel export job',
    description:
      'Cancel a queued or processing export job. Cannot cancel completed or failed jobs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Export job cancelled successfully.',
    schema: {
      example: {
        id: 'cm123abc456def',
        status: 'CANCELLED',
        completedAt: '2025-10-25T10:35:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot cancel completed/failed job',
  })
  @ApiResponse({ status: 404, description: 'Export job not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async cancelJob(@Param('jobId', ParseUUIDPipe) jobId: string, @Req() req: any) {
    const userId = 'system-user-id'; // TODO: Get from req.user.id
    return this.exportService.cancelJob(jobId, userId);
  }

  /**
   * Retry failed export job
   * POST /export/jobs/:jobId/retry
   */
  @Post('jobs/:jobId/retry')
  @ApiOperation({
    summary: 'Retry failed export job',
    description: 'Re-queue a failed export job for processing. Resets all counters and status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Export job retried successfully.',
    schema: {
      example: {
        id: 'cm123abc456def',
        status: 'QUEUED',
        processedRecords: 0,
        successCount: 0,
        failureCount: 0,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - can only retry failed jobs',
  })
  @ApiResponse({ status: 404, description: 'Export job not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async retryJob(@Param('jobId', ParseUUIDPipe) jobId: string, @Req() req: any) {
    const userId = 'system-user-id'; // TODO: Get from req.user.id
    return this.exportService.retryJob(jobId, userId);
  }

  /**
   * Download export file
   * GET /export/jobs/:jobId/download
   */
  @Get('jobs/:jobId/download')
  @ApiOperation({
    summary: 'Download export file',
    description: 'Download the generated export file. Only available when job status is COMPLETED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Export file downloaded successfully.',
    content: {
      'text/csv': {},
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {},
      'application/json': {},
      'application/xml': {},
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - job not completed yet',
  })
  @ApiResponse({ status: 404, description: 'Export job or file not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async downloadFile(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Res() res: Response,
    @Req() req: any,
  ) {
    const userId = 'system-user-id'; // TODO: Get from req.user.id

    const { buffer, fileName, mimeType } = await this.exportService.downloadFile(jobId, userId);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);

    this.logger.log(`Downloading export file: ${fileName} (${buffer.length} bytes)`);
    res.send(buffer);
  }
}
