import { Controller, Get, Put, Query, Param, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestQueueService } from '../request-queue/request-queue.service';
import { ProcessRoleRequestDto } from './dto/process-role-request.dto';
import { BulkProcessRequestsDto } from './dto/bulk-process-requests.dto';

@ApiTags('Super Admin')
@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@ApiBearerAuth()
export class SuperAdminController {
  constructor(
    private readonly svc: SuperAdminService,
    private readonly requestQueueService: RequestQueueService,
  ) {}

  @Get('dashboard/overview')
  @ApiOperation({ summary: 'Get super-admin dashboard overview' })
  @ApiResponse({ status: 200, description: 'Overview retrieved' })
  async getOverview() {
    return this.svc.getOverview();
  }

  @Get('dashboard/sales')
  @ApiOperation({ summary: 'Get daily sales for last N days' })
  async getSales(@Query('days') days = '7') {
    const d = parseInt(days as string, 10) || 7;
    return this.svc.getDailySales(d);
  }

  @Get('dashboard/chambers')
  @ApiOperation({ summary: 'Get chamber registry' })
  async getChambers(@Query('page') page = '1', @Query('limit') limit = '10') {
    const p = parseInt(page as string, 10) || 1;
    const l = parseInt(limit as string, 10) || 10;
    return this.svc.getChamberRegistry(p, l);
  }

  @Get('dashboard/users-stats')
  @ApiOperation({ summary: 'Get users counts by role' })
  async getUsersStats() {
    return this.svc.getUsersStats();
  }

  @Get('dashboard/cards')
  @ApiOperation({ summary: 'Get cards summary counts' })
  async getCards() {
    return this.svc.getCardsSummary();
  }

  // ============= Seller Application Endpoints =============

  @Get('seller-applications/pending')
  @ApiOperation({
    summary: 'Get all pending seller applications',
    description: 'View all pending applications from users wanting to become sellers (ADMIN role)',
  })
  @ApiResponse({ status: 200, description: 'Pending seller applications retrieved' })
  async getPendingSellerApplications(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.requestQueueService.getPendingRoleRequests(+page, +limit);
  }

  @Get('seller-applications/all')
  @ApiOperation({
    summary: 'Get all seller applications with filters',
    description: 'View all seller applications (pending, approved, rejected)',
  })
  @ApiResponse({ status: 200, description: 'All seller applications retrieved' })
  async getAllSellerApplications(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    return this.requestQueueService.getAllRoleRequests({
      page: +page,
      limit: +limit,
      status: status as any,
      userId,
    });
  }

  @Get('seller-applications/stats')
  @ApiOperation({
    summary: 'Get seller application statistics',
    description: 'View statistics about seller applications (total, pending, approved, rejected)',
  })
  @ApiResponse({ status: 200, description: 'Seller application statistics' })
  async getSellerApplicationStats() {
    return this.requestQueueService.getRoleRequestStats();
  }

  @Get('seller-applications/:requestId')
  @ApiOperation({
    summary: 'Get seller application details by ID',
    description: `
**Get Full Seller Application Details**

Retrieves complete information about a specific seller application including:
- User information
- All submitted documents (Gov ID, DTI/SEC, BIR, Bank docs)
- Business information (name, address, additional info)
- Application status and timestamps
- Admin notes (if processed)

Use this endpoint to review applications before approving/rejecting.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Seller application details retrieved',
    schema: {
      example: {
        success: true,
        data: {
          requestId: 'req_123456',
          user: {
            id: 'user_123',
            email: 'john@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'USER',
          },
          currentRole: 'USER',
          requestedRole: 'ADMIN',
          documents: {
            governmentId: 'https://s3.bucket.com/gov-id.jpg',
            businessCertificate: 'https://s3.bucket.com/dti-cert.pdf',
            birCertificate: 'https://s3.bucket.com/bir-cert.pdf',
          },
          businessInfo: {
            businessName: 'Manila Mushroom Farm',
            businessType: 'Sole Proprietor',
            additionalInfo: 'Growing organic mushrooms for 5 years',
          },
          productInfo: {
            mushroomTypes: ['Oyster', 'Shiitake', 'Button'],
            monthlyProductionCapacity: '500-1000 kg',
            certifications: ['Organic', 'GAP'],
          },
          userInfo: {
            city: 'Quezon City',
            region: 'NCR',
            completeAddress: 'Unit 123, Brgy. San Antonio, Metro Manila, Philippines',
          },
          contactInfo: {
            city: 'Quezon City',
            region: 'NCR',
            completeAddress: 'Unit 123, Brgy. San Antonio, Metro Manila, Philippines',
          },
          status: 'PENDING',
          queuedAt: '2025-12-04T10:00:00Z',
          processedAt: null,
          completedAt: null,
          priority: 70,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async getSellerApplicationById(@Param('requestId') requestId: string) {
    return this.requestQueueService.getRoleRequestById(requestId);
  }

  @Put('seller-applications/bulk/approve')
  @ApiOperation({
    summary: 'Bulk approve seller applications',
    description: `
**Bulk Approve Multiple Seller Applications**

Approve multiple seller applications at once. Each user will be upgraded to ADMIN role.

**Process:**
- Processes each request independently
- Returns success/failure status for each request
- Continues processing even if some fail
- Records admin info for successful approvals

**Use Case:** Approve multiple pre-verified applications efficiently
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk approval completed',
    schema: {
      example: {
        success: true,
        message: 'Bulk approval completed: 3 approved, 1 failed',
        data: {
          approved: 3,
          failed: 1,
          results: [
            { requestId: 'req_123', status: 'approved', userId: 'user_123' },
            { requestId: 'req_456', status: 'approved', userId: 'user_456' },
            { requestId: 'req_789', status: 'failed', error: 'Request already processed' },
          ],
        },
      },
    },
  })
  async bulkApproveApplications(@Request() req: any, @Body() dto: BulkProcessRequestsDto) {
    return this.requestQueueService.bulkApproveRequests(
      dto.requestIds,
      req.user.userId,
      dto.adminNotes,
    );
  }

