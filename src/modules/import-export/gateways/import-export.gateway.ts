/**
 * Import Export WebSocket Gateway
 * 
 * Provides real-time progress updates for import/export jobs via Socket.IO.
 * Clients can subscribe to specific jobs and receive progress events.
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { RedisService } from '../../../database/redis.service';
import { PrismaService } from '../../../database/prisma.service';

interface SubscribeJobPayload {
  jobId: string;
}

interface JobProgressData {
  jobId: string;
  processedRecords: number;
  totalRecords: number;
  successCount: number;
  failureCount: number;
  warningCount: number;
  progressPercent: number;
  estimatedTimeMs: number;
  errors?: Array<{
    row: number;
    message: string;
  }>;
}

interface JobCompletedData {
  jobId: string;
  status: string;
  processedRecords: number;
  successCount: number;
  failureCount: number;
  warningCount: number;
  duration: number;
}

interface JobFailedData {
  jobId: string;
  error: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: process.env.WS_NAMESPACE || '/import-export',
})
export class ImportExportGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ImportExportGateway.name);
  private readonly jobSubscriptions = new Map<string, Set<string>>(); // jobId -> Set of socketIds

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Handle client connection
   */
  async handleConnection(client: Socket): Promise<void> {
    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * Handle client disconnect
   */
  async handleDisconnect(client: Socket): Promise<void> {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove client from all job subscriptions
    for (const [jobId, subscribers] of this.jobSubscriptions.entries()) {
      if (subscribers.has(client.id)) {
        subscribers.delete(client.id);
        this.logger.log(`Client ${client.id} unsubscribed from job ${jobId}`);

        // Clean up empty subscription sets
        if (subscribers.size === 0) {
          this.jobSubscriptions.delete(jobId);
        }
      }
    }
  }

  /**
   * Subscribe to job progress updates
   */
  @SubscribeMessage('subscribe:job')
  async handleSubscribeJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribeJobPayload,
  ): Promise<{ success: boolean; message?: string }> {
    const { jobId } = payload;

    if (!jobId) {
      return { success: false, message: 'Job ID is required' };
    }

    // Verify job exists and user has access (in production, check user authentication)
    const job = await this.prisma.importExportJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        processedRecords: true,
        totalRecords: true,
        successCount: true,
        failureCount: true,
        warningCount: true,
        progressPercent: true,
        estimatedTimeMs: true,
      },
    });

    if (!job) {
      return { success: false, message: 'Job not found' };
    }

    // Add client to subscription set
    if (!this.jobSubscriptions.has(jobId)) {
      this.jobSubscriptions.set(jobId, new Set());
    }
    this.jobSubscriptions.get(jobId).add(client.id);

    this.logger.log(`Client ${client.id} subscribed to job ${jobId}`);

    // Send current job status immediately
    client.emit('job:status', {
      jobId: job.id,
      status: job.status,
      processedRecords: job.processedRecords,
      totalRecords: job.totalRecords,
      successCount: job.successCount,
      failureCount: job.failureCount,
      warningCount: job.warningCount,
      progressPercent: job.progressPercent,
      estimatedTimeMs: job.estimatedTimeMs,
    });

    return { success: true };
  }

  /**
   * Unsubscribe from job progress updates
   */
  @SubscribeMessage('unsubscribe:job')
  async handleUnsubscribeJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribeJobPayload,
  ): Promise<{ success: boolean }> {
    const { jobId } = payload;

    if (!jobId) {
      return { success: false };
    }

    const subscribers = this.jobSubscriptions.get(jobId);
    if (subscribers) {
      subscribers.delete(client.id);
      this.logger.log(`Client ${client.id} unsubscribed from job ${jobId}`);

      // Clean up empty subscription sets
      if (subscribers.size === 0) {
        this.jobSubscriptions.delete(jobId);
      }
    }

    return { success: true };
  }

  /**
   * Emit job progress update to subscribed clients
   */
  async emitJobProgress(data: JobProgressData): Promise<void> {
    const subscribers = this.jobSubscriptions.get(data.jobId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    this.logger.log(
      `Emitting progress for job ${data.jobId} to ${subscribers.size} subscriber(s): ${data.progressPercent}%`,
    );

    // Emit to all subscribed clients
    for (const socketId of subscribers) {
      this.server.to(socketId).emit('job:progress', data);
    }
  }

  /**
   * Emit job completed event to subscribed clients
   */
  async emitJobCompleted(data: JobCompletedData): Promise<void> {
    const subscribers = this.jobSubscriptions.get(data.jobId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    this.logger.log(`Emitting completion for job ${data.jobId} to ${subscribers.size} subscriber(s)`);

    // Emit to all subscribed clients
    for (const socketId of subscribers) {
      this.server.to(socketId).emit('job:completed', data);
    }

    // Clean up subscriptions
    this.jobSubscriptions.delete(data.jobId);
  }

  /**
   * Emit job failed event to subscribed clients
   */
  async emitJobFailed(data: JobFailedData): Promise<void> {
    const subscribers = this.jobSubscriptions.get(data.jobId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    this.logger.error(`Emitting failure for job ${data.jobId} to ${subscribers.size} subscriber(s)`);

    // Emit to all subscribed clients
    for (const socketId of subscribers) {
      this.server.to(socketId).emit('job:failed', data);
    }

    // Clean up subscriptions
    this.jobSubscriptions.delete(data.jobId);
  }

  /**
   * Broadcast system status to all connected clients
   */
  async broadcastSystemStatus(status: {
    activeJobs: number;
    queuedJobs: number;
    completedJobs: number;
    failedJobs: number;
  }): Promise<void> {
    this.logger.log(`Broadcasting system status: ${JSON.stringify(status)}`);
    this.server.emit('system:status', status);
  }
}
