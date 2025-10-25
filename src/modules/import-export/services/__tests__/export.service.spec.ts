import { Test, TestingModule } from '@nestjs/testing';
import { ExportService } from '../export.service';
import { PrismaService } from '../../../../database/prisma.service';
import { RedisService } from '../../../../database/redis.service';
import { Queue } from 'bull';
import { getQueueToken } from '@nestjs/bull';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileFormat, EntityType, JobPriority } from '@prisma/client';

describe('ExportService', () => {
  let service: ExportService;
  let prisma: PrismaService;
  let redis: RedisService;
  let exportQueue: Queue;

  const mockPrismaService = {
    product: {
      count: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
    category: {
      count: jest.fn(),
    },
    importExportJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };

  const mockExportQueue = {
    add: jest.fn(),
    removeJobs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: getQueueToken('export'),
          useValue: mockExportQueue,
        },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    exportQueue = module.get<Queue>(getQueueToken('export'));

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createExport', () => {
    const userId = 'user123';
    const createExportDto = {
      entityType: EntityType.PRODUCT,
      fileFormat: FileFormat.CSV,
      priority: JobPriority.NORMAL,
      filters: { isActive: true },
      options: { delimiter: ',' },
    };

    it('should create export job with valid data', async () => {
      const totalRecords = 100;
      const mockJob = {
        id: 'job123',
        type: 'EXPORT',
        entityType: EntityType.PRODUCT,
        fileFormat: FileFormat.CSV,
        status: 'QUEUED',
        totalRecords,
        estimatedTime: 1,
        createdAt: new Date(),
      };

      mockPrismaService.product.count.mockResolvedValue(totalRecords);
      mockPrismaService.importExportJob.create.mockResolvedValue(mockJob);
      mockExportQueue.add.mockResolvedValue({ id: 'bull-job-123' });

      const result = await service.createExport(createExportDto, userId);

      expect(result).toEqual(mockJob);
      expect(mockPrismaService.product.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(mockPrismaService.importExportJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'EXPORT',
          entityType: EntityType.PRODUCT,
          fileFormat: FileFormat.CSV,
          status: 'QUEUED',
          createdBy: userId,
          totalRecords,
        }),
      });
      expect(mockExportQueue.add).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid filters', async () => {
      const invalidDto = {
        ...createExportDto,
        filters: { invalidField: [1, 2, 3] }, // Array not allowed in filters
      };

      await expect(service.createExport(invalidDto, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle different entity types', async () => {
      mockPrismaService.user.count.mockResolvedValue(50);
      mockPrismaService.importExportJob.create.mockResolvedValue({
        id: 'job456',
        entityType: EntityType.USER,
      });

      const userDto = { ...createExportDto, entityType: EntityType.USER };
      await service.createExport(userDto, userId);

      expect(mockPrismaService.user.count).toHaveBeenCalled();
    });

    it('should handle priority levels', async () => {
      mockPrismaService.product.count.mockResolvedValue(100);
      mockPrismaService.importExportJob.create.mockResolvedValue({
        id: 'job789',
      });

      const urgentDto = {
        ...createExportDto,
        priority: JobPriority.URGENT,
      };
      await service.createExport(urgentDto, userId);

      expect(mockExportQueue.add).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ priority: 1 }),
      );
    });
  });

  describe('getExport', () => {
    const jobId = 'job123';
    const userId = 'user123';

    it('should return export job by id', async () => {
      const mockJob = {
        id: jobId,
        type: 'EXPORT',
        entityType: EntityType.PRODUCT,
        status: 'COMPLETED',
        createdBy: userId,
        totalRecords: 100,
        processedRecords: 100,
        errors: [],
      };

      mockPrismaService.importExportJob.findUnique.mockResolvedValue(mockJob);

      const result = await service.getExport(jobId, userId);

      expect(result).toEqual({
        ...mockJob,
        progressPercent: 100,
      });
      expect(mockPrismaService.importExportJob.findUnique).toHaveBeenCalledWith(
        {
          where: { id: jobId },
          include: {
            errors: {
              take: 100,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      );
    });

    it('should throw NotFoundException if job not found', async () => {
      mockPrismaService.importExportJob.findUnique.mockResolvedValue(null);

      await expect(service.getExport(jobId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own job', async () => {
      const mockJob = {
        id: jobId,
        createdBy: 'otherUser',
      };

      mockPrismaService.importExportJob.findUnique.mockResolvedValue(mockJob);

      await expect(service.getExport(jobId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should calculate progress percentage correctly', async () => {
      const mockJob = {
        id: jobId,
        createdBy: userId,
        totalRecords: 200,
        processedRecords: 50,
      };

      mockPrismaService.importExportJob.findUnique.mockResolvedValue(mockJob);

      const result = await service.getExport(jobId, userId);

      expect(result.progressPercent).toBe(25);
    });
  });

  describe('listExports', () => {
    const userId = 'user123';

    it('should list exports with pagination', async () => {
      const mockJobs = [
        { id: 'job1', entityType: EntityType.PRODUCT },
        { id: 'job2', entityType: EntityType.USER },
      ];

      mockPrismaService.importExportJob.findMany.mockResolvedValue(mockJobs);
      mockPrismaService.importExportJob.count.mockResolvedValue(2);

      const result = await service.listExports(
        { page: 1, limit: 10 },
        userId,
      );

      expect(result).toEqual({
        jobs: mockJobs,
        total: 2,
        page: 1,
        limit: 10,
        pages: 1,
      });
    });

    it('should filter by entity type', async () => {
      mockPrismaService.importExportJob.findMany.mockResolvedValue([]);
      mockPrismaService.importExportJob.count.mockResolvedValue(0);

      await service.listExports(
        { entityType: EntityType.PRODUCT, page: 1, limit: 10 },
        userId,
      );

      expect(mockPrismaService.importExportJob.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          entityType: EntityType.PRODUCT,
        }),
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by status', async () => {
      mockPrismaService.importExportJob.findMany.mockResolvedValue([]);
      mockPrismaService.importExportJob.count.mockResolvedValue(0);

      await service.listExports(
        { status: 'COMPLETED', page: 1, limit: 10 },
        userId,
      );

      expect(mockPrismaService.importExportJob.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'COMPLETED',
        }),
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('cancelExport', () => {
    const jobId = 'job123';
    const userId = 'user123';

    it('should cancel queued export job', async () => {
      const mockJob = {
        id: jobId,
        createdBy: userId,
        status: 'QUEUED',
      };

      mockPrismaService.importExportJob.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.importExportJob.update.mockResolvedValue({
        ...mockJob,
        status: 'CANCELLED',
      });
      mockExportQueue.removeJobs.mockResolvedValue(undefined);

      const result = await service.cancelExport(jobId, userId);

      expect(result.status).toBe('CANCELLED');
      expect(mockExportQueue.removeJobs).toHaveBeenCalledWith(jobId);
    });

    it('should throw BadRequestException if job already completed', async () => {
      const mockJob = {
        id: jobId,
        createdBy: userId,
        status: 'COMPLETED',
      };

      mockPrismaService.importExportJob.findUnique.mockResolvedValue(mockJob);

      await expect(service.cancelExport(jobId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if job not found', async () => {
      mockPrismaService.importExportJob.findUnique.mockResolvedValue(null);

      await expect(service.cancelExport(jobId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('downloadExport', () => {
    const jobId = 'job123';
    const userId = 'user123';

    it('should return download info for completed export', async () => {
      const mockJob = {
        id: jobId,
        createdBy: userId,
        status: 'COMPLETED',
        resultFileUrl: 'http://example.com/file.csv',
        fileName: 'export.csv',
        fileSize: 1024,
      };

      mockPrismaService.importExportJob.findUnique.mockResolvedValue(mockJob);

      const result = await service.downloadExport(jobId, userId);

      expect(result).toEqual({
        url: mockJob.resultFileUrl,
        fileName: mockJob.fileName,
        fileSize: mockJob.fileSize,
        expiresIn: 3600,
      });
    });

    it('should throw BadRequestException if export not completed', async () => {
      const mockJob = {
        id: jobId,
        createdBy: userId,
        status: 'PROCESSING',
      };

      mockPrismaService.importExportJob.findUnique.mockResolvedValue(mockJob);

      await expect(service.downloadExport(jobId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if job not found', async () => {
      mockPrismaService.importExportJob.findUnique.mockResolvedValue(null);

      await expect(service.downloadExport(jobId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own job', async () => {
      const mockJob = {
        id: jobId,
        createdBy: 'otherUser',
        status: 'COMPLETED',
      };

      mockPrismaService.importExportJob.findUnique.mockResolvedValue(mockJob);

      await expect(service.downloadExport(jobId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
