import { Injectable, Logger } from '@nestjs/common';
import {
  AuthenticatedSocket,
  ConnectionInfo,
  ConnectionStats,
  ConnectionEvent,
} from '../interfaces/authenticated-socket.interface';

/**
 * Service responsible for managing WebSocket connections
 * Tracks active connections, user sessions, and connection statistics
 */
@Injectable()
export class ConnectionManagerService {
  private readonly logger = new Logger(ConnectionManagerService.name);
  private readonly connections = new Map<string, AuthenticatedSocket>();
  private readonly userConnections = new Map<string, Set<string>>();
  private readonly connectionInfo = new Map<string, ConnectionInfo>();

  // Statistics tracking
  private messageCount = 0;
  private errorCount = 0;
  private lastMessageTime = Date.now();
  private readonly startTime = Date.now();

  /**
   * Add a new connection to the manager
   */
  addConnection(socket: AuthenticatedSocket): void {
    const userId = socket.user.id;
    const socketId = socket.id;

    // Store socket connection
    this.connections.set(socketId, socket);

    // Track user-to-socket mapping
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId).add(socketId);

    // Store connection info
    const info: ConnectionInfo = {
      socketId,
      userId,
      connectedAt: new Date(),
      lastActivity: new Date(),
      rooms: [],
      userAgent: socket.handshake.headers['user-agent'],
      ipAddress: socket.handshake.address,
    };
    this.connectionInfo.set(socketId, info);

    // Log connection event
    this.logConnectionEvent({
      type: 'connect',
      socketId,
      userId,
      timestamp: new Date(),
      metadata: {
        userAgent: info.userAgent,
        ipAddress: info.ipAddress,
      },
    });

    this.logger.log(
      `Connection added: ${socketId} | User: ${userId} | Total: ${this.connections.size}`,
    );
  }

  /**
   * Remove a connection from the manager
   */
  removeConnection(socketId: string): void {
    const socket = this.connections.get(socketId);
    if (!socket) {
      return;
    }

    const userId = socket.user.id;

    // Remove from connections map
    this.connections.delete(socketId);

    // Remove from user connections
    const userSockets = this.userConnections.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.userConnections.delete(userId);
      }
    }

    // Remove connection info
    this.connectionInfo.delete(socketId);

    // Log disconnection event
    this.logConnectionEvent({
      type: 'disconnect',
      socketId,
      userId,
      timestamp: new Date(),
    });

    this.logger.log(
      `Connection removed: ${socketId} | User: ${userId} | Total: ${this.connections.size}`,
    );
  }

  /**
   * Get a specific connection by socket ID
   */
  getConnection(socketId: string): AuthenticatedSocket | undefined {
    return this.connections.get(socketId);
  }

  /**
   * Get all connections for a specific user
   */
  getUserConnections(userId: string): AuthenticatedSocket[] {
    const socketIds = this.userConnections.get(userId);
    if (!socketIds) {
      return [];
    }

    return Array.from(socketIds)
      .map((id) => this.connections.get(id))
      .filter((socket): socket is AuthenticatedSocket => socket !== undefined);
  }

  /**
   * Get the number of active connections
   */
  getActiveConnections(): number {
    return this.connections.size;
  }

  /**
   * Get the number of unique users connected
   */
  getActiveUsers(): number {
    return this.userConnections.size;
  }

  /**
   * Get all active connections
   */
  getAllConnections(): AuthenticatedSocket[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection information for all active connections
   */
  getAllConnectionInfo(): ConnectionInfo[] {
    return Array.from(this.connectionInfo.values());
  }

  /**
   * Get connection information for a specific socket
   */
  getConnectionInfo(socketId: string): ConnectionInfo | undefined {
    return this.connectionInfo.get(socketId);
  }

  /**
   * Update last activity time for a connection
   */
  updateActivity(socketId: string): void {
    const info = this.connectionInfo.get(socketId);
    if (info) {
      info.lastActivity = new Date();
    }

    const socket = this.connections.get(socketId);
    if (socket) {
      socket.lastActivity = Date.now();
    }
  }

  /**
   * Track room subscription for a connection
   */
  addRoomToConnection(socketId: string, room: string): void {
    const info = this.connectionInfo.get(socketId);
    if (info && !info.rooms.includes(room)) {
      info.rooms.push(room);
    }
  }

  /**
   * Remove room subscription from a connection
   */
  removeRoomFromConnection(socketId: string, room: string): void {
    const info = this.connectionInfo.get(socketId);
    if (info) {
      info.rooms = info.rooms.filter((r) => r !== room);
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): ConnectionStats {
    const now = Date.now();
    const timeDiff = (now - this.lastMessageTime) / 1000; // seconds
    const messagesPerSecond = timeDiff > 0 ? this.messageCount / timeDiff : 0;
    const errorRate =
      this.messageCount > 0 ? this.errorCount / this.messageCount : 0;

    // Calculate memory usage
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;

    return {
      activeConnections: this.connections.size,
      totalRooms: this.getTotalRooms(),
      messagesPerSecond: Math.round(messagesPerSecond * 100) / 100,
      averageLatency: 0, // TODO: Implement latency tracking
      errorRate: Math.round(errorRate * 10000) / 100, // Percentage
      memoryUsage: Math.round((usedMemory / totalMemory) * 10000) / 100,
    };
  }

  /**
   * Track a message for statistics
   */
  trackMessage(success: boolean = true): void {
    this.messageCount++;
    if (!success) {
      this.errorCount++;
    }
    this.lastMessageTime = Date.now();
  }

  /**
   * Get total number of unique rooms
   */
  private getTotalRooms(): number {
    const rooms = new Set<string>();
    for (const info of this.connectionInfo.values()) {
      info.rooms.forEach((room) => rooms.add(room));
    }
    return rooms.size;
  }

  /**
   * Log connection event (can be extended to send to monitoring service)
   */
  private logConnectionEvent(event: ConnectionEvent): void {
    this.logger.debug(
      `[${event.type.toUpperCase()}] Socket: ${event.socketId} | User: ${event.userId || 'N/A'}`,
    );
    // TODO: Send to monitoring/analytics service
  }

  /**
   * Clean up inactive connections (call periodically)
   */
  cleanupInactiveConnections(timeoutMs: number = 300000): number {
    const now = Date.now();
    let removed = 0;

    for (const [socketId, socket] of this.connections) {
      const lastActivity = socket.lastActivity || now;
      if (now - lastActivity > timeoutMs) {
        socket.disconnect(true);
        this.removeConnection(socketId);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.warn(`Cleaned up ${removed} inactive connections`);
    }

    return removed;
  }

  /**
   * Check if a user is connected
   */
  isUserConnected(userId: string): boolean {
    return (
      this.userConnections.has(userId) &&
      this.userConnections.get(userId).size > 0
    );
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats(): void {
    this.messageCount = 0;
    this.errorCount = 0;
    this.lastMessageTime = Date.now();
  }
}