  @Put('seller-applications/bulk/reject')
  @ApiOperation({
    summary: 'Bulk reject seller applications',
    description: `
**Bulk Reject Multiple Seller Applications**

Reject multiple seller applications at once. Users remain as USER role.

**Process:**
- Processes each request independently
- Returns success/failure status for each request
- Continues processing even if some fail
- Records admin info and rejection reason

**Use Case:** Reject multiple incomplete applications efficiently
    `,
  })
  @ApiResponse({ status: 200, description: 'Bulk rejection completed' })
  async bulkRejectApplications(@Request() req: any, @Body() dto: BulkProcessRequestsDto) {
    return this.requestQueueService.bulkRejectRequests(
      dto.requestIds,
      req.user.userId,
      dto.adminNotes,
    );
  }

  @Put('seller-applications/:requestId/approve')
  @ApiOperation({
    summary: 'Approve a seller application',
    description: `
**Approve Seller Application**

Reviews documents and approves the application, automatically upgrading user to ADMIN role.

**What happens when approved:**
1. Request status changes to PROCESSING
2. User's role is updated to ADMIN (seller) in the database
3. Request status changes to COMPLETED
4. Super admin info is recorded (who approved and when)
5. User gains access to seller features immediately

**Required Documents Verified:**
- Valid government-issued ID
- DTI/SEC Certificate
- BIR Certificate with TIN
- Bank account documentation
    `,
  })
  @ApiResponse({ status: 200, description: 'Seller application approved successfully' })
  @ApiResponse({ status: 400, description: 'Request already processed or invalid' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async approveSellerApplication(
    @Param('requestId') requestId: string,
    @Request() req: any,
    @Body() dto: ProcessRoleRequestDto,
  ) {
    return this.requestQueueService.approveRoleRequest(requestId, req.user.userId, dto.adminNotes);
  }

  @Put('seller-applications/:requestId/reject')
  @ApiOperation({
    summary: 'Reject a seller application',
    description: `
**Reject Seller Application**

Rejects the application due to incomplete/invalid documents. User's role remains USER.

**What happens when rejected:**
1. Request status changes to FAILED
2. User's role stays as USER
3. Super admin info is recorded (who rejected and reason)
4. User can see the rejection reason and reapply with correct documents

**Common Rejection Reasons:**
- Invalid or expired government ID
- Missing DTI/SEC Certificate
- BIR Certificate not matching provided TIN
- Incomplete bank account documentation
- Business information doesn't match documents
    `,
  })
  @ApiResponse({ status: 200, description: 'Seller application rejected' })
  @ApiResponse({ status: 400, description: 'Request already processed' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async rejectSellerApplication(
    @Param('requestId') requestId: string,
    @Request() req: any,
    @Body() dto: ProcessRoleRequestDto,
  ) {
    return this.requestQueueService.rejectRoleRequest(requestId, req.user.userId, dto.adminNotes);
  }
}
