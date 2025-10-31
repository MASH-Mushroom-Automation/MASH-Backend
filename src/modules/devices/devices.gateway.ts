import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure appropriately for production
  },
  namespace: '/devices',
})
export class DevicesGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DevicesGateway.name);

  afterInit(server: Server) {
    this.logger.log('🔌 WebSocket Gateway initialized for devices');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Emit device status update to all connected clients
  emitDeviceStatus(deviceId: string, status: any) {
    this.server.emit(`device:${deviceId}:status`, status);
  }

  // Emit device data to all connected clients
  emitDeviceData(deviceId: string, data: any) {
    this.server.emit(`device:${deviceId}:data`, data);
  }

  // Emit device health update to all connected clients
  emitDeviceHealthUpdate(deviceId: string, healthData: any) {
    this.server.emit(`device:${deviceId}:health`, healthData);
  }

  // Emit device connection event
  emitDeviceConnected(deviceId: string) {
    this.server.emit('device:connected', { deviceId, timestamp: new Date() });
  }

  // Emit device disconnection event
  emitDeviceDisconnected(deviceId: string) {
    this.server.emit('device:disconnected', {
      deviceId,
      timestamp: new Date(),
    });
  }

  // Subscribe to device status updates
  @SubscribeMessage('subscribe:device')
  handleSubscribeDevice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deviceId: string },
  ) {
    client.join(`device:${data.deviceId}`);
    this.logger.log(`Client ${client.id} subscribed to device ${data.deviceId}`);
    return { success: true, message: `Subscribed to device ${data.deviceId}` };
  }

  // Unsubscribe from device updates
  @SubscribeMessage('unsubscribe:device')
  handleUnsubscribeDevice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deviceId: string },
  ) {
    client.leave(`device:${data.deviceId}`);
    this.logger.log(`Client ${client.id} unsubscribed from device ${data.deviceId}`);
    return {
      success: true,
      message: `Unsubscribed from device ${data.deviceId}`,
    };
  }
}
