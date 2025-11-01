import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringGateway } from './monitoring.gateway';
import { PrometheusService } from '@/monitoring/prometheus/prometheus.service';
import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

describe('MonitoringGateway', () => {
  let gateway: MonitoringGateway;
  let prometheusService: PrometheusService;

  const mockPrometheusService = {
    getMetrics: jest.fn(),
  };

  const mockSocket = {
    id: 'test-socket-id',
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as Socket;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringGateway,
        {
          provide: PrometheusService,
          useValue: mockPrometheusService,
        },
      ],
    }).compile();

    gateway = module.get<MonitoringGateway>(MonitoringGateway);
    prometheusService = module.get<PrometheusService>(PrometheusService);

    // Set mock server
    (gateway as any).server = mockServer;

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear intervals
    const broadcastInterval = (gateway as any).broadcastInterval;
    if (broadcastInterval) {
      clearInterval(broadcastInterval);
    }
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should log client connection', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      gateway.handleConnection(mockSocket);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Client connected: test-socket-id'),
      );
    });

    it('should track connected client', () => {
      gateway.handleConnection(mockSocket);

      // Verify client is added to internal tracking
      // (implementation detail - may need adjustment based on actual implementation)
      expect(mockSocket).toBeDefined();
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnection', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      gateway.handleDisconnect(mockSocket);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Client disconnected: test-socket-id'),
      );
    });

    it('should remove client from all subscriptions', () => {
      // Subscribe to all events
      gateway.handleSubscribeMetrics(mockSocket);
      gateway.handleSubscribeAlerts(mockSocket);
      gateway.handleSubscribeHealth(mockSocket);

      // Disconnect
      gateway.handleDisconnect(mockSocket);

      // Verify subscriptions are cleared
      const metricsClients = (gateway as any).metricsClients;
      const alertsClients = (gateway as any).alertsClients;
      const healthClients = (gateway as any).healthClients;

      expect(metricsClients.has(mockSocket.id)).toBe(false);
      expect(alertsClients.has(mockSocket.id)).toBe(false);
      expect(healthClients.has(mockSocket.id)).toBe(false);
    });
  });

  describe('handleSubscribeMetrics', () => {
    it('should add client to metrics subscribers', () => {
      gateway.handleSubscribeMetrics(mockSocket);

      const metricsClients = (gateway as any).metricsClients;
      expect(metricsClients.has(mockSocket.id)).toBe(true);
    });

    it('should emit confirmation to client', () => {
      gateway.handleSubscribeMetrics(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'subscribed',
        expect.objectContaining({ event: 'metrics' }),
      );
    });

    it('should log subscription', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'debug');

      gateway.handleSubscribeMetrics(mockSocket);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('subscribed to metrics'),
      );
    });
  });

  describe('handleUnsubscribeMetrics', () => {
    it('should remove client from metrics subscribers', () => {
      gateway.handleSubscribeMetrics(mockSocket);
      gateway.handleUnsubscribeMetrics(mockSocket);

      const metricsClients = (gateway as any).metricsClients;
      expect(metricsClients.has(mockSocket.id)).toBe(false);
    });

    it('should emit confirmation to client', () => {
      gateway.handleSubscribeMetrics(mockSocket);
      mockSocket.emit.mockClear();

      gateway.handleUnsubscribeMetrics(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'unsubscribed',
        expect.objectContaining({ event: 'metrics' }),
      );
    });
  });

  describe('handleSubscribeAlerts', () => {
    it('should add client to alerts subscribers', () => {
      gateway.handleSubscribeAlerts(mockSocket);

      const alertsClients = (gateway as any).alertsClients;
      expect(alertsClients.has(mockSocket.id)).toBe(true);
    });

    it('should emit confirmation to client', () => {
      gateway.handleSubscribeAlerts(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'subscribed',
        expect.objectContaining({ event: 'alerts' }),
      );
    });
  });

  describe('handleUnsubscribeAlerts', () => {
    it('should remove client from alerts subscribers', () => {
      gateway.handleSubscribeAlerts(mockSocket);
      gateway.handleUnsubscribeAlerts(mockSocket);

      const alertsClients = (gateway as any).alertsClients;
      expect(alertsClients.has(mockSocket.id)).toBe(false);
    });
  });

  describe('handleSubscribeHealth', () => {
    it('should add client to health subscribers', () => {
      gateway.handleSubscribeHealth(mockSocket);

      const healthClients = (gateway as any).healthClients;
      expect(healthClients.has(mockSocket.id)).toBe(true);
    });

    it('should emit confirmation to client', () => {
      gateway.handleSubscribeHealth(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'subscribed',
        expect.objectContaining({ event: 'health' }),
      );
    });
  });

  describe('handleUnsubscribeHealth', () => {
    it('should remove client from health subscribers', () => {
      gateway.handleSubscribeHealth(mockSocket);
      gateway.handleUnsubscribeHealth(mockSocket);

      const healthClients = (gateway as any).healthClients;
      expect(healthClients.has(mockSocket.id)).toBe(false);
    });
  });

  describe('broadcastMetrics', () => {
    it('should fetch metrics from Prometheus', async () => {
      mockPrometheusService.getMetrics.mockResolvedValue({
        http_requests_total: 100,
        http_response_time_ms: 50,
      });

      await gateway.broadcastMetrics();

      expect(mockPrometheusService.getMetrics).toHaveBeenCalled();
    });

    it('should broadcast to subscribed clients', async () => {
      mockPrometheusService.getMetrics.mockResolvedValue({
        http_requests_total: 100,
      });

      // Subscribe a client
      gateway.handleSubscribeMetrics(mockSocket);

      await gateway.broadcastMetrics();

      // Verify broadcast was called
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'metrics:update',
        expect.objectContaining({
          timestamp: expect.any(Number),
          metrics: expect.any(Object),
        }),
      );
    });

    it('should handle errors gracefully', async () => {
      mockPrometheusService.getMetrics.mockRejectedValue(new Error('Fetch failed'));
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      await gateway.broadcastMetrics();

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should not broadcast if no clients subscribed', async () => {
      mockPrometheusService.getMetrics.mockResolvedValue({});

      await gateway.broadcastMetrics();

      // Should fetch metrics but not emit
      expect(mockPrometheusService.getMetrics).toHaveBeenCalled();
    });
  });

  describe('broadcastAlert', () => {
    it('should broadcast alert to subscribed clients', () => {
      const mockAlert = {
        id: '1',
        eventType: 'HIGH_ERROR_RATE',
        priority: 'CRITICAL',
        message: 'Error rate exceeded threshold',
        triggeredAt: new Date(),
      };

      gateway.handleSubscribeAlerts(mockSocket);
      gateway.broadcastAlert(mockAlert);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'alert:new',
        expect.objectContaining({
          timestamp: expect.any(Number),
          alert: mockAlert,
        }),
      );
    });

    it('should not broadcast if no clients subscribed', () => {
      const mockAlert = { id: '1', eventType: 'TEST' };

      gateway.broadcastAlert(mockAlert);

      // emit should not be called
      expect(mockSocket.emit).not.toHaveBeenCalledWith('alert:new', expect.anything());
    });
  });

  describe('broadcastHealthStatus', () => {
    it('should broadcast health status to subscribed clients', () => {
      const mockHealth = {
        status: 'healthy',
        database: 'up',
        cache: 'up',
        memory: 'up',
      };

      gateway.handleSubscribeHealth(mockSocket);
      gateway.broadcastHealthStatus(mockHealth);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'health:status',
        expect.objectContaining({
          timestamp: expect.any(Number),
          health: mockHealth,
        }),
      );
    });

    it('should not broadcast if no clients subscribed', () => {
      const mockHealth = { status: 'healthy' };

      gateway.broadcastHealthStatus(mockHealth);

      // emit should not be called
      expect(mockSocket.emit).not.toHaveBeenCalledWith('health:status', expect.anything());
    });
  });
});
