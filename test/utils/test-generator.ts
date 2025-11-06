/**
 * ============================================================================
 * TEST TEMPLATE GENERATOR
 * ============================================================================
 * 
 * Utility script to generate test file templates for new endpoints
 * 
 * Usage:
 *   npm run generate:test -- --module notifications --endpoint "GET /notifications"
 * 
 * This generates a complete test file with:
 * - Setup and teardown
 * - Success test cases
 * - Error scenarios
 * - Security tests
 * - Integration with ErrorAnalyzer and ProgressTracker
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestTemplateConfig {
  moduleName: string;
  endpoints: EndpointConfig[];
  requiresAuth: boolean;
  requiresAdmin: boolean;
}

interface EndpointConfig {
  method: string;
  path: string;
  description: string;
  requestBody?: any;
  responseSchema?: any;
}

/**
 * Generate test file template
 */
export function generateTestTemplate(config: TestTemplateConfig): string {
  const moduleName = capitalize(config.moduleName);
  const moduleNameKebab = toKebabCase(config.moduleName);

  return `/**
 * ============================================================================
 * ${moduleName.toUpperCase()} E2E TESTS
 * ============================================================================
 * 
 * Tests for ${moduleName} module endpoints
 * 
 * Endpoints Tested:
${config.endpoints.map(ep => ` * - ${ep.method.padEnd(6)} ${ep.path.padEnd(40)} - ${ep.description}`).join('\n')}
 * 
 * Test Count: ${estimateTestCount(config.endpoints)}+ tests
 * Priority: 🔴 CRITICAL
 * ============================================================================
 */

import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/database/prisma.service';
import { ErrorAnalyzer } from '../../utils/error-analyzer';
import { ProgressTracker } from '../../utils/progress-tracker';

describe('${moduleName} E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let errorAnalyzer: ErrorAnalyzer;
  let progressTracker: ProgressTracker;
  ${config.requiresAuth ? 'let authToken: string;' : ''}
  ${config.requiresAdmin ? 'let adminToken: string;' : ''}

  ${generateTestData(config)}

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    errorAnalyzer = new ErrorAnalyzer();
    progressTracker = new ProgressTracker('${moduleNameKebab}');

    ${generateAuth(config)}

    progressTracker.startModule();
  });

  afterAll(async () => {
    ${generateCleanup(config)}
    await prisma.$disconnect();
    await progressTracker.generateReport();
    await app.close();
  });

${config.endpoints.map(ep => generateEndpointTests(ep, config)).join('\n\n')}

  describe('Error Detection', () => {
    it('should detect and analyze ${moduleName.toLowerCase()} errors', async () => {
      const testName = '${moduleName} Error Detection Test';
      progressTracker.startTest(testName);

      // Trigger a test error
      const response = await request(app.getHttpServer())
        .${config.endpoints[0].method.toLowerCase()}('${config.endpoints[0].path}')
        ${config.requiresAuth ? ".set('Authorization', \`Bearer \${authToken}\`)" : ''}
        .expect(400); // Or appropriate error status

      const diagnosis = await errorAnalyzer.analyze(response, {
        expectedStatus: 200,
        endpoint: '${config.endpoints[0].path}',
        testCase: 'Error detection test',
      });

      expect(diagnosis.errorType).toBeDefined();
      expect(diagnosis.fixSuggestions.length).toBeGreaterThan(0);

      console.log('\\n📊 ${moduleName} Error Analysis:');
      console.log(JSON.stringify(diagnosis, null, 2));

      progressTracker.recordTest(testName, 'passed', diagnosis);
    });
  });
});
`;
}

/**
 * Generate test data section
 */
function generateTestData(config: TestTemplateConfig): string {
  if (config.requiresAuth) {
    return `
  const testUser = {
    email: '${toKebabCase(config.moduleName)}.test@example.com',
    password: 'SecurePass123!',
    firstName: '${capitalize(config.moduleName)}',
    lastName: 'Test',
  };
  ${config.requiresAdmin ? `
  const adminUser = {
    email: '${toKebabCase(config.moduleName)}.admin@example.com',
    password: 'AdminPass123!',
    firstName: '${capitalize(config.moduleName)}',
    lastName: 'Admin',
    role: 'ADMIN',
  };
  ` : ''}
`;
  }
  return '';
}

/**
 * Generate authentication setup
 */
