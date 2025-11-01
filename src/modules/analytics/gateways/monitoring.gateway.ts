import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { PrometheusService } from '../../../monitoring/prometheus/prometheus.service';

interface MetricsSnapshot {
  timestamp: number;
  http: {
    requestsTotal: number;
    requestsPerSecond: number;
    avgDuration: number;
    errorRate: number;
  };
  database: {
    queriesTotal: number;
    queriesPerSecond: number;
    avgDuration: number;
    activeConnections: number;
  };
  cache: {
    hitRate: number;
    operations: number;
    keyCount: number;
    memoryUsage: number;
  };
  business: {
    activeUsers: number;
    ordersToday: number;
    connectedDevices: number;
  };
}

@WebSocketGateway({
  namespace: 'monitoring',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class MonitoringGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MonitoringGateway.name);
  private connectedClients = new Map<string, Socket>();
  private metricsInterval: NodeJS.Timeout | null = null;
  private readonly METRICS_UPDATE_INTERVAL = 5000; // 5 seconds

  constructor(private readonly prometheus: PrometheusService) {}

  afterInit() {
    this.logger.log('Monitoring WebSocket Gateway initialized');
    this.startMetricsBroadcast();
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);

    // Send initial metrics snapshot
    this.sendMetricsSnapshot(client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('subscribe:metrics')
  handleSubscribeMetrics(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} subscribed to metrics`);
    client.join('metrics-subscribers');
    this.sendMetricsSnapshot(client);
  }

  @SubscribeMessage('unsubscribe:metrics')
  handleUnsubscribeMetrics(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} unsubscribed from metrics`);
    client.leave('metrics-subscribers');
  }

  @SubscribeMessage('subscribe:alerts')
  handleSubscribeAlerts(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} subscribed to alerts`);
    client.join('alerts-subscribers');
  }

  @SubscribeMessage('unsubscribe:alerts')
  handleUnsubscribeAlerts(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} unsubscribed from alerts`);
    client.leave('alerts-subscribers');
  }

  @SubscribeMessage('subscribe:health')
  handleSubscribeHealth(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} subscribed to health status`);
    client.join('health-subscribers');
  }

  @SubscribeMessage('unsubscribe:health')
  handleUnsubscribeHealth(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} unsubscribed from health status`);
    client.leave('health-subscribers');
  }

  /**
   * Broadcast alert to all subscribed clients
   */
  broadcastAlert(alert: any) {
    this.logger.log(`Broadcasting alert: ${alert.title}`);
    this.server.to('alerts-subscribers').emit('alert:new', alert);
  }

  /**
   * Broadcast health status change
   */
  broadcastHealthStatus(status: any) {
    this.logger.log('Broadcasting health status update');
    this.server.to('health-subscribers').emit('health:update', status);
  }

  /**
   * Broadcast metrics update
   */
  private broadcastMetrics(metrics: MetricsSnapshot) {
    this.server.to('metrics-subscribers').emit('metrics:update', metrics);
  }

  /**
   * Send metrics snapshot to a specific client
   */
  private async sendMetricsSnapshot(client: Socket) {
    try {
      const metrics = await this.getMetricsSnapshot();
      client.emit('metrics:snapshot', metrics);
    } catch (error) {
      this.logger.error(`Error sending metrics snapshot: ${error.message}`);
    }
  }

  /**
   * Start periodic metrics broadcast
   */
  private startMetricsBroadcast() {
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.getMetricsSnapshot();
        this.broadcastMetrics(metrics);
      } catch (error) {
        this.logger.error(`Error broadcasting metrics: ${error.message}`);
      }
    }, this.METRICS_UPDATE_INTERVAL);
  }

  /**
   * Get current metrics snapshot
   */
  private async getMetricsSnapshot(): Promise<MetricsSnapshot> {
    // This is a simplified version - you should fetch actual metrics from PrometheusService
    const register = await this.prometheus.getMetrics();
    
    return {
      timestamp: Date.now(),
      http: {
        requestsTotal: 0,
        requestsPerSecond: 0,
        avgDuration: 0,
        errorRate: 0,
      },
      database: {
        queriesTotal: 0,
        queriesPerSecond: 0,
        avgDuration: 0,
        activeConnections: 0,
      },
      cache: {
        hitRate: 0,
        operations: 0,
        keyCount: 0,
        memoryUsage: 0,
      },
      business: {
        activeUsers: 0,
        ordersToday: 0,
        connectedDevices: 0,
      },
    };
  }

  onModuleDestroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }
}
