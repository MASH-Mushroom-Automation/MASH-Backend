# MASH-Backend - AI Coding Agent Guide

**NestJS 11 + Prisma 6 + PostgreSQL | E-commerce + IoT Platform**  
**Production**: Railway | **Stack**: NestJS + Prisma + Redis + MQTT + Monitoring (Jaeger/Prometheus/Grafana)

## Quick Start (Windows)

```bash
npm install --legacy-peer-deps  # REQUIRED - fixes peer dependency conflicts
npx prisma generate             # REQUIRED - generates Prisma client
npm run start:dev               # http://localhost:4000
```

**Essential `.env`** (minimum required):
```env
PORT=4000
DATABASE_URL="postgresql://user:pass@host/db"
JWT_SECRET="32-char-secret-min-32-chars"
NODE_ENV="development"
```
Full template: `.env.example` | See [README.md](../README.md) for monitoring setup

## Critical Architecture Patterns

### 1. Lazy-Loaded Prisma Client (Windows DLL Fix)
**Why**: Static import loads native query engine DLL at parse time → crashes Windows dev environment  
**Pattern**: Dynamic import in `PrismaService.initializeClient()` defers DLL loading to runtime  
**Location**: [src/database/prisma.service.ts](../src/database/prisma.service.ts)
```typescript
// ✅ ALWAYS inject PrismaService (never create raw PrismaClient)
constructor(private readonly prisma: PrismaService) {}

// ❌ NEVER do this - crashes Windows during module initialization
import { PrismaClient } from '@prisma/client';
const client = new PrismaClient();

// ✅ Services auto-connect lazily via ensureConnected()
async findUser(id: string) {
  await this.prisma.ensureConnected(); // Optional: already called by onModuleInit
  return this.prisma.user.findUnique({ where: { id } });
}
```

### 2. Graceful Redis Degradation (Optional Dependency)
**Why**: App must function without Redis for dev environments & Railway deployment flexibility  
**Pattern**: All `RedisService` methods return `null`/`false` when unavailable → services handle fallback  
**Location**: [src/database/redis.service.ts](../src/database/redis.service.ts)
```typescript
// Cache-aside pattern with graceful degradation
async findWithCache(id: string) {
  const cached = await this.redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);
  
  const user = await this.prisma.user.findUnique({ where: { id } });
  await this.redis.set(`user:${id}`, JSON.stringify(user), 300); // 5min TTL, silent fail OK
  return user;
}
```

### 3. Authentication & Authorization Stack
**Guards**: Applied at controller-level by default (see [src/main.ts](../src/main.ts))  
**Decorators**: [src/common/decorators/](../src/common/decorators/)
```typescript
// Default: All endpoints require JWT auth unless marked @Public()
@Controller('products')
@ApiTags('Products')
export class ProductsController {
  
  @Public() // Skip auth for this endpoint only
  @Get('public')
  getPublicProducts() {}
  
  @Roles('ADMIN', 'SUPER_ADMIN') // Role-based access (UPPERCASE enum values)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  deleteProduct(@Param('id') id: string) {}
}
```
**User Roles**: `USER`, `GROWER`, `BUYER`, `ADMIN`, `SUPER_ADMIN` (defined in Prisma schema)

### 4. Observability & Monitoring (Enterprise-Grade)
**Stack**: Jaeger (tracing) + Prometheus (metrics) + Grafana (dashboards) + Alertmanager (alerts)  
**Start**: `docker compose -f docker-compose.dev.yml up -d`  
**Access**: Grafana at http://localhost:4000 (admin/admin)  
**Metrics**: `GET /metrics` (Prometheus format), `GET /api/v1/health` (health checks)

```typescript
// OpenTelemetry tracing pattern (see src/monitoring/tracing/)
import { trace, SpanStatusCode } from '@opentelemetry/api';

async processOrder(orderId: string) {
  const tracer = trace.getTracer('order-service');
  return tracer.startActiveSpan('OrderService.processOrder', async (span) => {
    try {
      span.setAttributes({ 'order.id': orderId, 'user.id': userId });
      const result = await this.orderRepository.process(orderId);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

## Module Development Pattern

**Standard Structure** (`src/modules/<feature>/`):
```
feature/
├── feature.module.ts       # @Module() with imports/exports
├── feature.controller.ts   # @Controller() + @ApiTags() for Swagger
├── feature.service.ts      # Business logic, inject PrismaService
├── feature.spec.ts         # Unit tests (Jest)
└── dto/                    # class-validator DTOs for input validation
    ├── create-feature.dto.ts
    └── update-feature.dto.ts
