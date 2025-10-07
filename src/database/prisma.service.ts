import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'error' | 'warn'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

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

    // Query performance monitoring
    this.$on('query', (e: Prisma.QueryEvent) => {
      if (e.duration > 100) {
        this.logger.warn(
          `Slow query detected: ${e.duration}ms - ${e.query}`,
        );
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
        this.logger.warn(`Transaction attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        if (attempt === maxRetries) break;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
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
