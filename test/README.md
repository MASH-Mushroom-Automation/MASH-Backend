# Automated API Testing System - README

## 🎯 Overview

This directory contains a comprehensive automated API testing system for the MASH Backend. The system provides:

- ✅ **Intelligent Error Detection**: Automatically identifies issues and suggests fixes
- ✅ **Progress Tracking**: Real-time HTML dashboards showing test coverage
- ✅ **76+ Test Scenarios**: Covering authentication, users, products, and orders
- ✅ **CI/CD Integration**: GitHub Actions workflow for automated testing

## 📁 Directory Structure

```
test/
├── e2e/                          # End-to-end test suites
│   ├── auth/                     # Authentication module (76 tests)
│   │   ├── login.e2e-spec.ts     # 27 tests for login endpoint
│   │   ├── register.e2e-spec.ts  # 25 tests for registration
│   │   ├── refresh.e2e-spec.ts   # 14 tests for token refresh
│   │   └── me.e2e-spec.ts        # 10 tests for profile endpoint
│   ├── users/                    # User management (15+ tests)
│   │   └── users.e2e-spec.ts
│   ├── products/                 # Product catalog (20+ tests)
│   │   └── products.e2e-spec.ts
│   └── orders/                   # Order processing (18+ tests)
│       └── orders.e2e-spec.ts
├── utils/                        # Utility classes
│   ├── error-analyzer.ts         # 500+ lines - Intelligent error detection
│   └── progress-tracker.ts       # 300+ lines - Progress tracking & reporting
├── fixtures/                     # Test data
│   └── auth/
│       └── test-data.ts          # Authentication test fixtures
├── reports/                      # Generated reports (git ignored)
│   ├── *-progress.html           # HTML dashboards
│   └── *-progress.json           # JSON reports for CI/CD
└── jest-e2e.json                 # Jest E2E configuration
```

## 🚀 Quick Start

### Run All Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific module
npm run test:e2e -- test/e2e/auth
npm run test:e2e -- test/e2e/users
npm run test:e2e -- test/e2e/products
npm run test:e2e -- test/e2e/orders

# Run specific endpoint
npm run test:e2e -- test/e2e/auth/login.e2e-spec.ts
```

### View Reports

After running tests, view the generated reports:

```bash
# Open HTML dashboard (Windows)
start test/reports/auth-progress.html

# Open HTML dashboard (Linux/Mac)
open test/reports/auth-progress.html
```

## 📊 Test Coverage by Module

| Module          | Endpoints | Tests | Status |
| --------------- | --------- | ----- | ------ |
| Authentication  | 4         | 76    | ✅     |
| Users           | 5         | 15+   | ✅     |
| Products        | 5         | 20+   | ✅     |
| Orders          | 6         | 18+   | ✅     |
| **TOTAL**       | **20**    | **129+** | ✅  |

## 🔍 Error Detection Features

The `ErrorAnalyzer` automatically:

1. **Categorizes Errors**

   - `INVALID_CREDENTIALS`
   - `JWT_SIGNING_ERROR`
   - `DATABASE_ERROR`
   - `VALIDATION_ERROR`
   - `RATE_LIMIT_EXCEEDED`
   - And 10+ more categories

2. **Identifies Root Causes**

   ```
   Root Cause: JWT_SECRET environment variable not set or mismatch.
   JWT token is malformed, has invalid signature, or was signed with different secret key.
   ```

3. **Generates Fix Suggestions**
   ```
   Fix Step 1: Verify JWT_SECRET in .env matches service configuration
   File: .env
   Line: 12
   Change: JWT_SECRET=wrong-secret → JWT_SECRET=<CORRECT_SECRET>
   ```

## 📈 Progress Tracking

The `ProgressTracker` generates:

### HTML Dashboard

- ✅ Visual progress bars
- ✅ Test statistics (passed, failed, coverage %)
- ✅ Response time metrics
- ✅ Detailed failure analysis with fix suggestions
- ✅ Beautiful, responsive UI

### JSON Reports

```json
{
  "module": "auth",
  "totalEndpoints": 18,
  "passedEndpoints": 4,
  "failedEndpoints": 0,
  "coverage": 22.2,
  "averageResponseTime": 245,
  "lastRunDate": "2025-11-07T10:30:00.000Z"
}
```

## 🔧 Configuration

### Jest Configuration (`test/jest-e2e.json`)

```json
{
  "testEnvironment": "node",
  "testTimeout": 30000,
  "maxWorkers": 1,
  "forceExit": true
}
```

### Environment Variables

Required for tests:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/test_db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="test-jwt-secret"
NODE_ENV=test
```

