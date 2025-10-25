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
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private readonly queryTimeoutMs: number; // Query timeout in milliseconds
  private readonly startupTime = Date.now(); // Track startup time to suppress cache warming warnings

  // Query performance tracking
  private queryStats = {
    totalQueries: 0,
    slowQueries: 0,
    timedOutQueries: 0,
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

    // Get query timeout from environment variable (default: 30 seconds)
    const timeoutFromEnv = parseInt(
      process.env.DATABASE_QUERY_TIMEOUT_MS || '30000',
      10,
    );
    this.queryTimeoutMs = timeoutFromEnv > 0 ? timeoutFromEnv : 30000;

    // 🚀 Enhanced query performance monitoring (Task 1.1.1)
    this.$on('query', (e: Prisma.QueryEvent) => {
      this.queryStats.totalQueries++;
      this.queryStats.totalDuration += e.duration;

      // Skip slow query warnings during cache warming (first 15 seconds)
      const isWarmingUp = Date.now() - this.startupTime < 15000;

      // Log slow queries (> 50ms)
      if (e.duration > 50 && !isWarmingUp) {
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
      timedOutQueries: 0,
      totalDuration: 0,
      slowestQuery: { duration: 0, query: '' },
    };
    this.logger.log('Query statistics reset');
  }

  /**
   * Execute query with timeout
   * Automatically cancels queries that exceed the configured timeout
   *
   * Usage:
   * ```typescript
   * const result = await prismaService.withTimeout(
   *   prismaService.product.findMany({ where: { active: true } }),
   *   'findMany products'
   * );
   * ```
   *
   * @param promise - The Prisma query promise to execute
   * @param queryDescription - Description of the query for logging
   * @param customTimeoutMs - Optional custom timeout (overrides default)
   * @returns Query result
   * @throws Error if query times out
   */
  async withTimeout<T>(
    promise: Promise<T>,
    queryDescription: string,
    customTimeoutMs?: number,
  ): Promise<T> {
    const timeoutMs = customTimeoutMs || this.queryTimeoutMs;

    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          this.queryStats.timedOutQueries++;
          this.logger.error(
            `Query timeout after ${timeoutMs}ms: ${queryDescription}`,
          );
          reject(
            new Error(
              `Query timeout: ${queryDescription} exceeded ${timeoutMs}ms`,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Get query timeout configuration
   */
  getQueryTimeout() {
    return {
      timeout: this.queryTimeoutMs,
      timeoutFormatted: `${this.queryTimeoutMs}ms`,
      timedOutQueries: this.queryStats.timedOutQueries,
    };
  }

  async onModuleInit() {
    // 🚀 LAZY INITIALIZATION: Don't connect during module init
    // This prevents the server from crashing if database is temporarily unavailable
    // Connection will be established on first database query
    this.logger.log('📊 PrismaService: Lazy initialization enabled');
    this.logger.log(
      '⏳ Database connection will be established on first query',
    );
  }

  /**
   * Ensure database connection is established before executing queries
   * Implements lazy connection pattern for better reliability
   */
  async ensureConnected(): Promise<void> {
    // Already connected
    if (this.isConnected) {
      return;
    }

    // Connection in progress - wait for it
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    // Start new connection
    this.isInitializing = true;
    this.initPromise = this._connect();
    
    try {
      await this.initPromise;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Internal method to establish database connection
   * @private
   */
  private async _connect(): Promise<void> {
    try {
      this.logger.log('🔄 Connecting to Neon PostgreSQL (lazy initialization)...');

      // Set a timeout for the connection attempt
      const connectWithTimeout = Promise.race([
        this.$connect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            this.logger.error('⏰ Database connection TIMEOUT after 10 seconds');
            reject(new Error('Database connection timeout after 10 seconds'));
          }, 10000),
        ),
      ]);

      await connectWithTimeout;
      this.isConnected = true;
      this.logger.log('✅ Successfully connected to Neon PostgreSQL');

      // Test connection with timeout
      const testQueryWithTimeout = Promise.race([
        this.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            this.logger.error('⏰ Test query TIMEOUT after 5 seconds');
            reject(new Error('Test query timeout after 5 seconds'));
          }, 5000),
        ),
      ]);

      await testQueryWithTimeout;
      this.logger.log('✅ Database connection verified');
    } catch (error) {
      this.isConnected = false;
      this.initPromise = null; // Allow retry
      this.logger.error('❌ Failed to connect to database:');
      this.logger.error(`   Error type: ${typeof error}`);
      this.logger.error(`   Error: ${error}`);
      if (error instanceof Error) {
        this.logger.error(`   Message: ${error.message}`);
        this.logger.error(`   Stack: ${error.stack}`);
      }
      throw error; // Propagate error to caller
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
      await this.ensureConnected(); // Ensure connection before health check
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

  // Note: For transparent lazy connection, Prisma Client Extensions could be used
  // For now, services should call ensureConnected() explicitly before queries
  // Example in a service:
  //   async findUser(id: string) {
  //     await this.prisma.ensureConnected();
  //     return this.prisma.user.findUnique({ where: { id } });
  //   }

  /**
   * Execute transaction with retry logic
   */
  async executeTransaction<T>(
    fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect'>) => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    await this.ensureConnected(); // Ensure connection before transaction
    
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

    throw lastError;
  }

  async enableShutdownHooks(app: any) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
