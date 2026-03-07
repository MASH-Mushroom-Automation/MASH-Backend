import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RequestQueueStatus, UserRole } from '@prisma/client';
import { EmailService } from '../notifications/services/email.service';
import {
  EmailTemplateService,
  EmailTemplateType,
} from '../notifications/services/email-template.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  SellerApplicationStatus,
  DocumentReviewStatus,
  DocumentType,
  DocumentStatusDto,
  SellerVerificationStatusDto,
  UpdateSellerDocumentsDto,
  ReviewDocumentDto,
  RequestResubmissionDto,
  ApplicationTimelineEventDto,
} from '../users/dto/seller-verification.dto';

/**
 * Service for managing seller verification workflow
 * Handles document review, status tracking, notifications, and admin operations
 */
@Injectable()
export class SellerVerificationService {
  private readonly logger = new Logger(SellerVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Get detailed seller verification status for a user
   */
  async getVerificationStatus(userId: string): Promise<{
    success: boolean;
    hasApplication: boolean;
    data?: SellerVerificationStatusDto;
    timeline?: ApplicationTimelineEventDto[];
    message?: string;
  }> {
    // Find the user's latest seller application
    const request = await this.prisma.requestQueue.findFirst({
      where: {
        userId,
        endpoint: '/admin/seller-applications',
      },
      orderBy: { queuedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            emailVerified: true,
          },
        },
      },
    });

    if (!request) {
      return {
        success: true,
        hasApplication: false,
        message: 'No seller application found. You can apply to become a seller.',
      };
    }

    const payload = request.payload as any;
    const headers = request.headers as any;

    // Determine overall application status
    const applicationStatus = this.determineApplicationStatus(request, payload);

    // Build document status array
    const documents = this.buildDocumentStatus(payload);

    // Calculate progress percentage
    const progressPercentage = this.calculateProgress(request.status, applicationStatus);

    // Generate next steps
    const nextSteps = this.generateNextSteps(applicationStatus, documents);

    // Build timeline
    const timeline = this.buildTimeline(request, payload, headers);

    const statusData: SellerVerificationStatusDto = {
      requestId: request.id,
      applicationStatus,
      emailVerified: request.user?.emailVerified || false,
      currentRole: payload?.currentRole || request.user?.role,
      requestedRole: payload?.requestedRole || 'GROWER',
      documents,
      businessInfo: {
        businessName: payload?.businessInfo?.businessName || '',
        businessType: payload?.businessInfo?.businessType || '',
        city: payload?.userInfo?.city || '',
        region: payload?.userInfo?.region || '',
      },
      adminNotes: headers?.adminNotes,
      rejectionReason:
        request.status === RequestQueueStatus.FAILED ? request.errorMessage : undefined,
      submittedAt: request.queuedAt,
      processedAt: request.processedAt,
      estimatedCompletionTime: this.getEstimatedCompletionTime(applicationStatus),
      progressPercentage,
      nextSteps,
    };

