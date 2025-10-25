/**
 * Test Configuration
 * 
 * Central configuration for all test environments.
 * Uses separate database and Redis instances to avoid conflicts with development.
 */

export const testConfig = {
  database: {
    // Test database URL - uses separate database from development
    url:
      process.env.TEST_DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/mash_test',
    // Connection pool settings for tests
    connectionLimit: 5,
    poolTimeout: 10,
  },

  redis: {
    // Test Redis URL - uses DB 1 instead of DB 0
    url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
    // Test-specific Redis prefix to avoid key conflicts
    keyPrefix: 'test:',
  },

  jwt: {
    // Test JWT secret - different from development
    secret: process.env.TEST_JWT_SECRET || 'test-jwt-secret-change-in-production',
    expiresIn: '1h',
    // Short expiration for faster test cycles
    refreshExpiresIn: '7d',
  },

  api: {
    // Test API configuration
    port: 3001, // Different port from development (3000)
    prefix: '/api/v1',
    timeout: 5000, // 5 second timeout for tests
  },

  rateLimiting: {
    // Relaxed rate limits for testing
    enabled: true,
    ttl: 60000, // 1 minute
    limit: 1000, // High limit to avoid false failures
  },

  firebase: {
    // Mock Firebase configuration for tests
    enabled: false, // Disable Firebase in tests
    projectId: 'test-project',
  },

  elasticsearch: {
    // Disable Elasticsearch in tests by default
    enabled: false,
    node: 'http://localhost:9200',
  },

  mqtt: {
    // Disable MQTT in tests
    enabled: false,
  },

  email: {
    // Use test email provider (Ethereal or MailHog)
    enabled: false, // Disable real emails in tests
    from: 'test@mash.local',
  },

  aws: {
    // Mock AWS services in tests
    enabled: false,
    s3: {
      bucket: 'test-bucket',
      region: 'us-east-1',
    },
  },

  logging: {
    // Test logging configuration
    level: 'error', // Only log errors in tests to reduce noise
    prettyPrint: false,
    silent: process.env.TEST_SILENT === 'true', // Silence logs if needed
  },

  test: {
    // Test-specific settings
    setupTimeout: 30000, // 30 seconds for test setup
    teardownTimeout: 10000, // 10 seconds for teardown
    testTimeout: 10000, // 10 seconds per test
    retries: 0, // No retries by default
    parallel: true, // Run tests in parallel
    maxWorkers: '50%', // Use 50% of CPU cores
  },
};

/**
 * Environment-specific configuration overrides
 */
export const getTestConfig = (environment: 'unit' | 'integration' | 'e2e' = 'unit') => {
  const baseConfig = { ...testConfig };

  switch (environment) {
    case 'unit':
      // Unit tests: Mock all external dependencies
      return {
        ...baseConfig,
        database: { ...baseConfig.database, url: 'mock' },
        redis: { ...baseConfig.redis, url: 'mock' },
        test: {
          ...baseConfig.test,
          parallel: true,
          maxWorkers: '100%',
        },
      };

    case 'integration':
      // Integration tests: Use real database and Redis
      return {
        ...baseConfig,
        test: {
          ...baseConfig.test,
          parallel: false, // Sequential to avoid conflicts
          maxWorkers: 1,
        },
      };

    case 'e2e':
      // E2E tests: Full stack with all services
      return {
        ...baseConfig,
        firebase: { ...baseConfig.firebase, enabled: true },
        elasticsearch: { ...baseConfig.elasticsearch, enabled: true },
        test: {
          ...baseConfig.test,
          testTimeout: 30000, // Longer timeout for E2E
          parallel: false,
          maxWorkers: 1,
        },
      };

    default:
      return baseConfig;
  }
};
