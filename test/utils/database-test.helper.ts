/**
 * Database Test Helper
 * Provides utilities for database operations in tests
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

export class DatabaseTestHelper {
  private static prisma: PrismaClient;

  /**
   * Initialize Prisma client for testing
   */
  static async initialize(): Promise<PrismaClient> {
    if (!this.prisma) {
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL || process.env.TEST_DATABASE_URL,
          },
        },
      });
      await this.prisma.$connect();
    }
    return this.prisma;
  }

  /**
   * Get the Prisma client instance
   */
  static getPrisma(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Prisma client not initialized. Call initialize() first.');
    }
    return this.prisma;
  }

  /**
   * Clean all tables in the database
   */
  static async cleanDatabase(): Promise<void> {
    const prisma = this.getPrisma();

    // Get all table names
    const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public'`,
    );

    // Disable foreign key checks
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');

    // Truncate all tables
    for (const { tablename } of tables) {
      if (tablename !== '_prisma_migrations') {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
      }
    }

    // Re-enable foreign key checks
    await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
  }

  /**
   * Seed test data
   */
  static async seedTestData(): Promise<void> {
    const prisma = this.getPrisma();
    
    // Add your seed data logic here
    // Example:
    // await prisma.user.createMany({
    //   data: [
    //     { email: 'test1@example.com', name: 'Test User 1' },
    //     { email: 'test2@example.com', name: 'Test User 2' },
    //   ],
    // });
  }

  /**
   * Run migrations
   */
  static async runMigrations(): Promise<void> {
    try {
      execSync('npx prisma migrate deploy', {
        env: {
          ...process.env,
          DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
        },
        stdio: 'inherit',
      });
    } catch (error) {
      console.error('Failed to run migrations:', error);
      throw error;
    }
  }

  /**
   * Reset database (clean + migrate + seed)
   */
  static async resetDatabase(): Promise<void> {
    await this.cleanDatabase();
    await this.runMigrations();
    await this.seedTestData();
  }

  /**
   * Disconnect from database
   */
  static async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Create a transaction for testing
   */
  static async withTransaction<T>(
    callback: (prisma: PrismaClient) => Promise<T>,
  ): Promise<T> {
    const prisma = this.getPrisma();
    return await prisma.$transaction(async (tx) => {
      return await callback(tx as PrismaClient);
    });
  }

  /**
   * Count records in a table
   */
  static async countRecords(tableName: string): Promise<number> {
    const prisma = this.getPrisma();
    const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "${tableName}"`,
    );
    return Number(result[0].count);
  }

  /**
   * Check if a record exists
   */
  static async recordExists(
    tableName: string,
    conditions: Record<string, any>,
  ): Promise<boolean> {
    const prisma = this.getPrisma();
    const whereClause = Object.entries(conditions)
      .map(([key, value]) => `"${key}" = '${value}'`)
      .join(' AND ');

    const result = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS(SELECT 1 FROM "${tableName}" WHERE ${whereClause}) as exists`,
    );
    return result[0].exists;
  }

  /**
   * Execute raw SQL query
   */
  static async executeRaw(sql: string, params?: any[]): Promise<any> {
    const prisma = this.getPrisma();
    if (params) {
      return await prisma.$queryRawUnsafe(sql, ...params);
    }
    return await prisma.$queryRawUnsafe(sql);
  }

  /**
   * Create a test user with specific role
   */
  static async createTestUser(overrides?: Partial<any>): Promise<any> {
    const prisma = this.getPrisma();
    
    // Example implementation - adjust based on your User model
    // return await prisma.user.create({
    //   data: {
    //     email: `test-${Date.now()}@example.com`,
    //     name: 'Test User',
    //     role: 'BUYER',
    //     ...overrides,
    //   },
    // });
    
    // Placeholder return
    return {
      id: `test-user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      ...overrides,
    };
  }

  /**
   * Create test data for a specific model
   */
  static async createTestData<T>(
    modelName: string,
    data: T,
  ): Promise<T> {
    const prisma = this.getPrisma();
    // @ts-ignore - Dynamic model access
    return await prisma[modelName].create({ data });
  }

  /**
   * Find test data by ID
   */
  static async findTestData<T>(
    modelName: string,
    id: string,
  ): Promise<T | null> {
    const prisma = this.getPrisma();
    // @ts-ignore - Dynamic model access
    return await prisma[modelName].findUnique({ where: { id } });
  }

  /**
   * Delete test data by ID
   */
  static async deleteTestData(
    modelName: string,
    id: string,
  ): Promise<void> {
    const prisma = this.getPrisma();
    // @ts-ignore - Dynamic model access
    await prisma[modelName].delete({ where: { id } });
  }

  /**
   * Setup before all tests
   */
  static async setupBeforeAll(): Promise<void> {
    await this.initialize();
    await this.runMigrations();
  }

  /**
   * Setup before each test
   */
  static async setupBeforeEach(): Promise<void> {
    await this.cleanDatabase();
    await this.seedTestData();
  }

  /**
   * Teardown after all tests
   */
  static async teardownAfterAll(): Promise<void> {
    await this.cleanDatabase();
    await this.disconnect();
  }
}
