import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleLogger } from '@nestjs/common';
import { ScheduledReportsService } from './scheduled-reports.service';
import { PrismaService } from '../../../database/prisma.service';
import { ReportBuilderService } from './report-builder.service';
import { ExportService } from './export.service';
import { SubscriptionFrequency } from '@prisma/client';

describe('ScheduledReportsService', () => {
  let service: ScheduledReportsService;
  let prismaService: PrismaService;
  let reportBuilderService: ReportBuilderService;
  let exportService: ExportService;

  const mockPrismaService = {
    reportSubscription: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    report: {
      findUnique: jest.fn(),
    },
  };

  const mockReportBuilderService = {
    executeReport: jest.fn(),
  };

  const mockExportService = {
    createExport: jest.fn(),
  };

  beforeEach(async () => {
    process.env.REPORTS_CRON_ENABLED = 'false'; // Disable cron in tests
    process.env.REPORTS_EMAIL_ENABLED = 'false'; // Disable email in tests

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduledReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ReportBuilderService, useValue: mockReportBuilderService },
        { provide: ExportService, useValue: mockExportService },
      ],
    })

      .setLogger(new ConsoleLogger()) // Use ConsoleLogger for NestJS v11 compatibility

      .compile();

    service = module.get<ScheduledReportsService>(ScheduledReportsService);
    prismaService = module.get<PrismaService>(PrismaService);
    reportBuilderService = module.get<ReportBuilderService>(ReportBuilderService);
    exportService = module.get<ExportService>(ExportService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSubscription', () => {
    const reportId = 'report-1';
    const userId = 'user-1';
    const subscriptionData = {
      frequency: SubscriptionFrequency.DAILY,
      format: 'pdf',
      recipients: ['user@example.com'],
    };

    const mockReport = {
      id: reportId,
      name: 'Sales Report',
      type: 'SALES',
    };

    const mockSubscription = {
      id: 'sub-1',
      reportId,
      userId,
      frequency: SubscriptionFrequency.DAILY,
      format: 'pdf',
      recipients: ['user@example.com'],
      isActive: true,
      report: mockReport,
      user: {
        id: userId,
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
    };

    it('should create a new subscription', async () => {
      mockPrismaService.report.findUnique.mockResolvedValue(mockReport);
      mockPrismaService.reportSubscription.create.mockResolvedValue(mockSubscription);

      const result = await service.createSubscription(reportId, userId, subscriptionData);

      expect(result).toEqual(mockSubscription);
      expect(mockPrismaService.report.findUnique).toHaveBeenCalledWith({
        where: { id: reportId },
      });
      expect(mockPrismaService.reportSubscription.create).toHaveBeenCalled();
    });

    it('should throw error when report not found', async () => {
      mockPrismaService.report.findUnique.mockResolvedValue(null);

      await expect(service.createSubscription(reportId, userId, subscriptionData)).rejects.toThrow(
        `Report with ID ${reportId} not found`,
      );
    });

    it('should use default format when not provided', async () => {
      mockPrismaService.report.findUnique.mockResolvedValue(mockReport);
      mockPrismaService.reportSubscription.create.mockResolvedValue(mockSubscription);

      await service.createSubscription(reportId, userId, {
        frequency: SubscriptionFrequency.WEEKLY,
      });

      expect(mockPrismaService.reportSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'EMAIL',
            frequency: SubscriptionFrequency.WEEKLY,
          }),
        }),
      );
    });
  });

  describe('getUserSubscriptions', () => {
    const userId = 'user-1';
    const mockSubscriptions = [
      {
        id: 'sub-1',
        userId,
        frequency: SubscriptionFrequency.DAILY,
        report: {
          id: 'report-1',
          name: 'Sales Report',
          description: 'Daily sales',
          type: 'SALES',
        },
      },
      {
        id: 'sub-2',
        userId,
        frequency: SubscriptionFrequency.WEEKLY,
        report: {
          id: 'report-2',
          name: 'Revenue Report',
          description: 'Weekly revenue',
          type: 'REVENUE',
        },
      },
    ];

    it('should return user subscriptions', async () => {
      mockPrismaService.reportSubscription.findMany.mockResolvedValue(mockSubscriptions);

      const result = await service.getUserSubscriptions(userId);

      expect(result).toEqual(mockSubscriptions);
      expect(mockPrismaService.reportSubscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should return empty array when no subscriptions', async () => {
      mockPrismaService.reportSubscription.findMany.mockResolvedValue([]);

      const result = await service.getUserSubscriptions(userId);

      expect(result).toEqual([]);
    });
  });

  describe('updateSubscription', () => {
    const subscriptionId = 'sub-1';
    const userId = 'user-1';
    const updateData = {
      frequency: SubscriptionFrequency.WEEKLY,
      isActive: false,
    };

    const mockSubscription = {
      id: subscriptionId,
      userId,
      frequency: SubscriptionFrequency.DAILY,
    };

    const mockUpdatedSubscription = {
      ...mockSubscription,
      ...updateData,
      report: { id: 'report-1', name: 'Test' },
      user: { id: userId, email: 'user@example.com' },
    };

    it('should update subscription', async () => {
      mockPrismaService.reportSubscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaService.reportSubscription.update.mockResolvedValue(mockUpdatedSubscription);

      const result = await service.updateSubscription(subscriptionId, userId, updateData);

      expect(result).toEqual(mockUpdatedSubscription);
      expect(mockPrismaService.reportSubscription.update).toHaveBeenCalledWith({
        where: { id: subscriptionId },
        data: updateData,
        include: expect.any(Object),
      });
    });

    it('should throw error when subscription not found', async () => {
      mockPrismaService.reportSubscription.findFirst.mockResolvedValue(null);

      await expect(service.updateSubscription(subscriptionId, userId, updateData)).rejects.toThrow(
        `Subscription with ID ${subscriptionId} not found`,
      );
    });

    it('should verify ownership before update', async () => {
      mockPrismaService.reportSubscription.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSubscription(subscriptionId, 'other-user', updateData),
      ).rejects.toThrow();

      expect(mockPrismaService.reportSubscription.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: subscriptionId, userId: 'other-user' },
        }),
      );
    });
  });

  describe('deleteSubscription', () => {
    const subscriptionId = 'sub-1';
    const userId = 'user-1';

    const mockSubscription = {
      id: subscriptionId,
      userId,
    };

    it('should delete subscription', async () => {
      mockPrismaService.reportSubscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaService.reportSubscription.delete.mockResolvedValue(mockSubscription);

      const result = await service.deleteSubscription(subscriptionId, userId);

      expect(result).toEqual({
        message: 'Subscription deleted successfully',
      });
      expect(mockPrismaService.reportSubscription.delete).toHaveBeenCalledWith({
        where: { id: subscriptionId },
      });
    });

    it('should throw error when subscription not found', async () => {
      mockPrismaService.reportSubscription.findFirst.mockResolvedValue(null);

      await expect(service.deleteSubscription(subscriptionId, userId)).rejects.toThrow(
        `Subscription with ID ${subscriptionId} not found`,
      );
    });

    it('should verify ownership before delete', async () => {
      mockPrismaService.reportSubscription.findFirst.mockResolvedValue(null);

      await expect(service.deleteSubscription(subscriptionId, 'other-user')).rejects.toThrow();
    });
  });

  describe('triggerSubscription', () => {
    const subscriptionId = 'sub-1';
    const userId = 'user-1';

    const mockSubscription = {
      id: subscriptionId,
      userId,
      reportId: 'report-1',
      frequency: SubscriptionFrequency.DAILY,
      format: 'pdf',
      report: {
        id: 'report-1',
        name: 'Sales Report',
      },
      user: {
        id: userId,
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
    };

    it('should trigger subscription manually', async () => {
      mockPrismaService.reportSubscription.findFirst.mockResolvedValue(mockSubscription);
      mockReportBuilderService.executeReport.mockResolvedValue({
        id: 'exec-1',
        data: {},
      });
      mockExportService.createExport.mockResolvedValue({
        id: 'export-1',
        downloadUrl: 'https://example.com/export.pdf',
      });

      const result = await service.triggerSubscription(subscriptionId, userId);

      expect(result).toEqual({
        message: 'Report generation triggered successfully',
        data: expect.any(Object),
      });
      expect(mockReportBuilderService.executeReport).toHaveBeenCalled();
    });

    it('should throw error when subscription not found', async () => {
      mockPrismaService.reportSubscription.findFirst.mockResolvedValue(null);

      await expect(service.triggerSubscription(subscriptionId, userId)).rejects.toThrow(
        `Subscription with ID ${subscriptionId} not found`,
      );
    });
  });

  describe('generateDailyReports', () => {
    it('should skip when REPORTS_CRON_ENABLED is false', async () => {
      await service.generateDailyReports();

      expect(mockPrismaService.reportSubscription.findMany).not.toHaveBeenCalled();
    });
  });

  describe('generateWeeklyReports', () => {
    it('should skip when REPORTS_CRON_ENABLED is false', async () => {
      await service.generateWeeklyReports();

      expect(mockPrismaService.reportSubscription.findMany).not.toHaveBeenCalled();
    });
  });

  describe('generateMonthlyReports', () => {
    it('should skip when REPORTS_CRON_ENABLED is false', async () => {
      await service.generateMonthlyReports();

      expect(mockPrismaService.reportSubscription.findMany).not.toHaveBeenCalled();
    });
  });
});
