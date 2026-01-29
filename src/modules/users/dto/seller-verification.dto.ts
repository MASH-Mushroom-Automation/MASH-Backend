import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsUrl,
  IsEnum,
  IsNotEmpty,
  ArrayMinSize,
} from 'class-validator';

/**
 * Document review status enum
 */
export enum DocumentReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RESUBMISSION_REQUIRED = 'RESUBMISSION_REQUIRED',
}

/**
 * Seller application status enum
 */
export enum SellerApplicationStatus {
  PENDING = 'PENDING',
  EMAIL_VERIFICATION_REQUIRED = 'EMAIL_VERIFICATION_REQUIRED',
  DOCUMENTS_UNDER_REVIEW = 'DOCUMENTS_UNDER_REVIEW',
  RESUBMISSION_REQUIRED = 'RESUBMISSION_REQUIRED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * Document type enum
 */
export enum DocumentType {
  GOVERNMENT_ID = 'governmentId',
  BIR_CERTIFICATE = 'birCertificate',
  BUSINESS_CERTIFICATE = 'businessCertificate',
}

/**
 * DTO for individual document status
 */
export class DocumentStatusDto {
  @ApiProperty({ description: 'Document type', enum: DocumentType })
  type: DocumentType;

  @ApiProperty({ description: 'Document URL' })
  url: string;

  @ApiProperty({ description: 'Review status', enum: DocumentReviewStatus })
  status: DocumentReviewStatus;

  @ApiPropertyOptional({ description: 'Reviewer notes/feedback' })
  reviewerNotes?: string;

  @ApiPropertyOptional({ description: 'Date when document was reviewed' })
  reviewedAt?: Date;

  @ApiPropertyOptional({ description: 'Date when document was submitted' })
  submittedAt?: Date;
}

/**
 * DTO for seller verification status response
 */
export class SellerVerificationStatusDto {
  @ApiProperty({ description: 'Request ID' })
  requestId: string;

  @ApiProperty({ description: 'Overall application status', enum: SellerApplicationStatus })
  applicationStatus: SellerApplicationStatus;

  @ApiProperty({ description: 'User email verification status' })
  emailVerified: boolean;

  @ApiProperty({ description: 'Current user role' })
  currentRole: string;

  @ApiProperty({ description: 'Requested role' })
  requestedRole: string;

  @ApiProperty({ description: 'Documents status' })
  documents: DocumentStatusDto[];

  @ApiProperty({ description: 'Business information submitted' })
  businessInfo: {
    businessName: string;
    businessType: string;
    city: string;
    region: string;
  };

  @ApiPropertyOptional({ description: 'Admin notes if any' })
  adminNotes?: string;

  @ApiPropertyOptional({ description: 'Rejection reason if rejected' })
  rejectionReason?: string;

  @ApiProperty({ description: 'Application submission date' })
  submittedAt: Date;

  @ApiPropertyOptional({ description: 'Date when application was processed' })
  processedAt?: Date;

  @ApiPropertyOptional({ description: 'Estimated completion time' })
  estimatedCompletionTime?: string;

  @ApiProperty({ description: 'Progress percentage (0-100)' })
  progressPercentage: number;

  @ApiProperty({ description: 'Next steps for the applicant' })
  nextSteps: string[];
}

/**
 * DTO for updating/resubmitting documents
 */
export class UpdateSellerDocumentsDto {
  @ApiPropertyOptional({ description: 'Government ID document URL' })
  @IsOptional()
  @IsUrl({}, { message: 'Government ID must be a valid URL' })
  governmentId?: string;

  @ApiPropertyOptional({ description: 'BIR Certificate document URL' })
  @IsOptional()
  @IsUrl({}, { message: 'BIR Certificate must be a valid URL' })
  birCertificate?: string;

  @ApiPropertyOptional({ description: 'Business Certificate (DTI/SEC) document URL' })
  @IsOptional()
  @IsUrl({}, { message: 'Business Certificate must be a valid URL' })
  businessCertificate?: string;

  @ApiPropertyOptional({ description: 'Additional notes for resubmission' })
  @IsOptional()
  @IsString()
  resubmissionNotes?: string;
}

/**
 * DTO for admin document review
 */
export class ReviewDocumentDto {
  @ApiProperty({
    description: 'Review decision',
    enum: ['APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED'],
  })
  @IsEnum(['APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED'])
  decision: 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED';

  @ApiPropertyOptional({ description: 'Reviewer notes/feedback' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Specific issues with the document' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  issues?: string[];
}

/**
 * DTO for requesting document resubmission
 */
export class RequestResubmissionDto {
  @ApiProperty({ description: 'Documents that need to be resubmitted', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(DocumentType, { each: true })
  documentsToResubmit: DocumentType[];

  @ApiProperty({ description: 'Reason for requesting resubmission' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ description: 'Specific instructions for each document' })
  @IsOptional()
  instructions?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Deadline for resubmission (days from now)' })
  @IsOptional()
  deadlineDays?: number;
}

/**
 * DTO for seller application timeline event
 */
export class ApplicationTimelineEventDto {
  @ApiProperty({ description: 'Event type' })
  eventType: string;

  @ApiProperty({ description: 'Event description' })
  description: string;

  @ApiProperty({ description: 'Event timestamp' })
  timestamp: Date;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, any>;
}

/**
 * Response DTO for seller verification status
 */
export class SellerVerificationStatusResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Whether user has an active application' })
  hasApplication: boolean;

  @ApiPropertyOptional({
    description: 'Verification status data',
    type: SellerVerificationStatusDto,
  })
  data?: SellerVerificationStatusDto;

  @ApiPropertyOptional({ description: 'Application timeline' })
  timeline?: ApplicationTimelineEventDto[];

  @ApiPropertyOptional({ description: 'Message' })
  message?: string;
}
