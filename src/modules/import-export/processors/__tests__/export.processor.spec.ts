import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bull';
import { ExportProcessor } from '../export.processor';
import { PrismaService } from '../../../../database/prisma.service';
import { RedisService } from '../../../../database/redis.service';
import { FileStorageService } from '../../services/file-storage.service';
import { FileParserFactory } from '../../parsers/file-parser.factory';
import { ImportExportGateway } from '../../gateways/import-export.gateway';
import { EntityType, FileFormat } from '@prisma/client';

describe('ExportProcessor', () => {
  let processor: ExportProcessor;
  let fileStorage: FileStorageService;
  let parserFactory: FileParserFactory;
  let gateway: ImportExportGateway;

  const mockPrismaService = {
    importExportJob: {
      update: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
  };

  const mockRedisService = {
    set: jest.fn(),
    delete: jest.fn(),
  };

  const mockFileStorageService = {
    uploadFile: jest.fn(),
  };

  const mockParser = {
    generate: jest.fn(),
  };

  const mockParserFactory = {
    getParser: jest.fn(() => mockParser),
  };

  const mockGateway = {
    emitJobProgress: jest.fn(),
    emitJobCompleted: jest.fn(),
    emitJobFailed: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportProcessor,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: FileStorageService,
          useValue: mockFileStorageService,
        },
        {
          provide: FileParserFactory,
          useValue: mockParserFactory,
        },
        {
          provide: ImportExportGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    processor = module.get<ExportProcessor>(ExportProcessor);
    fileStorage = module.get<FileStorageService>(FileStorageService);
    parserFactory = module.get<FileParserFactory>(FileParserFactory);
    gateway = module.get<ImportExportGateway>(ImportExportGateway);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('processExport', () => {
    const jobData = {
      jobId: 'job123',
      entityType: EntityType.PRODUCT,
      fileFormat: FileFormat.CSV,
      filters: { isActive: true },
      options: { delimiter: ',' },
    };

    const mockJob = {
      data: jobData,
      progress: jest.fn(),
    } as unknown as Job;

    it('should successfully process export job', async () => {
      const mockProducts = [
        { id: '1', name: 'Product 1', price: 100 },
        { id: '2', name: 'Product 2', price: 200 },
      ];
      const mockFileBuffer = Buffer.from('id,name,price\n1,Product 1,100\n2,Product 2,200');

      mockPrismaService.importExportJob.update.mockResolvedValue({ id: jobData.jobId });
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);
      mockParser.generate.mockResolvedValue(mockFileBuffer);
      mockFileStorageService.uploadFile.mockResolvedValue({
        url: 'http://example.com/export.csv',
        key: 'export-123.csv',
      });

      await processor['processExport'](mockJob);

      // Verify status update to PROCESSING
      expect(mockPrismaService.importExportJob.update).toHaveBeenCalledWith({
        where: { id: jobData.jobId },
        data: expect.objectContaining({
          status: 'PROCESSING',
          startedAt: expect.any(Date),
        }),
      });

      // Verify initial progress emission
      expect(mockGateway.emitJobProgress).toHaveBeenCalled();

      // Verify records fetched
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });

      // Verify file generated
      expect(mockParser.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ delimiter: ',' }),
      );

      // Verify file uploaded
      expect(mockFileStorageService.uploadFile).toHaveBeenCalledWith(
        mockFileBuffer,
        expect.stringContaining('export-product'),
        'text/csv',
      );

      // Verify completion
      expect(mockPrismaService.importExportJob.update).toHaveBeenCalledWith({
        where: { id: jobData.jobId },
        data: expect.objectContaining({
          status: 'COMPLETED',
          resultFileUrl: 'http://example.com/export.csv',
          processedRecords: 2,
          successCount: 2,
        }),
      });

      expect(mockGateway.emitJobCompleted).toHaveBeenCalled();
      expect(mockRedisService.delete).toHaveBeenCalledWith(`export:progress:${jobData.jobId}`);
    });

    it('should handle empty results', async () => {
      mockPrismaService.importExportJob.update.mockResolvedValue({ id: jobData.jobId });
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockParser.generate.mockResolvedValue(Buffer.from('id,name,price\n'));
      mockFileStorageService.uploadFile.mockResolvedValue({
        url: 'http://example.com/export.csv',
        key: 'export-123.csv',
      });

      await processor['processExport'](mockJob);

      expect(mockPrismaService.importExportJob.update).toHaveBeenCalledWith({
        where: { id: jobData.jobId },
        data: expect.objectContaining({
          status: 'COMPLETED',
          processedRecords: 0,
          successCount: 0,
        }),
      });
    });

    it('should handle errors and update job status to FAILED', async () => {
      const error = new Error('Database connection failed');

      mockPrismaService.importExportJob.update.mockResolvedValue({ id: jobData.jobId });
      mockPrismaService.product.findMany.mockRejectedValue(error);

      await expect(processor['processExport'](mockJob)).rejects.toThrow(error);

      expect(mockPrismaService.importExportJob.update).toHaveBeenCalledWith({
        where: { id: jobData.jobId },
        data: expect.objectContaining({
          status: 'FAILED',
          errors: expect.stringContaining('Database connection failed'),
        }),
      });

      expect(mockGateway.emitJobFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: jobData.jobId,
          error: 'Database connection failed',
        }),
      );
    });
  });

  describe('fetchRecords', () => {
    it('should fetch products with relations', async () => {
      const mockProducts = [
        {
          id: '1',
          name: 'Product 1',
          category: { name: 'Category 1' },
          seller: { email: 'seller@example.com' },
        },
      ];

      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);

      const result = await processor['fetchRecords'](EntityType.PRODUCT, {
        isActive: true,
      });

      expect(result).toEqual(mockProducts);
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: expect.objectContaining({
          category: true,
          seller: true,
          images: true,
        }),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should fetch users with relations', async () => {
      const mockUsers = [
        {
          id: '1',
          email: 'user@example.com',
          profile: { firstName: 'John' },
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await processor['fetchRecords'](EntityType.USER, {
        isActive: true,
      });

      expect(result).toEqual(mockUsers);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: expect.objectContaining({
          profile: true,
          addresses: true,
          roles: true,
        }),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply date range filters', async () => {
      const filters = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      };

      mockPrismaService.product.findMany.mockResolvedValue([]);

      await processor['fetchRecords'](EntityType.PRODUCT, filters);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply status filter', async () => {
      const filters = { status: 'ACTIVE' };

      mockPrismaService.product.findMany.mockResolvedValue([]);

      await processor['fetchRecords'](EntityType.PRODUCT, filters);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('generateFile', () => {
    const mockRecords = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ];

    it('should generate CSV file', async () => {
      const mockBuffer = Buffer.from('id,name\n1,Item 1\n2,Item 2');
      mockParser.generate.mockResolvedValue(mockBuffer);

      const result = await processor['generateFile'](
        mockParser,
        mockRecords,
        { delimiter: ',' },
        FileFormat.CSV,
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(mockParser.generate).toHaveBeenCalledWith(mockRecords, {
        delimiter: ',',
      });
    });

    it('should generate Excel file', async () => {
      const mockBuffer = Buffer.from('excel-data');
      mockParser.generate.mockResolvedValue(mockBuffer);

      const result = await processor['generateFile'](
        mockParser,
        mockRecords,
        { sheetName: 'Export' },
        FileFormat.EXCEL,
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(mockParser.generate).toHaveBeenCalledWith(mockRecords, {
        sheetName: 'Export',
      });
    });

    it('should generate JSON file', async () => {
      const mockBuffer = Buffer.from(JSON.stringify(mockRecords));
      mockParser.generate.mockResolvedValue(mockBuffer);

      const result = await processor['generateFile'](
        mockParser,
        mockRecords,
        {},
        FileFormat.JSON,
      );

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should generate XML file', async () => {
      const mockBuffer = Buffer.from('<root><item>1</item></root>');
      mockParser.generate.mockResolvedValue(mockBuffer);

      const result = await processor['generateFile'](
        mockParser,
        mockRecords,
        {},
        FileFormat.XML,
      );

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('updateProgress', () => {
    const jobId = 'job123';

    it('should update progress in Redis and database', async () => {
      mockRedisService.set.mockResolvedValue(undefined);
      mockPrismaService.importExportJob.update.mockResolvedValue({});

      await processor['updateProgress'](jobId, 50, 100);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        `export:progress:${jobId}`,
        expect.any(String),
        3600,
      );

      expect(mockPrismaService.importExportJob.update).toHaveBeenCalledWith({
        where: { id: jobId },
        data: expect.objectContaining({
          processedRecords: 50,
          progressPercent: 50,
        }),
      });

      expect(mockGateway.emitJobProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId,
          processedRecords: 50,
          totalRecords: 100,
          progressPercent: 50,
        }),
      );
    });

    it('should calculate correct progress percentage', async () => {
      mockRedisService.set.mockResolvedValue(undefined);
      mockPrismaService.importExportJob.update.mockResolvedValue({});

      await processor['updateProgress'](jobId, 25, 200);

      expect(mockGateway.emitJobProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          progressPercent: 12.5,
        }),
      );
    });
  });
});