    return {
      success: true,
      hasApplication: true,
      data: statusData,
      timeline,
    };
  }

  /**
   * Update/resubmit documents for a pending application
   */
  async updateDocuments(
    userId: string,
    updateDto: UpdateSellerDocumentsDto,
  ): Promise<{ success: boolean; message: string; data: any }> {
    // Find the user's pending or resubmission-required application
    const request = await this.prisma.requestQueue.findFirst({
      where: {
        userId,
        endpoint: '/admin/seller-applications',
        status: {
          in: [RequestQueueStatus.PENDING, RequestQueueStatus.PROCESSING],
        },
      },
      orderBy: { queuedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(
        'No pending seller application found. Please submit a new application.',
      );
    }

    const payload = request.payload as any;
    const currentDocuments = payload?.documents || {};

    // Update documents
    const updatedDocuments = {
      ...currentDocuments,
      ...(updateDto.governmentId && { governmentId: updateDto.governmentId }),
      ...(updateDto.birCertificate && { birCertificate: updateDto.birCertificate }),
      ...(updateDto.businessCertificate && { businessCertificate: updateDto.businessCertificate }),
    };

    // Reset document review status for updated documents
    const documentReviewStatus = payload?.documentReviewStatus || {};
    if (updateDto.governmentId) {
      documentReviewStatus.governmentId = {
        status: DocumentReviewStatus.PENDING,
        reviewedAt: null,
      };
    }
    if (updateDto.birCertificate) {
      documentReviewStatus.birCertificate = {
        status: DocumentReviewStatus.PENDING,
        reviewedAt: null,
      };
    }
    if (updateDto.businessCertificate) {
      documentReviewStatus.businessCertificate = {
        status: DocumentReviewStatus.PENDING,
        reviewedAt: null,
      };
    }

    // Update the request
    const updatedRequest = await this.prisma.requestQueue.update({
      where: { id: request.id },
      data: {
        status: RequestQueueStatus.PENDING, // Reset to pending for re-review
        payload: {
          ...payload,
          documents: updatedDocuments,
          documentReviewStatus,
          lastResubmissionAt: new Date().toISOString(),
          resubmissionNotes: updateDto.resubmissionNotes,
        },
      },
    });

    this.logger.log(`Documents updated for seller application ${request.id} by user ${userId}`);

    return {
      success: true,
      message: 'Documents updated successfully. Your application will be reviewed again.',
      data: {
        requestId: updatedRequest.id,
        documentsUpdated: Object.keys(updateDto).filter(k => k !== 'resubmissionNotes'),
      },
    };
  }

  /**
   * Admin: Review a specific document
   */
  async reviewDocument(
    requestId: string,
    documentType: DocumentType,
    reviewDto: ReviewDocumentDto,
    adminId: string,
  ): Promise<{ success: boolean; message: string; data: any }> {
    const request = await this.prisma.requestQueue.findUnique({
      where: { id: requestId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Seller application not found');
    }

    if (request.endpoint !== '/admin/seller-applications') {
      throw new BadRequestException('This is not a seller application request');
    }

    const payload = request.payload as any;
    const documentReviewStatus = payload?.documentReviewStatus || {};

    // Update document review status
    documentReviewStatus[documentType] = {
      status: reviewDto.decision,
      reviewedAt: new Date().toISOString(),
      reviewedBy: adminId,
      notes: reviewDto.notes,
      issues: reviewDto.issues,
    };

    // Update the request
    await this.prisma.requestQueue.update({
      where: { id: requestId },
      data: {
        payload: {
          ...payload,
          documentReviewStatus,
        },
      },
    });

    this.logger.log(
      `Document ${documentType} reviewed for application ${requestId}: ${reviewDto.decision}`,
    );

    return {
      success: true,
      message: `Document ${documentType} has been reviewed: ${reviewDto.decision}`,
      data: {
        documentType,
        decision: reviewDto.decision,
        reviewedAt: new Date(),
      },
    };
  }

  /**
   * Admin: Request document resubmission
   */
  async requestResubmission(
    requestId: string,
    resubmissionDto: RequestResubmissionDto,
    adminId: string,
  ): Promise<{ success: boolean; message: string }> {
    const request = await this.prisma.requestQueue.findUnique({
      where: { id: requestId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Seller application not found');
    }

    const payload = request.payload as any;
    const documentReviewStatus = payload?.documentReviewStatus || {};

    // Mark specified documents as needing resubmission
    for (const docType of resubmissionDto.documentsToResubmit) {
      documentReviewStatus[docType] = {
        status: DocumentReviewStatus.RESUBMISSION_REQUIRED,
        reviewedAt: new Date().toISOString(),
        reviewedBy: adminId,
        notes: resubmissionDto.instructions?.[docType] || resubmissionDto.reason,
      };
    }

    // Calculate deadline
    const deadline = resubmissionDto.deadlineDays
      ? new Date(Date.now() + resubmissionDto.deadlineDays * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

    // Update the request
    await this.prisma.requestQueue.update({
      where: { id: requestId },
      data: {
        status: RequestQueueStatus.PENDING, // Keep in pending for resubmission
        payload: {
          ...payload,
          documentReviewStatus,
          resubmissionRequired: true,
          resubmissionReason: resubmissionDto.reason,
          resubmissionDeadline: deadline.toISOString(),
          resubmissionRequestedAt: new Date().toISOString(),
          resubmissionRequestedBy: adminId,
        },
        headers: {
          ...(request.headers as any),
          resubmissionRequestedBy: adminId,
          resubmissionRequestedAt: new Date().toISOString(),
        },
      },
    });

    // Send resubmission email
    await this.sendResubmissionEmail(
      request.user,
      requestId,
      resubmissionDto,
      documentReviewStatus,
      deadline,
    );

    // Create in-app notification
    await this.createNotification(
      request.userId!,
      'Document Resubmission Required',
      `Your seller application requires document resubmission. Please check your email for details.`,
      { requestId, documentsToResubmit: resubmissionDto.documentsToResubmit },
    );

    this.logger.log(`Resubmission requested for application ${requestId} by admin ${adminId}`);

    return {
      success: true,
      message: 'Resubmission request sent successfully. The applicant has been notified.',
    };
  }

  /**
   * Send application received confirmation email
   */
  async sendApplicationReceivedEmail(
    user: { email: string; firstName: string },
    requestId: string,
    businessInfo: { businessName: string; businessType: string },
  ): Promise<void> {
    try {
      const variables = this.emailTemplateService.getSellerApplicationReceivedVariables(
        user.firstName,
        requestId,
        businessInfo.businessName,
        businessInfo.businessType,
        new Date(),
      );

      await this.emailService.sendTemplatedEmail({
        to: user.email,
        templateType: EmailTemplateType.SELLER_APPLICATION_RECEIVED,
        variables,
      });

      this.logger.log(`Application received email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send application received email: ${error.message}`);
    }
  }

  /**
   * Send application approved email
   */
  async sendApplicationApprovedEmail(
    user: { email: string; firstName: string },
    adminNotes?: string,
  ): Promise<void> {
    try {
      const variables = this.emailTemplateService.getSellerApplicationApprovedVariables(
        user.firstName,
        adminNotes,
      );

      await this.emailService.sendTemplatedEmail({
        to: user.email,
        templateType: EmailTemplateType.SELLER_APPLICATION_APPROVED,
        variables,
      });

      this.logger.log(`Application approved email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send application approved email: ${error.message}`);
    }
  }

  /**
   * Send application rejected email
   */
  async sendApplicationRejectedEmail(
    user: { email: string; firstName: string },
    requestId: string,
    rejectionReason: string,
    issues?: string[],
    adminNotes?: string,
  ): Promise<void> {
    try {
      const variables = this.emailTemplateService.getSellerApplicationRejectedVariables(
        user.firstName,
        requestId,
        rejectionReason,
        issues,
        adminNotes,
      );

      await this.emailService.sendTemplatedEmail({
        to: user.email,
        templateType: EmailTemplateType.SELLER_APPLICATION_REJECTED,
        variables,
      });

      this.logger.log(`Application rejected email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send application rejected email: ${error.message}`);
    }
  }

  /**
   * Send resubmission required email
   */
  private async sendResubmissionEmail(
    user: { email: string; firstName: string },
    requestId: string,
    resubmissionDto: RequestResubmissionDto,
    documentReviewStatus: any,
    deadline: Date,
  ): Promise<void> {
    try {
      const documentMap: Record<DocumentType, string> = {
        [DocumentType.GOVERNMENT_ID]: 'Government ID',
        [DocumentType.BIR_CERTIFICATE]: 'BIR Certificate',
        [DocumentType.BUSINESS_CERTIFICATE]: 'Business Certificate (DTI/SEC)',
      };

      const documents = Object.entries(documentReviewStatus).map(([key, value]: [string, any]) => ({
        name: documentMap[key as DocumentType] || key,
        needsResubmission: value.status === DocumentReviewStatus.RESUBMISSION_REQUIRED,
        issue: value.notes,
        instruction: resubmissionDto.instructions?.[key],
      }));

      const variables = this.emailTemplateService.getSellerResubmissionRequiredVariables(
        user.firstName,
        requestId,
        documents,
        deadline,
        resubmissionDto.reason,
      );

      await this.emailService.sendTemplatedEmail({
        to: user.email,
        templateType: EmailTemplateType.SELLER_RESUBMISSION_REQUIRED,
        variables,
      });

      this.logger.log(`Resubmission required email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send resubmission email: ${error.message}`);
    }
  }

  /**
   * Create in-app notification
   */
  private async createNotification(
    userId: string,
    title: string,
    message: string,
    data?: any,
  ): Promise<void> {
    try {
      await this.notificationsService.create({
        userId,
        type: 'INFO',
        title,
        message,
        data,
      });
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error.message}`);
    }
  }

  /**
   * Determine overall application status
   */
  private determineApplicationStatus(request: any, payload: any): SellerApplicationStatus {
    if (request.status === RequestQueueStatus.COMPLETED) {
      return SellerApplicationStatus.APPROVED;
    }

    if (request.status === RequestQueueStatus.FAILED) {
      return SellerApplicationStatus.REJECTED;
    }

    if (payload?.resubmissionRequired) {
      return SellerApplicationStatus.RESUBMISSION_REQUIRED;
    }

    if (request.status === RequestQueueStatus.PROCESSING) {
      return SellerApplicationStatus.DOCUMENTS_UNDER_REVIEW;
    }

    if (!request.user?.emailVerified) {
      return SellerApplicationStatus.EMAIL_VERIFICATION_REQUIRED;
    }

    return SellerApplicationStatus.PENDING;
  }

  /**
   * Build document status array
   */
  private buildDocumentStatus(payload: any): DocumentStatusDto[] {
    const documents: DocumentStatusDto[] = [];
    const documentReviewStatus = payload?.documentReviewStatus || {};
    const submittedDocuments = payload?.documents || {};

    const documentTypes: Array<{ type: DocumentType; name: string }> = [
      { type: DocumentType.GOVERNMENT_ID, name: 'Government ID' },
      { type: DocumentType.BIR_CERTIFICATE, name: 'BIR Certificate' },
      { type: DocumentType.BUSINESS_CERTIFICATE, name: 'Business Certificate' },
    ];

    for (const doc of documentTypes) {
      const review = documentReviewStatus[doc.type];
      const url = submittedDocuments[doc.type];

      documents.push({
        type: doc.type,
        url: url || '',
        status: review?.status || DocumentReviewStatus.PENDING,
        reviewerNotes: review?.notes,
        reviewedAt: review?.reviewedAt ? new Date(review.reviewedAt) : undefined,
        submittedAt: payload?.submittedAt ? new Date(payload.submittedAt) : undefined,
      });
    }

    return documents;
  }

  /**
   * Calculate progress percentage
   */
  private calculateProgress(
    status: RequestQueueStatus,
    applicationStatus: SellerApplicationStatus,
  ): number {
    if (applicationStatus === SellerApplicationStatus.APPROVED) return 100;
    if (applicationStatus === SellerApplicationStatus.REJECTED) return 100;
    if (applicationStatus === SellerApplicationStatus.DOCUMENTS_UNDER_REVIEW) return 60;
    if (applicationStatus === SellerApplicationStatus.RESUBMISSION_REQUIRED) return 40;
    if (applicationStatus === SellerApplicationStatus.EMAIL_VERIFICATION_REQUIRED) return 20;
    return 30; // PENDING
  }

  /**
   * Generate next steps based on status
   */
  private generateNextSteps(
    status: SellerApplicationStatus,
    documents: DocumentStatusDto[],
  ): string[] {
    const steps: string[] = [];

    switch (status) {
      case SellerApplicationStatus.EMAIL_VERIFICATION_REQUIRED:
        steps.push('Verify your email address to proceed with the application');
        steps.push('Check your inbox for the verification email');
        break;
      case SellerApplicationStatus.PENDING:
        steps.push('Your application is in the queue for review');
        steps.push('We will notify you once the review begins');
        break;
      case SellerApplicationStatus.DOCUMENTS_UNDER_REVIEW:
        steps.push('Our team is reviewing your submitted documents');
        steps.push('You will be notified of the outcome within 1-3 business days');
        break;
      case SellerApplicationStatus.RESUBMISSION_REQUIRED:
        const docsToResubmit = documents.filter(
          d => d.status === DocumentReviewStatus.RESUBMISSION_REQUIRED,
        );
        steps.push(
          `Resubmit the following documents: ${docsToResubmit.map(d => d.type).join(', ')}`,
        );
        steps.push('Review the feedback provided for each document');
        break;
      case SellerApplicationStatus.APPROVED:
        steps.push('Set up your seller profile');
        steps.push('Add your first product to the catalog');
        steps.push('Configure your shipping and payment settings');
        break;
      case SellerApplicationStatus.REJECTED:
        steps.push('Review the rejection reason');
        steps.push('Address the issues mentioned');
        steps.push('Submit a new application when ready');
        break;
    }

    return steps;
  }

  /**
   * Get estimated completion time
   */
  private getEstimatedCompletionTime(status: SellerApplicationStatus): string {
    switch (status) {
      case SellerApplicationStatus.PENDING:
        return '1-3 business days';
      case SellerApplicationStatus.DOCUMENTS_UNDER_REVIEW:
        return '1-2 business days';
      case SellerApplicationStatus.RESUBMISSION_REQUIRED:
        return 'Depends on your resubmission';
      case SellerApplicationStatus.APPROVED:
      case SellerApplicationStatus.REJECTED:
        return 'Complete';
      default:
        return '2-5 business days';
    }
  }

  /**
   * Build application timeline
   */
  private buildTimeline(request: any, payload: any, headers: any): ApplicationTimelineEventDto[] {
    const timeline: ApplicationTimelineEventDto[] = [];

    // Application submitted
    timeline.push({
      eventType: 'APPLICATION_SUBMITTED',
      description: 'Application submitted with documents',
      timestamp: request.queuedAt,
      metadata: {
        businessName: payload?.businessInfo?.businessName,
      },
    });

    // Document resubmissions
    if (payload?.lastResubmissionAt) {
      timeline.push({
        eventType: 'DOCUMENTS_RESUBMITTED',
        description: 'Documents resubmitted',
        timestamp: new Date(payload.lastResubmissionAt),
      });
    }

    // Processing started
    if (request.processedAt) {
      timeline.push({
        eventType: 'REVIEW_STARTED',
        description: 'Review started by admin',
        timestamp: request.processedAt,
      });
    }

    // Resubmission requested
    if (payload?.resubmissionRequestedAt) {
      timeline.push({
        eventType: 'RESUBMISSION_REQUESTED',
        description: 'Document resubmission requested',
        timestamp: new Date(payload.resubmissionRequestedAt),
        metadata: {
          reason: payload?.resubmissionReason,
        },
      });
    }

    // Completed
    if (request.completedAt) {
      timeline.push({
        eventType:
          request.status === RequestQueueStatus.COMPLETED
            ? 'APPLICATION_APPROVED'
            : 'APPLICATION_REJECTED',
        description:
          request.status === RequestQueueStatus.COMPLETED
            ? 'Application approved'
            : 'Application rejected',
        timestamp: request.completedAt,
        metadata: {
          adminNotes: headers?.adminNotes,
        },
      });
    }

    // Sort by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return timeline;
  }

  /**
   * Check the current user's seller application status
   * Safe to call for any authenticated user — only returns their own data
   */
  async checkMySellerStatus(userId: string): Promise<{
    hasPendingRequest: boolean;
    status: 'none' | 'pending' | 'approved' | 'rejected';
    requestId?: string;
    submittedAt?: Date;
  }> {
    const request = await this.prisma.requestQueue.findFirst({
      where: {
        userId,
        endpoint: '/admin/seller-applications',
      },
      orderBy: { queuedAt: 'desc' }, // get the most recent one
      select: {
        id: true,
        status: true,
        queuedAt: true,
      },
    });

    if (!request) {
      return { hasPendingRequest: false, status: 'none' };
    }

    const statusMap = {
      [RequestQueueStatus.PENDING]: 'pending',
      [RequestQueueStatus.COMPLETED]: 'approved',
      [RequestQueueStatus.FAILED]: 'rejected',
      [RequestQueueStatus.PROCESSING]: 'pending', // treat as still pending
    } as const;

    return {
      hasPendingRequest: request.status === RequestQueueStatus.PENDING,
      status: statusMap[request.status] ?? 'none',
      requestId: request.id,
      submittedAt: request.queuedAt,
    };
  }
}
