import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RequestQueueStatus, UserRole, Prisma } from '@prisma/client';

/**
 * General-purpose Request Queue Service
 * Handles ANY type of request that needs to be queued and processed
 *
 * Use Cases:
 * - Role change requests (USER → ADMIN to become seller)
 * - Account verification requests
 * - Feature access requests
 * - Custom API requests
 * - Batch operations
 * - etc.
 */
@Injectable()
export class RequestQueueService {
  constructor(private readonly prisma: PrismaService) {}

  // ============= GENERAL QUEUE OPERATIONS =============

  /**
   * Create a general request in the queue
   */
  async createRequest(data: {
    userId?: string;
    endpoint: string;
    method: string;
    priority?: number;
    payload?: any;
    headers?: any;
    expiresInDays?: number;
  }) {
    const expiresAt = new Date(Date.now() + (data.expiresInDays || 30) * 24 * 60 * 60 * 1000);

    return this.prisma.requestQueue.create({
      data: {
        userId: data.userId,
        endpoint: data.endpoint,
        method: data.method,
        priority: data.priority || 50,
        payload: data.payload || null,
        headers: data.headers || null,
        status: RequestQueueStatus.PENDING,
        expiresAt,
      },
      include: {
        user: data.userId
          ? {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            }
          : false,
      },
    });
  }

