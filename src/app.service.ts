import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getApiInfo(): object {
    const port = this.configService.get<number>('PORT', 3000);
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const baseUrl =
      nodeEnv === 'production'
        ? 'https://mash-backend-api.up.railway.app'
        : `http://localhost:${port}`;

    return {
      name: 'MASH Backend API',
      fullName: 'Mushroom Automation with Smart Hydro-environment',
      version: '1.0.0',
      description:
        'Production-ready NestJS backend for IoT mushroom cultivation management system with real-time monitoring, e-commerce, and analytics',
      status: 'operational',
      environment: nodeEnv,
      timestamp: new Date().toISOString(),

      documentation: {
        swagger: `${baseUrl}/api/docs`,
        postman: 'Collection available in /postman directory',
        github: 'https://github.com/MASH-Mushroom-Automation/MASH-Backend',
      },

      features: [
        '🔐 Authentication & Authorization (Clerk Integration)',
        '📊 Real-time IoT Device Monitoring',
        '🛒 E-commerce Product & Order Management',
        '📈 Advanced Analytics & Reporting',
        '🔔 Multi-channel Notifications (Email, SMS, Push)',
        '⚡ Redis Caching & Rate Limiting',
        '📡 WebSocket Real-time Updates',
        '🔍 Prometheus Metrics & Monitoring',
        '🚀 Production-ready with Docker Support',
      ],

      endpoints: {
        health: `${baseUrl}/api/v1/health`,
        healthDatabase: `${baseUrl}/api/v1/health/database`,
        healthSystem: `${baseUrl}/api/v1/health/system`,
        metrics: `${baseUrl}/api/v1/metrics`,
        metricsJson: `${baseUrl}/api/v1/metrics/json`,
        auth: {
          register: `${baseUrl}/api/v1/auth/register`,
          login: `${baseUrl}/api/v1/auth/login`,
          verify: `${baseUrl}/api/v1/auth/verify-email`,
          oauth: {
            google: `${baseUrl}/api/v1/auth/oauth/google`,
            github: `${baseUrl}/api/v1/auth/oauth/github`,
            facebook: `${baseUrl}/api/v1/auth/oauth/facebook`,
          },
        },
        resources: {
          users: `${baseUrl}/api/v1/users`,
          devices: `${baseUrl}/api/v1/devices`,
          sensors: `${baseUrl}/api/v1/sensors`,
          products: `${baseUrl}/api/v1/products`,
          orders: `${baseUrl}/api/v1/orders`,
          categories: `${baseUrl}/api/v1/categories`,
          analytics: `${baseUrl}/api/v1/api/v1/analytics`,
          notifications: `${baseUrl}/api/v1/notifications`,
          admin: `${baseUrl}/api/v1/admin`,
        },
        websocket: {
          namespace: '/ws',
          url: `ws://localhost:${port}/ws`,
        },
      },

      tech: {
        framework: 'NestJS 10.x',
        language: 'TypeScript',
        database: 'PostgreSQL (Neon Cloud)',
        orm: 'Prisma 6.17.1',
        cache: 'Redis',
        auth: 'Clerk API',
        monitoring: 'Prometheus + Grafana',
        tracing: 'OpenTelemetry',
        queue: 'Bull (Redis-based)',
        websocket: 'Socket.IO',
      },

      quickStart: {
        getDocumentation: `Visit ${baseUrl}/api/docs for interactive API documentation`,
        checkHealth: `GET ${baseUrl}/api/v1/health`,
        register: `POST ${baseUrl}/api/v1/auth/register`,
        viewMetrics: `GET ${baseUrl}/api/v1/metrics`,
      },

      support: {
        email: 'pp.namias@gmail.com',
        repository: 'https://github.com/MASH-Mushroom-Automation/MASH-Backend',
        issues:
          'https://github.com/MASH-Mushroom-Automation/MASH-Backend/issues',
      },

      uptime: {
        startedAt: process.uptime(),
        memory: {
          used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        },
        nodeVersion: process.version,
      },
    };
  }
}
