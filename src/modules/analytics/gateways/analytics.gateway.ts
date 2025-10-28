import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { RealtimeAnalyticsService } from '../services/realtime-analytics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@WebSocketGateway({
  namespace: 'analytics',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    credentials: true,
  },
})
export class AnalyticsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AnalyticsGateway.name);
  private metricsInterval: NodeJS.Timeout;

  constructor(private readonly realtimeService: RealtimeAnalyticsService) {}

  afterInit() {
    this.logger.log('Analytics WebSocket Gateway initialized');
    this.startMetricsEmission();
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:dashboard')
  @UseGuards(JwtAuthGuard)
  async handleSubscribeDashboard(client: Socket) {
    await client.join('dashboard');
    const metrics = await this.realtimeService.getLiveMetrics();
    client.emit('dashboard:metrics', metrics);
  }

  @SubscribeMessage('subscribe:sales')
  @UseGuards(JwtAuthGuard)
  async handleSubscribeSales(client: Socket) {
    await client.join('sales');
    const sales = await this.realtimeService.getLiveSalesData();
    client.emit('sales:data', sales);
  }

  private startMetricsEmission() {
    let isRunning = false;

    // Emit metrics every 5 seconds
    this.metricsInterval = setInterval(() => {
      // Prevent overlapping runs
      if (isRunning) {
        this.logger.warn('Skipping metrics emission - previous cycle still running');
        return;
      }

      isRunning = true;

      // Execute async operations with proper error handling (void = fire-and-forget)
      void (async () => {
        try {
          const metrics = await this.realtimeService.getLiveMetrics();
          this.server.to('dashboard').emit('dashboard:metrics', metrics);

          const sales = await this.realtimeService.getLiveSalesData();
          this.server.to('sales').emit('sales:data', sales);
        } catch (error) {
          this.logger.error('Failed to emit metrics', error);
          this.server.to('dashboard').emit('dashboard:error', {
            message: 'Failed to fetch metrics',
            timestamp: new Date(),
          });
        } finally {
          isRunning = false;
        }
      })();
    }, 5000);
  }

  onModuleDestroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }
}