```

**Controller Pattern** (see [src/modules/products/products.controller.ts](../src/modules/products/products.controller.ts)):
```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Products') // Groups endpoints in Swagger UI
@Controller('products')
@UseGuards(JwtAuthGuard) // Default: all endpoints require auth
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public() // Override: public endpoint
  @Get()
  @ApiOperation({ summary: 'Get all products' })
  findAll() {
    return this.productsService.findAll();
  }

  @Roles('ADMIN') // Require ADMIN role
  @UseGuards(RolesGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  create(@Body() createDto: CreateProductDto) {
    return this.productsService.create(createDto);
  }
}
```

## Database Operations

```typescript
// Transactions with retry logic (see PrismaService.executeTransaction)
await this.prisma.executeTransaction(async (tx) => {
  await tx.order.create({ data: orderData });
  await tx.product.update({ where: { id }, data: { stock: { decrement: 1 } } });
}, 3); // max 3 retries with exponential backoff

// Lazy connection pattern (auto-connects on first query)
await this.prisma.ensureConnected(); // Explicit connection
const users = await this.prisma.user.findMany(); // Auto-connects if not connected

// Query timeout wrapper (configured via DATABASE_QUERY_TIMEOUT_MS env)
const result = await this.prisma.withTimeout(
  this.prisma.product.findMany({ where: { active: true } }),
  'findMany products',
  5000 // Optional: custom timeout in ms
);
```

## Error Handling Convention

**ALWAYS use NestJS exceptions** (never `throw new Error()`):
```typescript
import { 
  NotFoundException, 
  ConflictException, 
  BadRequestException,
  UnauthorizedException,
  ForbiddenException
} from '@nestjs/common';

// HTTP 404
throw new NotFoundException(`Product with ID ${id} not found`);

// HTTP 409 (unique constraint violations)
throw new ConflictException('Email already exists');

// HTTP 400 (validation errors)
throw new BadRequestException('Invalid input data');

// HTTP 401 (authentication required)
throw new UnauthorizedException('Invalid credentials');

// HTTP 403 (insufficient permissions)
throw new ForbiddenException('ADMIN role required');
```
**Why**: Global exception filters ([src/common/filters/](../src/common/filters/)) transform these into standardized API responses

## IoT Device Management Patterns

```typescript
// Device command pattern
const command = await this.prisma.deviceCommand.create({
  data: {
    deviceId,
    command: 'RESTART',
    parameters: { force: true },
    status: 'pending'
  }
});

// Sensor data aggregation
const sensorData = await this.prisma.sensorData.groupBy({
  by: ['type'],
  where: { deviceId, timestamp: { gte: startDate } },
  _avg: { value: true },
  _count: true
});
```

## Alert & Notification System

```typescript
// Alert rule creation
const alertRule = await this.prisma.alertRule.create({
  data: {
    name: 'High Temperature',
    eventType: 'sensor.temperature',
    condition: { threshold: 30, operator: 'gt' },
    priority: 'HIGH'
  }
});

// Notification templates
const notification = await this.prisma.notification.create({
  data: {
    userId,
    channel: 'EMAIL',
    subject: 'Alert: High Temperature',
    body: template.body,
    templateId: template.id
  }
});
```

## Queue Processing (BullMQ)

```typescript
// Job creation
const job = await this.queue.add('process-order', {
  orderId,
  userId
}, {
  delay: 5000, // 5 second delay
  priority: 1
});

// Job processing
@Process('process-order')
async handleProcessOrder(job: Job<ProcessOrderData>) {
  const { orderId } = job.data;
  // Process order logic
}
```

## Import/Export Operations

```typescript
// Bulk import with error tracking
const job = await this.prisma.importExportJob.create({
  data: {
    type: 'IMPORT',
    entityType: 'PRODUCT',
    fileFormat: 'CSV',
    totalRecords: records.length,
    status: 'PROCESSING'
  }
});

// Error logging
await this.prisma.importExportError.create({
  data: {
    jobId: job.id,
    rowNumber: i + 1,
    errorType: 'VALIDATION',
    message: `Invalid price: ${price}`
  }
});
```

## Lalamove Delivery Integration

```typescript
// Quotation request
const quotation = await this.lalamoveService.createQuotation({
  serviceType: 'MOTORCYCLE',
  stops: [pickup, delivery],
  isScheduled: false
});

// Order placement
const order = await this.lalamoveService.placeOrder(quotation.id, {
  driverId: selectedDriver,
  isPODEnabled: true
});
```

## ESM/CommonJS Compatibility

Project uses **CommonJS** (`tsconfig.json: "module": "commonjs"`). Avoid ESM-only packages:
```typescript
// ❌ uuid v9+ is ESM-only - DO NOT UPGRADE
import { v4 } from 'uuid';

