import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'error' | 'warn'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  // Query performance tracking
  private queryStats = {
    totalQueries: 0,
    slowQueries: 0,
    totalDuration: 0,
    slowestQuery: { duration: 0, query: '' },
  };

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
        { emit: 'stdout', level: 'info' },
      ],
      errorFormat: 'pretty',
    });

    // 🚀 Enhanced query performance monitoring (Task 1.1.1)
    this.$on('query', (e: Prisma.QueryEvent) => {
      this.queryStats.totalQueries++;
      this.queryStats.totalDuration += e.duration;

      // Log slow queries (> 50ms)
      if (e.duration > 50) {
        this.queryStats.slowQueries++;

        if (e.duration > this.queryStats.slowestQuery.duration) {
          this.queryStats.slowestQuery = {
            duration: e.duration,
            query: e.query,
          };
        }

        const severity = this.getQuerySeverity(e.duration);
        const logMessage = `[${severity}] Slow Query (${e.duration}ms):\n  Query: ${this.truncateQuery(e.query)}\n  Params: ${e.params}`;

        if (e.duration > 200) {
          this.logger.error(logMessage);
        } else if (e.duration > 100) {
          this.logger.warn(logMessage);
        } else {
          this.logger.debug(logMessage);
        }
      }
    });

    // Error logging
    this.$on('error', (e: Prisma.LogEvent) => {
      this.logger.error(`Prisma Error: ${e.message}`);
    });

    // Warning logging
    this.$on('warn', (e: Prisma.LogEvent) => {
      this.logger.warn(`Prisma Warning: ${e.message}`);
    });
  }

  /**
   * Get query severity level based on duration
   */
  private getQuerySeverity(duration: number): string {
    if (duration > 500) return 'CRITICAL';
    if (duration > 200) return 'HIGH';
    if (duration > 100) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Truncate query string for logging
   */
  private truncateQuery(query: string, maxLength = 200): string {
    return query.length > maxLength
      ? query.substring(0, maxLength) + '...'
      : query;
  }

  /**
   * Get query performance statistics
   */
  getQueryStats() {
    const avgDuration =
      this.queryStats.totalQueries > 0
        ? (
            this.queryStats.totalDuration / this.queryStats.totalQueries
          ).toFixed(2)
        : 0;

    return {
      totalQueries: this.queryStats.totalQueries,
      slowQueries: this.queryStats.slowQueries,
      slowQueryPercentage:
        this.queryStats.totalQueries > 0
          ? (
              (this.queryStats.slowQueries / this.queryStats.totalQueries) *
              100
            ).toFixed(2) + '%'
          : '0%',
      avgDuration: `${avgDuration}ms`,
      totalDuration: `${this.queryStats.totalDuration}ms`,
      slowestQuery: {
        duration: `${this.queryStats.slowestQuery.duration}ms`,
        query: this.truncateQuery(this.queryStats.slowestQuery.query, 100),
      },
    };
  }

  /**
   * Reset query statistics
   */
  resetQueryStats() {
    this.queryStats = {
      totalQueries: 0,
      slowQueries: 0,
      totalDuration: 0,
      slowestQuery: { duration: 0, query: '' },
    };
    this.logger.log('Query statistics reset');
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.isConnected = true;
      this.logger.log('✅ Successfully connected to Neon PostgreSQL');

      // Test connection
      await this.$queryRaw`SELECT 1`;
      this.logger.log('✅ Database connection verified');
    } catch (error) {
      this.isConnected = false;
      this.logger.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.$disconnect();
      this.logger.log('🔌 Disconnected from database');
    }
  }

  /**
   * Database health check
   */
  async healthCheck() {
    const startTime = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;
      return {
        status: 'healthy',
        database: 'neon-postgresql',
        responseTime: `${responseTime}ms`,
        connected: this.isConnected,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: 'neon-postgresql',
        error: error.message,
        connected: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute transaction with retry logic
   */
  async executeTransaction<T>(
    fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect'>) => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.$transaction(fn);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Transaction attempt ${attempt}/${maxRetries} failed: ${error.message}`,
        );
        if (attempt === maxRetries) break;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 100),
        );
      }
    }

    throw lastError!;
  }

  async enableShutdownHooks(app: any) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