  /**
   * Get requests with filters
   */
  async getRequests(filters: {
    page?: number;
    limit?: number;
    status?: RequestQueueStatus;
    userId?: string;
    endpoint?: string;
  }) {
    const { page = 1, limit = 20, status, userId, endpoint } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.RequestQueueWhereInput = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (endpoint) where.endpoint = endpoint;

    const [requests, total] = await Promise.all([
      this.prisma.requestQueue.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
              role: true,
              imageUrl: true,
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { queuedAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.requestQueue.count({ where }),
    ]);

    return {
      success: true,
      data: requests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update request status
   */
  async updateRequestStatus(requestId: string, status: RequestQueueStatus, errorMessage?: string) {
    const data: any = { status };

    if (status === RequestQueueStatus.PROCESSING) {
      data.processedAt = new Date();
    } else if (status === RequestQueueStatus.COMPLETED || status === RequestQueueStatus.FAILED) {
      data.completedAt = new Date();
      if (errorMessage) data.errorMessage = errorMessage;
    }

    return this.prisma.requestQueue.update({
      where: { id: requestId },
      data,
    });
  }

  /**
   * Delete a request
   */
  async deleteRequest(requestId: string) {
    return this.prisma.requestQueue.delete({
      where: { id: requestId },
    });
  }

  // ============= ROLE CHANGE SPECIFIC OPERATIONS =============

  /**
   * Create a role change request for a user to become an ADMIN (seller)
   * This is a specialized use of the general request queue
   *
   * Required Information:
   * - User Info: city, region, complete address
   * - Business Info: business name, business type
   * - Product Info: mushroom types, monthly production capacity, certifications
   * - Documents: government ID, BIR certificate, business certificate
   */
  async createRoleChangeRequest(
    userId: string,
    data: {
      // User Info
      city: string;
      region: string;
      completeAddress: string;
      // Business Info
      businessName: string;
      businessType: string;
      // Product Info
      mushroomTypes: string[];
      monthlyProductionCapacity: string;
      certifications?: string[];
      // Documents
      governmentId: string;
      birCertificate: string;
      businessCertificate: string;
      // Optional
      additionalInfo?: string;
    },
  ) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only USER role can request to become ADMIN (seller)
    if (user.role !== UserRole.USER) {
      throw new BadRequestException(
        'Only users with USER role can request to become a seller (ADMIN)',
      );
    }

    // Check if there's already a pending request for this user
    const existingRequest = await this.prisma.requestQueue.findFirst({
      where: {
        userId,
        status: RequestQueueStatus.PENDING,
        endpoint: '/admin/seller-applications',
      },
    });

    if (existingRequest) {
      throw new BadRequestException(
        'You already have a pending seller application. Please wait for admin review.',
      );
    }

    // Create request queue entry with all required information
    const payload = {
      userId,
      currentRole: user.role,
      requestedRole: UserRole.ADMIN,
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
      userInfo: {
        city: data.city,
        region: data.region,
        completeAddress: data.completeAddress,
      },
      businessInfo: {
        businessName: data.businessName,
        businessType: data.businessType,
        additionalInfo: data.additionalInfo || null,
      },
      productInfo: {
        mushroomTypes: data.mushroomTypes,
        monthlyProductionCapacity: data.monthlyProductionCapacity,
        certifications: data.certifications || [],
      },
      documents: {
        governmentId: data.governmentId,
        birCertificate: data.birCertificate,
        businessCertificate: data.businessCertificate,
      },
      submittedAt: new Date().toISOString(),
    };

    const requestQueue = await this.prisma.requestQueue.create({
      data: {
        userId,
        endpoint: '/admin/seller-applications',
        method: 'POST',
        priority: 70, // Higher priority for role change requests
        payload,
        status: RequestQueueStatus.PENDING,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return {
      success: true,
      message:
        'Seller application submitted successfully. Our team will review your documents within 1-3 business days.',
      data: {
        requestId: requestQueue.id,
        currentRole: user.role,
        requestedRole: UserRole.ADMIN,
        status: requestQueue.status,
        queuedAt: requestQueue.queuedAt,
        estimatedProcessingTime: '1-3 business days',
        documentsSubmitted: {
          governmentId: true,
          businessCertificate: true,
          birCertificate: true,
          bankAccountDocumentation: true,
        },
      },
    };
  }

  /**
   * Get all pending role change requests (for admins)
   */
  async getPendingRoleRequests(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      this.prisma.requestQueue.findMany({
        where: {
          endpoint: '/admin/seller-applications',
          status: RequestQueueStatus.PENDING,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
              role: true,
              imageUrl: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { queuedAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.requestQueue.count({
        where: {
          endpoint: '/admin/seller-applications',
          status: RequestQueueStatus.PENDING,
        },
      }),
    ]);

    return {
      success: true,
      data: requests.map(req => ({
        requestId: req.id,
        userId: req.userId,
        user: req.user,
        currentRole: (req.payload as any)?.currentRole,
        requestedRole: (req.payload as any)?.requestedRole,
        reason: (req.payload as any)?.reason,
        queuedAt: req.queuedAt,
        priority: req.priority,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all role change requests with filters (for super admin)
   */
  async getAllRoleRequests(query: {
    page?: number;
    limit?: number;
    status?: RequestQueueStatus;
    userId?: string;
  }) {
    const { page = 1, limit = 20, status, userId } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      endpoint: '/admin/seller-applications',
    };

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    const [requests, total] = await Promise.all([
      this.prisma.requestQueue.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
              role: true,
              imageUrl: true,
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { queuedAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.requestQueue.count({ where }),
    ]);

    return {
      success: true,
      data: requests.map(req => ({
        requestId: req.id,
        userId: req.userId,
        user: req.user,
        currentRole: (req.payload as any)?.currentRole,
        requestedRole: (req.payload as any)?.requestedRole,
        reason: (req.payload as any)?.reason,
        status: req.status,
        queuedAt: req.queuedAt,
        processedAt: req.processedAt,
        completedAt: req.completedAt,
        errorMessage: req.errorMessage,
        priority: req.priority,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user's own role change request status
   */
  async getUserRoleRequestStatus(userId: string) {
    const request = await this.prisma.requestQueue.findFirst({
      where: {
        userId,
        endpoint: '/admin/seller-applications',
      },
      orderBy: { queuedAt: 'desc' },
    });

    if (!request) {
      return {
        success: true,
        hasRequest: false,
        message: 'No role change requests found',
      };
    }

    return {
      success: true,
      hasRequest: true,
      data: {
        requestId: request.id,
        requestedRole: (request.payload as any)?.requestedRole,
        currentRole: (request.payload as any)?.currentRole,
        status: request.status,
        queuedAt: request.queuedAt,
        processedAt: request.processedAt,
        completedAt: request.completedAt,
        errorMessage: request.errorMessage,
      },
    };
  }

  /**
   * Approve a role change request
   */
  async approveRoleRequest(requestId: string, adminId: string, adminNotes?: string) {
    const request = await this.prisma.requestQueue.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== RequestQueueStatus.PENDING) {
      throw new BadRequestException(`Request has already been ${request.status.toLowerCase()}`);
    }

    if (!request.user) {
      throw new NotFoundException('User associated with request not found');
    }

    const requestedRole = (request.payload as any)?.requestedRole;

    // Update request queue status to processing
    await this.prisma.requestQueue.update({
      where: { id: requestId },
      data: {
        status: RequestQueueStatus.PROCESSING,
        processedAt: new Date(),
      },
    });

    try {
      // Update user role
      const updatedUser = await this.prisma.user.update({
        where: { id: request.userId! },
        data: { role: requestedRole as UserRole },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          updatedAt: true,
        },
      });

      // Mark request as completed
      await this.prisma.requestQueue.update({
        where: { id: requestId },
        data: {
          status: RequestQueueStatus.COMPLETED,
          completedAt: new Date(),
          headers: {
            approvedBy: adminId,
            adminNotes: adminNotes || null,
            approvedAt: new Date().toISOString(),
          },
        },
      });

      return {
        success: true,
        message: `Role change approved. User is now a ${requestedRole}`,
        data: {
          requestId,
          user: updatedUser,
          previousRole: (request.payload as any)?.currentRole,
          newRole: requestedRole,
        },
      };
    } catch (error) {
      // Mark request as failed
      await this.prisma.requestQueue.update({
        where: { id: requestId },
        data: {
          status: RequestQueueStatus.FAILED,
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Failed to update user role',
        },
      });

      throw error;
    }
  }

  /**
   * Reject a role change request
   */
  async rejectRoleRequest(requestId: string, adminId: string, adminNotes?: string) {
    const request = await this.prisma.requestQueue.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== RequestQueueStatus.PENDING) {
      throw new BadRequestException(`Request has already been ${request.status.toLowerCase()}`);
    }

    // Mark request as failed (rejected)
    await this.prisma.requestQueue.update({
      where: { id: requestId },
      data: {
        status: RequestQueueStatus.FAILED,
        processedAt: new Date(),
        completedAt: new Date(),
        errorMessage: 'Request rejected by admin',
        headers: {
          rejectedBy: adminId,
          adminNotes: adminNotes || 'Request rejected',
          rejectedAt: new Date().toISOString(),
        },
      },
    });

    return {
      success: true,
      message: 'Role change request rejected',
      data: {
        requestId,
        userId: request.userId,
        requestedRole: (request.payload as any)?.requestedRole,
        reason: adminNotes || 'Request rejected by admin',
      },
    };
  }

  /**
   * Get statistics about role change requests
   */
  async getRoleRequestStats() {
    const [total, pending, approved, rejected] = await Promise.all([
      this.prisma.requestQueue.count({
        where: { endpoint: '/admin/seller-applications' },
      }),
      this.prisma.requestQueue.count({
        where: {
          endpoint: '/admin/seller-applications',
          status: RequestQueueStatus.PENDING,
        },
      }),
      this.prisma.requestQueue.count({
        where: {
          endpoint: '/admin/seller-applications',
          status: RequestQueueStatus.COMPLETED,
        },
      }),
      this.prisma.requestQueue.count({
        where: {
          endpoint: '/admin/seller-applications',
          status: RequestQueueStatus.FAILED,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        approvalRate: total > 0 ? ((approved / total) * 100).toFixed(2) + '%' : '0%',
      },
    };
  }

  /**
   * Get a specific role change request by ID with full details
   * Includes all documents and business information
   */
  async getRoleRequestById(requestId: string) {
    const request = await this.prisma.requestQueue.findUnique({
      where: { id: requestId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,

            phoneNumber: true,
            role: true,
            imageUrl: true,
            createdAt: true,
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

    return {
      success: true,
      data: {
        requestId: request.id,
        user: request.user,
        currentRole: payload?.currentRole,
        requestedRole: payload?.requestedRole,
        documents: payload?.documents || {},
        businessInfo: payload?.businessInfo || {},
        status: request.status,
        queuedAt: request.queuedAt,
        processedAt: request.processedAt,
        completedAt: request.completedAt,
        errorMessage: request.errorMessage,
        adminNotes: (request.headers as any)?.adminNotes || null,
        priority: request.priority,
      },
    };
  }

  /**
   * Bulk approve multiple role change requests
   */
  async bulkApproveRequests(requestIds: string[], adminId: string, adminNotes?: string) {
    const results = [];
    let approved = 0;
    let failed = 0;

    for (const requestId of requestIds) {
      try {
        const result = await this.approveRoleRequest(requestId, adminId, adminNotes);
        results.push({
          requestId,
          status: 'approved',
          userId: result.data.user.id,
        });
        approved++;
      } catch (error) {
        results.push({
          requestId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failed++;
      }
    }

    return {
      success: true,
      message: `Bulk approval completed: ${approved} approved, ${failed} failed`,
      data: {
        approved,
        failed,
        total: requestIds.length,
        results,
      },
    };
  }

  /**
   * Bulk reject multiple role change requests
   */
  async bulkRejectRequests(requestIds: string[], adminId: string, adminNotes?: string) {
    const results = [];
    let rejected = 0;
    let failed = 0;

    for (const requestId of requestIds) {
      try {
        await this.rejectRoleRequest(requestId, adminId, adminNotes);
        results.push({
          requestId,
          status: 'rejected',
        });
        rejected++;
      } catch (error) {
        results.push({
          requestId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failed++;
      }
    }

    return {
      success: true,
      message: `Bulk rejection completed: ${rejected} rejected, ${failed} failed`,
      data: {
        rejected,
        failed,
        total: requestIds.length,
        results,
      },
    };
  }
}
