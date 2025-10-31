import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server } from 'socket.io';
import { WsJwtGuard } from '../guards/ws-jwt.guard';
import { ConnectionManagerService } from '../services/connection-manager.service';
import type { AuthenticatedSocket } from '../interfaces/authenticated-socket.interface';

/**
 * Main WebSocket Gateway
 * Handles core WebSocket functionality including:
 * - Connection/disconnection management
 * - Authentication
 * - Room subscriptions
 * - Basic event handling
 */
@WebSocketGateway({
  namespace: process.env.WS_NAMESPACE || '/ws',
  cors: {
    origin: process.env.WS_CORS_ORIGIN?.split(',') || ['https://mash-backend-api.up.railway.app'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000'),
  pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000'),
})
export class MainGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MainGateway.name);

  constructor(private readonly connectionManager: ConnectionManagerService) {}

  /**
   * Gateway initialization lifecycle hook
   */
  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
    this.logger.log(`Namespace: ${process.env.WS_NAMESPACE || '/ws'}`);
    this.logger.log(`CORS Origins: ${process.env.WS_CORS_ORIGIN}`);
    this.logger.log(`Max Connections: ${process.env.WS_MAX_CONNECTIONS || 10000}`);
  }

  /**
   * Handle new client connections
   * Note: Authentication happens via WsJwtGuard on message handlers
   */
  handleConnection(client: AuthenticatedSocket) {
    try {
      // Log connection attempt
      this.logger.log(`Client connecting: ${client.id}`);
      this.logger.debug(
        `Client handshake: ${JSON.stringify({
          address: client.handshake.address,
          headers: {
            'user-agent': client.handshake.headers['user-agent'],
            origin: client.handshake.headers.origin,
          },
        })}`,
      );

      // Note: User authentication will be verified on first message
      // For now, we just acknowledge the connection
      client.emit('connected', {
        socketId: client.id,
        timestamp: new Date().toISOString(),
        message: 'Connected to WebSocket server. Please authenticate.',
      });

      this.logger.log(`Client connected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnections
   */
  handleDisconnect(client: AuthenticatedSocket) {
    try {
      // Remove from connection manager if authenticated
      if (client.user) {
        this.connectionManager.removeConnection(client.id);
        this.logger.log(
          `Client disconnected: ${client.id} | User: ${client.user.id} | Active: ${this.connectionManager.getActiveConnections()}`,
        );
      } else {
        this.logger.log(`Unauthenticated client disconnected: ${client.id}`);
      }
    } catch (error) {
      this.logger.error(`Disconnection error for client ${client.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle ping event for health checks
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket): any {
    this.connectionManager.trackMessage(true);

    const handshakeTime =
      typeof client.handshake.time === 'number' ? client.handshake.time : Date.now();

    return {
      event: 'pong',
      data: {
        timestamp: new Date().toISOString(),
        latency: Date.now() - handshakeTime,
      },
    };
  }

  /**
   * Handle room subscription
   * Requires authentication
   */
  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe())
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ): Promise<any> {
    try {
      // Add to connection manager on first authenticated message
      if (!this.connectionManager.getConnection(client.id)) {
        this.connectionManager.addConnection(client);
        this.logger.log(
          `User authenticated: ${client.user.id} | Socket: ${client.id} | Active: ${this.connectionManager.getActiveConnections()}`,
        );
      }

      const { room } = data;

      if (!room || typeof room !== 'string') {
        throw new WsException('Invalid room name');
      }

      // Validate room name format
      if (!/^[a-zA-Z0-9:_-]+$/.test(room)) {
        throw new WsException('Invalid room name format');
      }

      // Join the Socket.IO room
      await client.join(room);

      // Track room subscription
      this.connectionManager.addRoomToConnection(client.id, room);
      this.connectionManager.updateActivity(client.id);
      this.connectionManager.trackMessage(true);

      this.logger.log(`User ${client.user.id} subscribed to room: ${room}`);

      return {
        event: 'subscribed',
        data: {
          room,
          timestamp: new Date().toISOString(),
          message: `Successfully subscribed to ${room}`,
        },
      };
    } catch (error) {
      this.connectionManager.trackMessage(false);
      this.logger.error(`Subscribe error for client ${client.id}: ${error.message}`);

      return {
        event: 'error',
        data: {
          message: error.message || 'Failed to subscribe to room',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Handle room unsubscription
   * Requires authentication
   */
  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe())
  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ): Promise<any> {
    try {
      const { room } = data;

      if (!room || typeof room !== 'string') {
        throw new WsException('Invalid room name');
      }

      // Leave the Socket.IO room
      await client.leave(room);

      // Remove room subscription
      this.connectionManager.removeRoomFromConnection(client.id, room);
      this.connectionManager.updateActivity(client.id);
      this.connectionManager.trackMessage(true);

      this.logger.log(`User ${client.user.id} unsubscribed from room: ${room}`);

      return {
        event: 'unsubscribed',
        data: {
          room,
          timestamp: new Date().toISOString(),
          message: `Successfully unsubscribed from ${room}`,
        },
      };
    } catch (error) {
      this.connectionManager.trackMessage(false);
      this.logger.error(`Unsubscribe error for client ${client.id}: ${error.message}`);

      return {
        event: 'error',
        data: {
          message: error.message || 'Failed to unsubscribe from room',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Get connection info (for authenticated users)
   * Requires authentication
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('connection:info')
  handleConnectionInfo(@ConnectedSocket() client: AuthenticatedSocket): any {
    try {
      const info = this.connectionManager.getConnectionInfo(client.id);
      this.connectionManager.updateActivity(client.id);
      this.connectionManager.trackMessage(true);

      return {
        event: 'connection:info',
        data: {
          ...info,
          activeConnections: this.connectionManager.getActiveConnections(),
        },
      };
    } catch (error) {
      this.connectionManager.trackMessage(false);
      this.logger.error(`Connection info error for client ${client.id}: ${error.message}`);

      return {
        event: 'error',
        data: {
          message: 'Failed to retrieve connection info',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Broadcast a message to a specific room
   * This method can be called by other services
   */
  broadcastToRoom(room: string, event: string, data: any): void {
    try {
      this.server.to(room).emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`Broadcasted ${event} to room: ${room}`);
    } catch (error) {
      this.logger.error(`Broadcast to room error: ${error.message}`, error.stack);
    }
  }

  /**
   * Broadcast a message to a specific user (all their connections)
   * This method can be called by other services
   */
  broadcastToUser(userId: string, event: string, data: any): void {
    try {
      const userConnections = this.connectionManager.getUserConnections(userId);

      for (const socket of userConnections) {
        socket.emit(event, {
          ...data,
          timestamp: new Date().toISOString(),
        });
      }

      this.logger.debug(
        `Broadcasted ${event} to user ${userId} (${userConnections.length} connections)`,
      );
    } catch (error) {
      this.logger.error(`Broadcast to user error: ${error.message}`, error.stack);
    }
  }

  /**
   * Broadcast to all connected clients
   * This method can be called by other services
   */
  broadcastGlobal(event: string, data: any): void {
    try {
      this.server.emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`Global broadcast: ${event}`);
    } catch (error) {
      this.logger.error(`Global broadcast error: ${error.message}`, error.stack);
    }
  }

  /**
   * Get current connection statistics
   */
  getConnectionStats() {
    return this.connectionManager.getConnectionStats();
  }

  /**
   * Get all active connections (admin use)
   */
  getActiveConnections() {
    return this.connectionManager.getAllConnectionInfo();
  }
}