## 🤖 CI/CD Integration

### GitHub Actions Workflow

Located at `.github/workflows/api-testing.yml`

**Triggers**:

- Push to `main` or `develop` branches
- Pull requests
- Daily at 2 AM UTC
- Manual dispatch

**Steps**:

1. ✅ Setup PostgreSQL & Redis containers
2. ✅ Install dependencies
3. ✅ Run database migrations
4. ✅ Execute all E2E tests
5. ✅ Upload test reports as artifacts
6. ✅ Generate test summary in PR comments

### Viewing CI Results

1. Go to **Actions** tab in GitHub
2. Select latest **Automated API Testing** workflow
3. View test summary in workflow output
4. Download test reports from **Artifacts** section

## 📝 Writing New Tests

### Example: Add New Endpoint Test

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { ErrorAnalyzer } from '../../utils/error-analyzer';
import { ProgressTracker } from '../../utils/progress-tracker';

describe('New Endpoint - Automated Testing', () => {
  let app: INestApplication;
  let errorAnalyzer: ErrorAnalyzer;
  let progressTracker: ProgressTracker;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    errorAnalyzer = new ErrorAnalyzer();
    progressTracker = new ProgressTracker('module-name');
  });

  afterAll(async () => {
    await progressTracker.generateReport();
    await app.close();
  });

  it('Should test endpoint successfully', async () => {
    const startTime = Date.now();

    const response = await request(app.getHttpServer())
      .get('/api/v1/endpoint')
      .expect(200);

    const responseTime = Date.now() - startTime;

    expect(response.body).toHaveProperty('data');

    progressTracker.recordSuccess('GET /endpoint', responseTime, 'Test description');
  });

  it('Should handle errors with intelligent detection', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/endpoint')
      .expect(400);

    if (response.status !== 400) {
      const diagnosis = await errorAnalyzer.analyze(response, {
        expectedStatus: 400,
        endpoint: '/api/v1/endpoint',
        testCase: 'Error scenario',
      });
      progressTracker.recordFailure('GET /endpoint', diagnosis);
    } else {
      progressTracker.recordSuccess('GET /endpoint', 0, 'Error handled correctly');
    }
  });
});
```

## 🐛 Troubleshooting

### Tests Failing

1. **Check database connection**

   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

2. **Verify environment variables**

   ```bash
   # Check .env file has all required variables
   cat .env
   ```

3. **Clear test data**
   ```bash
   npx prisma migrate reset --force
   ```

### Slow Tests

1. **Increase test timeout** in `jest-e2e.json`:

   ```json
   {
     "testTimeout": 60000
   }
   ```

2. **Run tests sequentially**:
   ```bash
   npm run test:e2e -- --runInBand
   ```

### CI/CD Failures

1. **Check GitHub Actions logs** for specific error
2. **Verify Docker containers** started correctly
3. **Check database migrations** applied successfully

## 📚 Additional Resources

- **Full Documentation**: `docs/testing/API_AUTOMATED_TESTING_PLAN.md`
- **GitHub Actions**: `.github/workflows/api-testing.yml`
- **Postman Collections**: `postman/` directory
- **NestJS Testing Guide**: https://docs.nestjs.com/fundamentals/testing

## 🤝 Contributing

When adding new tests:

1. ✅ Follow the existing test structure
2. ✅ Use `ErrorAnalyzer` for error detection
3. ✅ Use `ProgressTracker` for recording results
4. ✅ Add test data to `fixtures/` directory
5. ✅ Update this README with new test counts
6. ✅ Run tests locally before committing

## 📧 Support

For issues or questions:

- Create an issue in GitHub repository
- Check existing test examples in `test/e2e/`
- Review full documentation in `docs/testing/`

---

**Last Updated**: November 7, 2025  
**Total Tests**: 129+ automated test scenarios  
**Coverage**: 20 critical API endpoints  
**Status**: Production Ready ✅
