/**
 * Test Database Helper
 *
 * Provides utilities for setting up, cleaning up, and managing test databases.
 * Ensures test isolation and prevents data leakage between tests.
 */

import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class TestDatabaseHelper {
  private prisma: PrismaClient;
  private static instance: TestDatabaseHelper;

  private constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url:
            process.env.TEST_DATABASE_URL ||
            'postgresql://postgres:postgres@localhost:5432/mash_test',
        },
      },
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TestDatabaseHelper {
    if (!TestDatabaseHelper.instance) {
      TestDatabaseHelper.instance = new TestDatabaseHelper();
    }
    return TestDatabaseHelper.instance;
  }

  /**
   * Setup test database - Run migrations and seed data
   */
  async setupTestDatabase(): Promise<void> {
    try {
      console.log('🔧 Setting up test database...');

      // Run Prisma migrations
      await execAsync('npx prisma migrate deploy');

      // Seed test data (optional)
      await this.seedTestData();

      console.log('✅ Test database setup complete');
    } catch (error) {
      console.error('❌ Failed to setup test database:', error);
      throw error;
    }
  }

  /**
   * Cleanup test database - Remove all data but keep schema
   */
  async cleanupTestDatabase(): Promise<void> {
    try {
      console.log('🧹 Cleaning up test database...');

      // Delete data in reverse order of dependencies
      await this.prisma.rateLimitOverride.deleteMany();
      await this.prisma.apiUsageLog.deleteMany();
      await this.prisma.requestQueue.deleteMany();
      await this.prisma.apiVersionUsage.deleteMany();
      await this.prisma.circuitBreakerState.deleteMany();
      await this.prisma.apiGatewayConfig.deleteMany();

      await this.prisma.orderItem.deleteMany();
      await this.prisma.order.deleteMany();
      await this.prisma.cart.deleteMany();
      await this.prisma.review.deleteMany();
      await this.prisma.product.deleteMany();
      await this.prisma.category.deleteMany();

      await this.prisma.sensorReading.deleteMany();
      await this.prisma.sensor.deleteMany();
      await this.prisma.device.deleteMany();

      await this.prisma.notification.deleteMany();
      await this.prisma.user.deleteMany();

      // Reset sequences (PostgreSQL specific)
      await this.resetSequences();

      console.log('✅ Test database cleanup complete');
    } catch (error) {
      console.error('❌ Failed to cleanup test database:', error);
      throw error;
    }
  }

  /**
   * Reset database - Drop all tables and re-run migrations
   */
  async resetDatabase(): Promise<void> {
    try {
      console.log('🔄 Resetting test database...');

      // Drop all tables and re-run migrations
      await execAsync('npx prisma migrate reset --force --skip-seed');

      console.log('✅ Test database reset complete');
    } catch (error) {
      console.error('❌ Failed to reset test database:', error);
      throw error;
    }
  }

  /**
   * Reset sequences for all tables
   */
  private async resetSequences(): Promise<void> {
    // PostgreSQL sequence reset
    const tables = [
      'User',
      'Product',
      'Category',
      'Order',
      'OrderItem',
      'Cart',
      'Review',
      'Device',
      'Sensor',
      'SensorReading',
      'Notification',
      'ApiGatewayConfig',
      'RateLimitOverride',
      'ApiUsageLog',
      'RequestQueue',
      'ApiVersionUsage',
      'CircuitBreakerState',
    ];

    for (const table of tables) {
      try {
        await this.prisma.$executeRawUnsafe(`ALTER SEQUENCE "${table}_id_seq" RESTART WITH 1;`);
      } catch (error) {
        // Ignore errors for tables without sequences
      }
    }
  }

  /**
   * Seed minimal test data
   */
  private async seedTestData(): Promise<void> {
    // Only seed essential reference data (categories, etc.)
    // Test-specific data should be created in individual tests

    // Example: Create default categories
    const defaultCategories = [
      { name: 'Mushrooms', description: 'Fresh mushrooms', slug: 'mushrooms' },
      { name: 'Spawn', description: 'Mushroom spawn', slug: 'spawn' },
      {
        name: 'Equipment',
        description: 'Growing equipment',
        slug: 'equipment',
      },
    ];

    for (const category of defaultCategories) {
      await this.prisma.category.upsert({
        where: { slug: category.slug },
        update: {},
        create: category,
      });
    }
  }

  /**
   * Get Prisma client for tests
   */
  getPrismaClient(): PrismaClient {
    return this.prisma;
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /**
   * Execute raw SQL query (useful for complex test setup)
   */
  async executeRaw(query: string): Promise<any> {
    return this.prisma.$executeRawUnsafe(query);
  }

  /**
   * Check database connection
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Global test database helper instance
 */
export const testDb = TestDatabaseHelper.getInstance();