function generateAuth(config: TestTemplateConfig): string {
  if (!config.requiresAuth) return '';

  let authCode = `
    // Register test user
    const userRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser);
    authToken = userRegister.body.access_token;
`;

  if (config.requiresAdmin) {
    authCode += `
    // Register admin user
    const adminRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(adminUser);
    adminToken = adminRegister.body.access_token;

    // Update admin role
    await prisma.user.update({
      where: { email: adminUser.email },
      data: { role: 'ADMIN' },
    });
`;
  }

  return authCode;
}

/**
 * Generate cleanup code
 */
function generateCleanup(config: TestTemplateConfig): string {
  if (!config.requiresAuth) return '// Cleanup test data here';

  return `
    await prisma.user.deleteMany({
      where: { email: { contains: '${toKebabCase(config.moduleName)}.test' } },
    });
`;
}

/**
 * Generate tests for a single endpoint
 */
function generateEndpointTests(endpoint: EndpointConfig, config: TestTemplateConfig): string {
  const method = endpoint.method.toUpperCase();
  const path = endpoint.path;
  const authHeader = config.requiresAuth ? ".set('Authorization', `Bearer ${authToken}`)" : '';

  return `  describe('${method} ${path}', () => {
    it('should ${endpoint.description}', async () => {
      const testName = '${method} ${path} - Success';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .${endpoint.method.toLowerCase()}('${path}')
        ${authHeader}
        ${endpoint.requestBody ? `.send(${JSON.stringify(endpoint.requestBody, null, 6)})` : ''}
        .expect(${getExpectedStatus(endpoint.method)});

      expect(response.body).toBeDefined();
      // Add specific assertions here

      progressTracker.recordTest(testName, 'passed', response.body);
    });

    ${config.requiresAuth ? `
    it('should fail without authentication', async () => {
      const testName = '${method} ${path} - No Auth';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .${endpoint.method.toLowerCase()}('${path}')
        ${endpoint.requestBody ? `.send(${JSON.stringify(endpoint.requestBody, null, 6)})` : ''}
        .expect(401);

      expect(response.body).toHaveProperty('message');

      progressTracker.recordTest(testName, 'passed', response.body);
    });
    ` : ''}

    ${endpoint.method === 'POST' || endpoint.method === 'PATCH' ? `
    it('should fail with invalid data', async () => {
      const testName = '${method} ${path} - Invalid Data';
      progressTracker.startTest(testName);

      const response = await request(app.getHttpServer())
        .${endpoint.method.toLowerCase()}('${path}')
        ${authHeader}
        .send({}) // Empty or invalid data
        .expect(400);

      expect(response.body).toHaveProperty('message');

      progressTracker.recordTest(testName, 'passed', response.body);
    });
    ` : ''}
  });`;
}

/**
 * Get expected status code for method
 */
function getExpectedStatus(method: string): number {
  switch (method.toUpperCase()) {
    case 'POST':
      return 201;
    case 'DELETE':
      return 200;
    default:
      return 200;
  }
}

/**
 * Estimate test count based on endpoints
 */
function estimateTestCount(endpoints: EndpointConfig[]): number {
  // Base: 3 tests per endpoint (success, no auth, invalid data)
  // + 2 for error detection
  return endpoints.length * 3 + 2;
}

/**
 * Capitalize string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert to kebab-case
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/**
 * CLI Usage Example
 */
if (require.main === module) {
  const config: TestTemplateConfig = {
    moduleName: 'Notifications',
    requiresAuth: true,
    requiresAdmin: false,
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/notifications',
        description: 'List all notifications',
      },
      {
        method: 'POST',
        path: '/api/v1/notifications',
        description: 'Create notification',
        requestBody: {
          title: 'Test Notification',
          message: 'Test message',
          type: 'info',
        },
      },
      {
        method: 'PATCH',
        path: '/api/v1/notifications/:id/read',
        description: 'Mark as read',
      },
      {
        method: 'DELETE',
        path: '/api/v1/notifications/:id',
        description: 'Delete notification',
      },
    ],
  };

  const template = generateTestTemplate(config);
  
  // Write to file
  const outputPath = path.join(
    __dirname,
    '..',
    'e2e',
    toKebabCase(config.moduleName),
    `${toKebabCase(config.moduleName)}.e2e-spec.ts`,
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, template);

  console.log(`✅ Test template generated: ${outputPath}`);
  console.log(`📊 Estimated tests: ${estimateTestCount(config.endpoints)}`);
}

export { generateTestTemplate, TestTemplateConfig, EndpointConfig };