// ✅ Use Node.js built-in crypto instead
import { randomUUID } from 'crypto';
const id = randomUUID();
```
**Why**: NestJS build pipeline requires CommonJS. ESM migration blocked until NestJS 12+.

## Build Verification (ALWAYS before commit)

```bash
npm run build    # Must pass - Railway deploys fail otherwise
npm run lint     # Check linting (ESLint + Prettier)
npm test         # Run unit tests (85% coverage required)
```
**CI/CD**: See [.github/workflows/ci.yml](../.github/workflows/ci.yml) for full pipeline

## Production Deployment Critical Issues

### Email Service (CRITICAL)
**Problem**: Railway blocks SMTP port 587 → Gmail emails timeout (408)
**Solution**: Use SendGrid API (free 100 emails/day)
```bash
# Railway Backend Variables:
SENDGRID_API_KEY=SG.your-key-here
EMAIL_FROM=noreply@your-domain.com
```
**Implementation**: See `SENDGRID_QUICK_SETUP.md` for step-by-step guide

### Redis Connection (HIGH PRIORITY)
**Graceful Degradation**: App continues if Redis unavailable
- `RedisService` returns `null`/`false` when disconnected
- Rate limiting uses in-memory fallback
- Remove `REDIS_URL` if Upstash quota exceeded

### Environment Variables Checklist
```env
# Railway Backend Production:
DATABASE_URL=postgresql://...          # Neon pooled connection
JWT_SECRET=<32-char-random-string>    # NOT "change-this"
CORS_ORIGINS=https://your-frontend-domain.com
NODE_ENV=production
SENDGRID_API_KEY=SG.xxx               # Email service
# REDIS_URL=redis://...                # Optional - gracefully degrades
```

### CORS Testing
```powershell
# Verify frontend domain allowed:
$response = Invoke-WebRequest -Uri "https://your-backend.railway.app/api/v1/auth/register" `
  -Method OPTIONS `
  -Headers @{"Origin"="https://your-frontend.railway.app"}
$response.Headers["Access-Control-Allow-Origin"]  # Should match frontend
```

## Essential Commands

| Task | Command |
|------|---------|
| Dev server | `npm run start:dev` |
| Schema change | `npx prisma migrate dev --name <name>` then `npx prisma generate` |
| DB GUI | `npx prisma studio` |
| API docs | http://localhost:4000/api/docs (Swagger) |
| Monitoring | `docker compose -f docker-compose.dev.yml up -d` |
| API tests | `npm run postman:test` |
| Unit tests | `npm test` |
| E2E tests | `npm run test:e2e` |

## Key Files & Entry Points

**Application Bootstrap**: [src/main.ts](../src/main.ts)
- 9-stage initialization pipeline (CORS → security → middleware → exception filters)
- Swagger config at `/api/docs`
- Global prefix: `/api/v1` (excludes auth HTML pages & `/metrics`)
- Health check: `/api/v1/health`

**Database Layer**:
- **Schema**: [prisma/schema.prisma](../prisma/schema.prisma) - 50+ models (User, Product, Order, Device, Sensor, etc.)
- **Service**: [src/database/prisma.service.ts](../src/database/prisma.service.ts) - lazy-loaded client with query monitoring
- **Redis**: [src/database/redis.service.ts](../src/database/redis.service.ts) - graceful degradation

**Common Utilities**: [src/common/](../src/common/)
- Guards: `jwt-auth.guard.ts`, `roles.guard.ts`
- Decorators: `@Public()`, `@Roles()`, `@CurrentUser()`, `@AuditLog()`
- Filters: Exception filters for Prisma, HTTP, validation errors
- Interceptors: Logging, caching, field selection, audit logging

**Testing**: [test/](../test/)
- E2E: `test/e2e/**/*.e2e-spec.ts` (uses test database)
- Unit: `src/**/*.spec.ts` (85% coverage target)
- Load: `test/k6/**/*.js` (k6 performance tests)
- API: [postman/](../postman/) (Newman collections)

**Docker/Monitoring**: [docker-compose.dev.yml](../docker-compose.dev.yml)
- PostgreSQL, Redis, MQTT, Prometheus, Grafana, Jaeger, Loki, Alertmanager

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot find module` | `rmdir /s /q node_modules dist && npm install --legacy-peer-deps` |
| Prisma type errors | `npx prisma generate` |
| Port 4000 in use | `netstat -ano \| findstr :4000` then `taskkill /PID <PID> /F` |
| Redis unavailable | App continues gracefully (by design) |
| Build fails | Check TypeScript errors, ensure all imports are correct |

## Security Features

- **CSRF Protection**: Enabled on state-changing endpoints
- **Rate Limiting**: Redis-backed distributed rate limiting
- **Helmet Security Headers**: OWASP-recommended headers
- **Input Sanitization**: Automatic HTML sanitization
- **Audit Logging**: All sensitive operations logged
- **Multi-factor Authentication**: TOTP support
- **API Key Management**: Scoped API keys with usage tracking

## Performance Patterns

- **Caching**: Redis cache-aside pattern with TTL
- **Field Selection**: GraphQL-like field selection for 40-60% response size reduction
- **Connection Pooling**: Prisma connection pooling for PostgreSQL
- **Query Optimization**: N+1 query elimination with transactions
- **Background Jobs**: BullMQ for CPU-intensive tasks
- **Health Checks**: Comprehensive health monitoring (@nestjs/terminus)
