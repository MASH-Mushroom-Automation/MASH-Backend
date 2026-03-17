import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SellerVerificationService } from './seller-verification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  UpdateSellerDocumentsDto,
  ReviewDocumentDto,
  RequestResubmissionDto,
  DocumentType,
  SellerVerificationStatusResponseDto,
} from '../users/dto/seller-verification.dto';

export interface AuthenticatedRequest {
  user: {
    id: string;
    [key: string]: any;
  };
}

@ApiTags('Seller Verification')
@Controller('seller-verification')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SellerVerificationController {
  constructor(private readonly sellerVerificationService: SellerVerificationService) {}

  // ============= USER ENDPOINTS =============

  @Get('status')
  @ApiOperation({
    summary: 'Get seller verification status',
    description: `
**Get Detailed Seller Application Status**

Returns comprehensive information about your seller application including:
- Overall application status
- Email verification status
- Document review status for each submitted document
- Business information
- Progress percentage
- Next steps
- Application timeline

**Possible Status Values:**
- \`PENDING\` - Application submitted, waiting for review
- \`EMAIL_VERIFICATION_REQUIRED\` - Need to verify email first
- \`DOCUMENTS_UNDER_REVIEW\` - Admin is reviewing documents
- \`RESUBMISSION_REQUIRED\` - Some documents need to be resubmitted
- \`APPROVED\` - Application approved, user is now a seller
- \`REJECTED\` - Application rejected
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Seller verification status retrieved successfully',
    type: SellerVerificationStatusResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getVerificationStatus(@Request() req: AuthenticatedRequest) {
    return this.sellerVerificationService.getVerificationStatus(req.user.id);
  }

  @Get('my-status')
  @ApiOperation({
    summary: 'Check seller application status (lightweight)',
    description: 'Quick check for button redirect logic — returns minimal status for nav purposes',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        hasPendingRequest: true,
        status: 'pending',
        requestId: 'req_123456',
        submittedAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  async checkMySellerStatus(@Request() req: AuthenticatedRequest) {
    return this.sellerVerificationService.checkMySellerStatus(req.user.id);
  }

  @Put('documents')
  @ApiOperation({
    summary: 'Update/resubmit documents',
    description: `
**Update or Resubmit Seller Application Documents**

Use this endpoint to:
- Update documents that were rejected
- Resubmit documents that require corrections
- Add missing documents

Only documents that you provide will be updated. Other documents remain unchanged.

**After resubmission:**
- Application status returns to PENDING
- Documents are marked for re-review
- You will be notified when review is complete
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Documents updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Documents updated successfully. Your application will be reviewed again.',
        data: {
          requestId: 'req_123456',
          documentsUpdated: ['governmentId', 'birCertificate'],
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid document data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No pending application found' })
  async updateDocuments(
    @Request() req: AuthenticatedRequest,
    @Body() updateDto: UpdateSellerDocumentsDto,
  ) {
    return this.sellerVerificationService.updateDocuments(req.user.id, updateDto);
  }

  @Post('resend-verification-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend seller application verification email',
    description: `
**Resend Application Confirmation Email**

Resends the seller application confirmation email if you didn't receive it or need a fresh copy.

This email includes:
- Application ID and details
- Status information
- Next steps
- Contact information for support
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Verification email resent',
    schema: {
      example: {
        success: true,
        message: 'Application confirmation email has been resent to your email address.',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'No seller application found' })
  async resendVerificationEmail(@Request() req: AuthenticatedRequest) {
    const userId = String(req.user.id);
    const status = await this.sellerVerificationService.getVerificationStatus(userId);

    if (!status.hasApplication) {
      return {
        success: false,
        message: 'No seller application found. Please submit an application first.',
      };
    }

    // Get user details and resend email
    const request = await this.sellerVerificationService['prisma'].requestQueue.findFirst({
      where: {
        userId,
        endpoint: '/admin/seller-applications',
      },
      orderBy: { queuedAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
          },
        },
      },
    });

    if (request && request.user) {
      const payload = request.payload as unknown as {
        businessInfo?: {
          businessName?: string;
          businessType?: string;
        };
      };
      await this.sellerVerificationService.sendApplicationReceivedEmail(
        { email: request.user.email, firstName: request.user.firstName || 'Applicant' },
        request.id,
        {
          businessName: payload?.businessInfo?.businessName || '',
          businessType: payload?.businessInfo?.businessType || '',
        },
      );
    }

    return {
      success: true,
      message: 'Application confirmation email has been resent to your email address.',
    };
  }

  // ============= ADMIN ENDPOINTS =============

  @Put('admin/applications/:requestId/documents/:documentType/review')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({
    summary: 'Review a specific document (Admin)',
    description: `
**Review Individual Document**

Allows admin to review and provide feedback on individual documents.

**Document Types:**
- \`governmentId\` - Government-issued ID
- \`birCertificate\` - BIR Certificate of Registration
- \`businessCertificate\` - DTI/SEC Business Certificate

**Decision Options:**
- \`APPROVED\` - Document is valid and accepted
- \`REJECTED\` - Document is invalid
- \`RESUBMISSION_REQUIRED\` - Document needs corrections
    `,
  })
  @ApiParam({ name: 'requestId', description: 'Seller application request ID' })
  @ApiParam({
    name: 'documentType',
    description: 'Document type to review',
    enum: DocumentType,
  })
  @ApiResponse({ status: 200, description: 'Document reviewed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async reviewDocument(
    @Param('requestId') requestId: string,
    @Param('documentType') documentType: DocumentType,
    @Body() reviewDto: ReviewDocumentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.sellerVerificationService.reviewDocument(
      requestId,
      documentType,
      reviewDto,
      req.user.id,
    );
  }

  @Put('admin/applications/:requestId/request-resubmission')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({
    summary: 'Request document resubmission (Admin)',
    description: `
**Request Document Resubmission**

When documents need corrections, use this endpoint to:
- Specify which documents need resubmission
- Provide detailed feedback and instructions
- Set a deadline for resubmission

The applicant will receive:
- Email notification with details
- In-app notification
- Updated application status

**Example Request:**
\`\`\`json
{
  "documentsToResubmit": ["governmentId", "birCertificate"],
  "reason": "Documents are blurry and unreadable",
  "instructions": {
    "governmentId": "Please provide a clearer photo of your ID",
    "birCertificate": "TIN number is not visible, please rescan"
  },
  "deadlineDays": 7
}
\`\`\`
    `,
  })
  @ApiParam({ name: 'requestId', description: 'Seller application request ID' })
  @ApiResponse({
    status: 200,
    description: 'Resubmission request sent successfully',
    schema: {
      example: {
        success: true,
        message: 'Resubmission request sent successfully. The applicant has been notified.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async requestResubmission(
    @Param('requestId') requestId: string,
    @Body() resubmissionDto: RequestResubmissionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.sellerVerificationService.requestResubmission(
      requestId,
      resubmissionDto,
      req.user.id,
    );
  }

  @Get('admin/applications/:requestId/status')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({
    summary: 'Get detailed application status (Admin)',
    description:
      'Get comprehensive status of a seller application including document review details',
  })
  @ApiParam({ name: 'requestId', description: 'Seller application request ID' })
  @ApiResponse({ status: 200, description: 'Application status retrieved' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getApplicationStatus(@Param('requestId') requestId: string) {
    const request = await this.sellerVerificationService['prisma'].requestQueue.findUnique({
      where: { id: requestId },
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
        success: false,
        message: 'Application not found',
      };
    }

    return this.sellerVerificationService.getVerificationStatus(request.userId);
  }
}
