## MASH-Backend — Comprehensive Instructions for AI Coding Agents

**Purpose**: Provide AI agents with complete, high-value context to be immediately productive in this repository.

---

## 📋 Table of Contents
1. [Project Architecture](#architecture)
2. [Development Workflow](#development)
3. [Code Conventions](#conventions)
4. [Testing Strategy](#testing)
5. [Deployment & Infrastructure](#deployment)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture {#architecture}

### Tech Stack
- **Framework**: NestJS 10.x (TypeScript-first Node.js framework)
- **Database**: PostgreSQL 15+ via Prisma ORM 5.x
- **Cache**: Redis 7.x (Upstash/local) via `ioredis`
- **Authentication**: Clerk + JWT + Passport
- **Real-time**: Socket.IO WebSockets
- **Monitoring**: Prometheus + Grafana + Jaeger + OpenTelemetry
- **Task Queue**: Bull (Redis-backed)
- **Email**: SendGrid/Nodemailer
- **Storage**: AWS S3 (via `@aws-sdk/client-s3`)
- **Notifications**: Firebase Cloud Messaging, Twilio SMS

### Project Structure
```
src/
├── main.ts                      # Entry point (bootstrap application)
├── app.module.ts                # Root module (imports all feature modules)
├── app.controller.ts            # Root controller (health, info endpoints)
├── common/                      # Shared utilities
│   ├── decorators/              # Custom decorators (@Public, @Roles, @Cache)
│   ├── filters/                 # Exception filters (HTTP, Prisma, Validation)
│   ├── guards/                  # Route guards (Auth, Roles, Throttle)
│   ├── interceptors/            # Request/response interceptors (Cache, AuditLog, Transform)
│   ├── middleware/              # Express middleware (CORS, CSRF, Logger, Security)
│   ├── pipes/                   # Validation pipes (ParseInt, ValidateDto)
│   ├── utils/                   # Helper functions (logger, encryption, date)
│   └── storage/                 # Storage adapters (Redis throttler, file upload)
├── config/                      # Configuration files
│   ├── helmet.config.ts         # Security headers config
│   ├── cors.config.ts           # CORS policy config
│   ├── compression.config.ts    # Response compression config
│   └── rate-limit.config.ts     # Rate limiting config
├── database/                    # Database services
│   ├── prisma.service.ts        # Prisma client wrapper (connection, transactions, logging)
│   └── redis.service.ts         # Redis client wrapper (get, set, del, patterns)
├── modules/                     # Feature modules
│   ├── auth/                    # Authentication & authorization
│   ├── users/                   # User management
│   ├── orders/                  # Order processing
│   ├── products/                # Product catalog
│   ├── sellers/                 # Seller management
│   ├── buyers/                  # Buyer management
│   ├── categories/              # Product categories
│   ├── notifications/           # Email, SMS, Push notifications
│   ├── devices/                 # IoT device management (MQTT)
│   ├── queues/                  # Background job processing
│   ├── websocket/               # Real-time WebSocket connections
│   ├── cms/                     # Content management
│   ├── payments/                # Payment gateway integration
│   └── health/                  # Health check endpoints
├── monitoring/                  # Observability
│   ├── prometheus/              # Prometheus metrics service
│   └── tracing.ts               # OpenTelemetry distributed tracing
└── types/                       # TypeScript type definitions

prisma/
├── schema.prisma                # Database schema (single source of truth)
├── migrations/                  # Database migrations (versioned)
└── seed.ts                      # Database seeding script

test/
├── jest-e2e.json                # E2E test configuration
├── k6/                          # Load testing scripts (k6)
└── app.e2e-spec.ts              # E2E test suite

docs/
├── monitoring/                  # Monitoring documentation
│   ├── README.md                # Monitoring system overview
│   ├── MONITORING_GUIDE.md      # Developer guide
│   ├── ALERTMANAGER_SETUP.md    # Alert configuration
│   └── MONITORING_ARCHITECTURE.md # System architecture
├── WINDOWS_QUICK_START.md       # Windows setup guide
└── BUILD_FIXES_SUMMARY.md       # Build troubleshooting

postman/
└── *.postman_collection.json    # API collections for testing
```

### Module Architecture Pattern
Each feature module follows this structure:
```
src/modules/feature/
├── feature.module.ts            # Module definition (imports, providers, exports)
├── feature.controller.ts        # REST API endpoints (@Controller, @Get, @Post, etc.)
├── feature.service.ts           # Business logic (injectable service)
├── feature.spec.ts              # Unit tests
├── dto/                         # Data Transfer Objects
│   ├── create-feature.dto.ts    # Request validation (class-validator)
│   ├── update-feature.dto.ts    # Partial update DTO
│   └── query-feature.dto.ts     # Query parameters DTO
├── entities/                    # Domain entities (if not using Prisma models)
├── guards/                      # Feature-specific guards
├── interfaces/                  # TypeScript interfaces
└── services/                    # Sub-services (e.g., email, storage)
```

### Database Layer
- **ORM**: Prisma (type-safe database client)
- **Connection**: `PrismaService` in `src/database/prisma.service.ts`
  - Singleton connection pool
  - Auto-reconnect on failure
  - Query logging (slow queries >1s)
  - Transaction helpers: `executeTransaction()`
  - Query stats: `getQueryStats()`
- **Migrations**: `prisma/migrations/` (never edit manually)
- **Schema**: `prisma/schema.prisma` (single source of truth)

### Cache Layer
- **Client**: `RedisService` in `src/database/redis.service.ts`
  - Methods: `get<T>()`, `set<T>()`, `delete()`, `deletePattern()`, `increment()`, `getTTL()`
  - Graceful degradation if Redis unavailable
  - Automatic JSON serialization/deserialization
  - TTL support (default 5 minutes)
- **Use Cases**: 
  - API response caching
  - Session storage
  - Rate limiting (via `RedisThrottlerStorage`)
  - Distributed locks

### Observability Stack
- **Metrics**: Prometheus (scraped from `/metrics` endpoint every 15s)
  - 60+ custom metrics (HTTP, DB, Cache, Business, Security, System)
  - Metric types: Counter, Gauge, Histogram
  - Service: `PrometheusService` in `src/monitoring/prometheus/`
- **Tracing**: Jaeger + OpenTelemetry
  - Auto-instrumentation for HTTP, Express, NestJS
  - Custom spans in business logic
  - Service: initialized in `src/monitoring/tracing.ts`
- **Logging**: Winston custom logger (`src/common/utils/logger.util.ts`)
  - Correlation IDs for request tracking
  - Structured JSON logs in production
  - Console logs in development
- **Health Checks**: Terminus (`@nestjs/terminus`)
  - Database health: `PrismaHealthIndicator`
  - Cache health: `RedisHealthIndicator`
  - Memory health: `MemoryHealthIndicator`
  - Endpoints: `/api/v1/health`, `/api/v1/health/ready`, `/api/v1/health/live`

---

## 💻 Development Workflow {#development}



### Initial Setup (First Time)
```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your configuration
# Required: DATABASE_URL, REDIS_URL, JWT_SECRET
# Optional: CLERK_*, SENDGRID_*, TWILIO_*, FIREBASE_*, AWS_*

# 4. Generate Prisma client
npx prisma generate

# 5. Run database migrations
npx prisma migrate dev

# 6. Seed database (optional)
npm run db:seed

# 7. Start development server
npm run start:dev
```

### Daily Development Commands
```bash
# Start dev server (hot reload)
npm run start:dev

# Build for production
npm run build

# Start production server
npm run start:prod

# Run all tests (unit, integration, e2e)
npm run test:all

# Run unit tests
npm run test

# Run unit tests in watch mode
npm run test:watch

# Run e2e tests
npm run test:e2e

# Run tests with coverage
npm run test:cov

# Lint code
npm run lint

# Format code
npm run format

# Type check without emitting
npm run type-check
```

### Database Commands
```bash
# Generate Prisma client (after schema changes)
npx prisma generate

# Create migration (development)
npx prisma migrate dev --name <migration_name>

# Apply migrations (production)
npx prisma migrate deploy

# Push schema changes without migration (development only)
npx prisma db push

# Seed database
npm run db:seed

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Docker Commands
```bash
# Start all services (backend + monitoring stack)
docker-compose -f docker-compose.dev.yml up -d

# Start specific service
docker-compose -f docker-compose.dev.yml up -d postgres

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes (fresh start)
docker-compose -f docker-compose.dev.yml down -v

# Rebuild and start
docker-compose -f docker-compose.dev.yml up --build
```

### Monitoring Access
```bash
# Grafana Dashboard
open http://localhost:4000
# Login: admin/admin

# Prometheus Metrics
open http://localhost:9090

# Jaeger Tracing
open http://localhost:16686

# Alertmanager
open http://localhost:9093

# Backend Metrics
curl http://localhost:3000/metrics

# Health Check
curl http://localhost:3000/api/v1/health
```

### API Testing
```bash
# Run all Postman collections
npm run postman:test

# Run specific collection
npx newman run postman/01-Authentication-API.postman_collection.json

# Open Swagger UI
open http://localhost:3000/api/docs
```

### Load Testing
```bash
# Windows
test\k6\run-all-tests.bat

# Linux/Mac
./test/k6/run-all-tests.sh

# Run specific test
k6 run test/k6/auth-load-test.js
```

---

## 📝 Code Conventions {#conventions}



### Module Structure
- **One feature = one module**: Each business domain gets its own module in `src/modules/`
- **Standard files**: `module.ts`, `controller.ts`, `service.ts`, `*.spec.ts`
- **DTOs in `dto/` folder**: Input validation with `class-validator`
- **Entities/Interfaces**: Use Prisma models when possible, custom entities only when needed

### Naming Conventions
- **Files**: kebab-case (`user-profile.service.ts`)
- **Classes**: PascalCase (`UserProfileService`)
- **Interfaces**: PascalCase with `I` prefix optional (`IUserProfile` or `UserProfile`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)
- **Variables/Functions**: camelCase (`getUserProfile`)
- **Test files**: `*.spec.ts` for unit tests, `*.e2e-spec.ts` for e2e tests

### Import Organization
```typescript
// 1. Node.js built-ins
import { join } from 'path';

// 2. External packages
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// 3. Internal absolute imports (use @ alias)
import { PrismaService } from '@/database/prisma.service';
import { CustomLogger } from '@/common/utils/logger.util';

// 4. Relative imports (same module)
import { CreateUserDto } from './dto/create-user.dto';
```

### Service Patterns

#### Database Access
```typescript
// ✅ CORRECT: Use PrismaService
@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}
  
  async findUser(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
  
  // Use executeTransaction for multi-step operations
  async createUserWithProfile(data: CreateUserDto) {
    return this.prisma.executeTransaction(async (tx) => {
      const user = await tx.user.create({ data: userData });
      const profile = await tx.profile.create({ data: profileData });
      return { user, profile };
    });
  }
}

// ❌ WRONG: Don't create new Prisma instances
const prisma = new PrismaClient(); // Never do this
```

#### Caching Pattern
```typescript
// ✅ CORRECT: Use RedisService
@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}
  
  async getProduct(id: string) {
    // Try cache first
    const cached = await this.redis.get<Product>(`product:${id}`);
    if (cached) return cached;
    
    // Fetch from DB
    const product = await this.prisma.product.findUnique({ where: { id } });
    
    // Cache for 5 minutes
    await this.redis.set(`product:${id}`, product, 300);
    return product;
  }
  
  // Clear cache on update
  async updateProduct(id: string, data: UpdateProductDto) {
    const updated = await this.prisma.product.update({ where: { id }, data });
    await this.redis.delete(`product:${id}`);
    return updated;
  }
}
```

#### Error Handling
```typescript
// ✅ CORRECT: Use NestJS exceptions
import { NotFoundException, BadRequestException } from '@nestjs/common';

async getUser(id: string) {
  const user = await this.prisma.user.findUnique({ where: { id } });
  
  if (!user) {
    throw new NotFoundException(`User with ID ${id} not found`);
  }
  
  return user;
}

// ❌ WRONG: Don't throw generic errors
throw new Error('User not found'); // Never do this
```

#### Logging Pattern
```typescript
// ✅ CORRECT: Use Logger
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  
  async createOrder(data: CreateOrderDto) {
    this.logger.log(`Creating order for user ${data.userId}`);
    
    try {
      const order = await this.prisma.order.create({ data });
      this.logger.log(`Order created successfully: ${order.id}`);
      return order;
    } catch (error) {
      this.logger.error(`Failed to create order: ${error.message}`, error.stack);
      throw error;
    }
  }
}
```

### Controller Patterns

#### Standard CRUD Controller
```typescript
@Controller('users')
@ApiTags('Users')
export class UserController {
  constructor(private userService: UserService) {}
  
  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async findAll(@Query() query: QueryUserDto) {
    return this.userService.findAll(query);
  }
  
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }
  
  @Post()
  @ApiOperation({ summary: 'Create new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(@Body() createDto: CreateUserDto) {
    return this.userService.create(createDto);
  }
  
  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateUserDto) {
    return this.userService.update(id, updateDto);
  }
  
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user' })
  async remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
```

#### Authentication & Guards
```typescript
// Public endpoint (skip auth)
@Post('login')
@Public()
@ApiOperation({ summary: 'User login' })
async login(@Body() loginDto: LoginDto) {
  return this.authService.login(loginDto);
}

// Protected endpoint (requires auth)
@Get('profile')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Get current user profile' })
async getProfile(@Request() req) {
  return this.userService.findOne(req.user.id);
}

// Role-based access
@Delete(':id')
@Roles('ADMIN', 'SUPER_ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiOperation({ summary: 'Delete user (Admin only)' })
async deleteUser(@Param('id') id: string) {
  return this.userService.remove(id);
}

// Rate limiting (custom per endpoint)
@Post('send-email')
@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 requests per minute
async sendEmail(@Body() emailDto: SendEmailDto) {
  return this.emailService.send(emailDto);
}
```

### DTO Patterns

#### Input Validation
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;
  
  @ApiProperty({
    example: 'John',
    description: 'User first name',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;
  
  @ApiProperty({
    example: 'SecurePass123!',
    description: 'User password (min 8 chars, must include number and special char)',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[0-9])(?=.*[!@#$%^&*])/, {
    message: 'Password must contain at least one number and one special character',
  })
  password: string;
  
  @ApiProperty({
    example: '09171234567',
    description: 'Philippine mobile number',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^(09|\+639)\d{9}$/, {
    message: 'Invalid Philippine mobile number',
  })
  phoneNumber?: string;
}
```

#### Update DTOs
```typescript
import { PartialType } from '@nestjs/swagger';

// Automatically makes all fields optional
export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

### Testing Patterns

#### Unit Test Template
```typescript
describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();
    
    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);
  });
  
  describe('findOne', () => {
    it('should return a user', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      
      const result = await service.findOne('1');
      
      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
    });
    
    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      
      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });
});
```

### Monitoring & Observability

#### Add Custom Metrics
```typescript
import { PrometheusService } from '@/monitoring/prometheus/prometheus.service';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private prometheus: PrometheusService,
  ) {}
  
  async createOrder(data: CreateOrderDto) {
    const order = await this.prisma.order.create({ data });
    
    // Record business metric
    this.prometheus.recordOrder(order.id, order.status);
    
    return order;
  }
}
```

#### Add Custom Tracing Spans
```typescript
import { trace } from '@opentelemetry/api';

@Injectable()
export class PaymentService {
  private tracer = trace.getTracer('payment-service');
  
  async processPayment(orderId: string, amount: number) {
    // Create custom span
    return await this.tracer.startActiveSpan('processPayment', async (span) => {
      try {
        span.setAttribute('order.id', orderId);
        span.setAttribute('payment.amount', amount);
        
        const result = await this.externalPaymentGateway.charge(amount);
        
        span.setAttribute('payment.status', result.status);
        return result;
      } catch (error) {
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

---

## 🧪 Testing Strategy {#testing}



### Test Organization
- **Unit tests**: `*.spec.ts` files co-located with source code
- **E2E tests**: `test/**/*.e2e-spec.ts` files
- **Test data**: Mock data in `test/fixtures/`
- **Test utilities**: Shared helpers in `test/utils/`

### Running Tests
```bash
# Run all tests (unit, integration, e2e)
npm run test:all

# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e

# Run specific test file
npm run test -- user.service.spec.ts

# Run tests matching pattern
npm run test -- --testNamePattern="should create user"
```

### Test Coverage Requirements
- **Minimum coverage**: 80% overall
- **Critical paths**: 90%+ (auth, payments, orders)
- **New code**: Must include tests
- **Bug fixes**: Add regression test

---

## 🚀 Deployment & Infrastructure {#deployment}

### Environment Variables

#### Required for all environments
- `DATABASE_URL`: PostgreSQL connection string (Neon with connection pooling)
  - Format: `postgresql://user:pass@host/db?sslmode=require&connection_limit=3&pool_timeout=20`
- `DIRECT_URL`: Direct PostgreSQL connection (bypasses pooler for migrations)
- `JWT_SECRET`: Secret for JWT signing (min 32 chars, generate: `openssl rand -hex 32`)
- `NODE_ENV`: `development` | `production` | `test`
- `PORT`: Application port (default: 3000)

#### Cache & Performance (Critical for production)
- `REDIS_URL`: Redis connection string (Upstash Cloud Redis)
  - Format: `rediss://default:password@host:6379`
  - **Impact**: 85-90% cache hit rate, 5x throughput increase
- `CACHE_ENABLED`: Enable caching layer (default: true)
- `CACHE_TTL_*`: TTL values for different resources (products, categories, analytics)
- `THROTTLE_LIMIT_*`: Role-based rate limiting (super_admin: 10k, admin: 1k, user: 100 req/min)

#### Authentication & Security
- `CLERK_ENABLED`: Enable Clerk authentication (default: false for testing)
- `CLERK_SECRET_KEY`: Clerk API key (optional)
- `FIREBASE_*`: Firebase Admin SDK credentials (for push notifications)
- `SESSION_DURATION`: JWT token expiry (default: 7d)
- `REFRESH_TOKEN_DURATION`: Refresh token expiry (default: 30d)
- `MAX_SESSIONS_PER_USER`: Concurrent session limit (default: 5)

#### External Services
- `EMAIL_*` / `SENDGRID_API_KEY`: Email notifications (Gmail SMTP or SendGrid)
- `TWILIO_*`: SMS notifications (trial account works)
- `AWS_*`: AWS S3 for file storage and exports
- `ELASTICSEARCH_NODE`: Search engine endpoint (optional, Issue #28)
- `MQTT_BROKER_URL`: IoT device communication (optional)

#### Monitoring & Observability
- `METRICS_ENABLED`: Enable Prometheus metrics (default: true)
- `OTEL_ENABLED`: Enable OpenTelemetry tracing (default: false for local dev)
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OTLP collector endpoint (default: `http://jaeger:4318/v1/traces`)
- `LOG_LEVEL`: Winston log level (development: debug, production: info)

#### WebSocket Configuration (Issue #9)
- `WS_PORT`: WebSocket server port (default: 3000, same as HTTP)
- `WS_CORS_ORIGIN`: Comma-separated list of allowed origins
- `WS_PING_TIMEOUT`: Disconnect timeout (default: 60000ms)
- `WS_REDIS_ADAPTER_ENABLED`: Enable Redis adapter for horizontal scaling (default: false)

#### Import/Export System (Issue #30)
- `MAX_FILE_SIZE`: Maximum file upload size (default: 52428800 = 50MB)
- `MAX_CONCURRENT_JOBS`: Parallel import/export jobs (default: 10)
- `FILE_RETENTION_DAYS`: Days to keep files (default: 30)
- `EXPORT_S3_BUCKET`: S3 bucket for analytics exports

### Production Deployment Checklist

#### Pre-deployment Security Checklist
```bash
# CRITICAL - Must change before production:
# [ ] JWT_SECRET - Generate: openssl rand -hex 32
# [ ] DATABASE_URL - Use production database with strong password
# [ ] REDIS_PASSWORD - Use managed service (Upstash/AWS ElastiCache)
# [ ] NODE_ENV=production
# [ ] LOG_LEVEL=info (not debug)
# [ ] CORS_ORIGINS - Only allow your production domain(s)
# [ ] All FIREBASE_* credentials are production keys
# [ ] Rotate all development secrets
```

#### Deployment Steps
```bash
# 1. Ensure all tests pass
npm run test:all

# 2. Build the application
npm run build

# 3. Run database migrations (uses DIRECT_URL, not pooled connection)
npx prisma migrate deploy

# 4. Start the application (includes automatic migration)
npm run start:prod:migrate

# 5. Verify health endpoint
curl http://localhost:3000/api/v1/health

# 6. Check metrics endpoint
curl http://localhost:3000/metrics

# 7. Verify WebSocket connection
# Open browser console and test: new WebSocket('ws://localhost:3000/ws')
```

#### Railway Deployment (Recommended Platform)
```bash
# See comprehensive guides:
# - Quick Start: docs/RAILWAY_QUICK_START.md
# - Complete Guide: docs/RAILWAY_DEPLOYMENT_GUIDE.md
# - Step-by-Step: RAILWAY_DEPLOY_NOW.md

# Key Railway configuration:
# 1. Use variable references: ${{service-name.VARIABLE_NAME}}
# 2. DATABASE_URL=${{postgres.DATABASE_PRIVATE_URL}}
# 3. REDIS_URL=${{redis.REDIS_PRIVATE_URL}}
# 4. Set CORS_ORIGINS to include Railway domain
# 5. Enable health checks: /api/v1/health
```

### Docker Deployment
```bash
# Build Docker image
docker build -t mash-backend:latest .

# Run with docker-compose (includes monitoring stack)
docker-compose -f docker-compose.dev.yml up -d

# Production deployment
docker-compose -f docker-compose.yml up -d
```

### CI/CD Pipeline
The `.github/workflows/ci.yml` workflow:
1. **Linting**: Runs ESLint and Prettier checks
2. **Type checking**: Validates TypeScript compilation
3. **Unit tests**: Runs Jest unit tests with coverage
4. **E2E tests**: Runs integration tests
5. **Database**: Generates Prisma client and applies migrations
6. **API tests**: Runs Newman/Postman collections
7. **Docker**: Builds and pushes Docker image (on main/develop branches)
8. **Health check**: Verifies `/api/v1/health` endpoint responds

**Important**: CI expects the application to be reachable at `http://localhost:3000/api/v1/health` during API tests. Keep this endpoint stable.

---

## 🔧 Common Tasks {#common-tasks}

### Performance Optimization Guidelines

This project has extensive performance optimizations implemented (Issue #24 - 94% complete):

#### Phase 1: Database Optimization (✅ 80% complete)
- Connection pooling: `connection_limit=3&pool_timeout=20` in DATABASE_URL
- Use `DIRECT_URL` for migrations (bypasses pooler)
- Index optimization: Always add `@@index([field])` for foreign keys
- Query optimization: Use Prisma's `include` sparingly, prefer `select`

#### Phase 2: Redis Caching (✅ 100% complete)
```typescript
// Cache pattern with TTL
async getCachedProduct(id: string) {
  const cached = await this.redis.get<Product>(`product:${id}`);
  if (cached) return cached;
  
  const product = await this.prisma.product.findUnique({ where: { id } });
  await this.redis.set(`product:${id}`, product, 600); // 10 min TTL
  return product;
}

// Cache invalidation on update
async updateProduct(id: string, data: UpdateProductDto) {
  const updated = await this.prisma.product.update({ where: { id }, data });
  await this.redis.delete(`product:${id}`);
  await this.redis.deletePattern(`products:*`); // Invalidate list caches
  return updated;
}
```

**Current Metrics**:
- Cache hit rate: 85-90% (exceeds 80% target)
- Throughput: 500-1000 req/s (5-10x improvement)
- P95 Latency: <150ms (5x reduction)
- Database load: -85% reduction

#### Phase 3: API Performance (✅ 90% complete)
- Response compression enabled via `compression` middleware
- 64% response size reduction
- Role-based rate limiting (see `THROTTLE_LIMIT_*` in .env)
- Pagination required for list endpoints (default: 20 items)

#### Phase 4: Monitoring (✅ 100% complete)
- Prometheus metrics: `/metrics` endpoint
- Custom business metrics: `PrometheusService.recordOrder()`, etc.
- Distributed tracing: OpenTelemetry + Jaeger
- Health checks: `/api/v1/health`, `/api/v1/health/ready`, `/api/v1/health/live`

#### Phase 5: Load Testing (✅ 100% complete)
```bash
# Run comprehensive load tests
.\test\k6\run-all-tests.bat  # Windows
./test/k6/run-all-tests.sh   # Linux/Mac

# Individual scenarios
k6 run test/k6/scenarios/basic-load.js
k6 run test/k6/scenarios/spike-test.js
k6 run test/k6/scenarios/stress-test.js
```

### Adding a New Module
```bash
# Generate module with NestJS CLI
nest g module modules/feature
nest g controller modules/feature
nest g service modules/feature

# Create DTOs
mkdir src/modules/feature/dto
touch src/modules/feature/dto/create-feature.dto.ts
touch src/modules/feature/dto/update-feature.dto.ts

# Create test file
touch src/modules/feature/feature.service.spec.ts
```

### Adding a New Database Table
```typescript
// 1. Update prisma/schema.prisma
model Feature {
  id        String   @id @default(cuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId])
  @@map("features")
}

// 2. Create and apply migration
npx prisma migrate dev --name add_feature_table

// 3. Generate Prisma client
npx prisma generate

// 4. Use in your service
const feature = await this.prisma.feature.create({ data });
```

### Adding a New API Endpoint
```typescript
// 1. Create DTO
export class CreateFeatureDto {
  @IsString()
  @ApiProperty()
  name: string;
}

// 2. Add controller method
@Post('features')
@ApiOperation({ summary: 'Create feature' })
@ApiResponse({ status: 201, description: 'Feature created' })
async createFeature(@Body() dto: CreateFeatureDto) {
  return this.featureService.create(dto);
}

// 3. Implement service method
async create(dto: CreateFeatureDto) {
  return this.prisma.feature.create({
    data: dto,
  });
}

// 4. Add tests
it('should create a feature', async () => {
  const dto = { name: 'Test Feature' };
  const result = await service.create(dto);
  expect(result.name).toBe('Test Feature');
});

// 5. Update Postman collection
// Add request to appropriate collection in postman/
```

### Adding Monitoring to New Code
```typescript
// 1. Add metrics in PrometheusService
private readonly featureCounter = new Counter({
  name: 'mash_features_total',
  help: 'Total features created',
  labelNames: ['status'],
});

recordFeature(status: string) {
  this.featureCounter.inc({ status });
}

// 2. Add tracing spans
const span = this.tracer.startSpan('createFeature');
try {
  span.setAttribute('feature.name', dto.name);
  const result = await this.create(dto);
  this.prometheus.recordFeature('success');
  return result;
} catch (error) {
  span.recordException(error);
  this.prometheus.recordFeature('error');
  throw error;
} finally {
  span.end();
}

// 3. Add alert rules (prometheus/alert.rules.yml)
- alert: HighFeatureErrorRate
  expr: rate(mash_features_total{status="error"}[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High error rate creating features"
```

---

## 🔥 Troubleshooting {#troubleshooting}

### Build Issues

**Problem**: `Cannot find module` errors
```bash
# Solution: Clean install
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

**Problem**: TypeScript compilation errors
```bash
# Solution: Check for syntax errors, rebuild
npm run type-check
npm run build
```

**Problem**: `dist/main.js` not found
```bash
# Solution: Build was configured incorrectly, fixed in tsconfig.build.json
# Ensure noEmit is set to false
npm run build
# Check dist folder exists
ls dist/main.js
```

### Database Issues

**Problem**: Prisma client out of sync
```bash
# Solution: Regenerate client
npx prisma generate
```

**Problem**: Migration conflicts
```bash
# Solution: Reset and recreate (DEVELOPMENT ONLY)
npx prisma migrate reset
npx prisma migrate dev
```

**Problem**: Connection errors
```bash
# Solution: Check DATABASE_URL in .env
# Format: postgresql://user:password@localhost:5432/database
# Verify database is running
docker-compose -f docker-compose.dev.yml up postgres
```

### Redis Issues

**Problem**: Redis connection refused
```bash
# Solution: Start Redis
docker-compose -f docker-compose.dev.yml up redis

# Or check REDIS_URL in .env
# App will run without Redis (degraded functionality)
```

**Problem**: Redis quota exceeded (Upstash free tier)
```bash
# Solution: Upgrade plan or flush database
# Warning: This clears all cache
redis-cli FLUSHALL
```

### Runtime Issues

**Problem**: Server won't start
```bash
# Check logs
npm run start:dev 2>&1 | tee server.log

# Common causes:
# 1. Port 3000 in use
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# 2. Environment variables missing
# Check .env file has required vars

# 3. Database not accessible
# Start database: docker-compose up postgres
```

**Problem**: Health endpoint returns unhealthy
```bash
# Check specific services
curl http://localhost:3000/api/v1/health

# Response shows which service is down:
# - database: Check PostgreSQL
# - redis: Check Redis
# - memory: Check system resources
```

### Monitoring Issues

**Problem**: No metrics in Prometheus
```bash
# 1. Check metrics endpoint works
curl http://localhost:3000/metrics

# 2. Check Prometheus targets
open http://localhost:9090/targets

# 3. Restart Prometheus
docker-compose -f docker-compose.dev.yml restart prometheus
```

**Problem**: No traces in Jaeger
```bash
# 1. Check OTEL_EXPORTER_OTLP_ENDPOINT in .env
# Should be: http://jaeger:4318/v1/traces

# 2. Verify Jaeger is running
docker-compose -f docker-compose.dev.yml ps jaeger

# 3. Generate test traffic
curl -X POST http://localhost:3000/api/v1/auth/login
```

---

## 🎯 Best Practices Summary

### Always Do
- ✅ Use `PrismaService` for database access
- ✅ Use `RedisService` for caching
- ✅ Add Swagger decorators to all endpoints
- ✅ Write unit tests for all services
- ✅ Add logging with proper log levels
- ✅ Use DTOs for request validation
- ✅ Handle errors with NestJS exceptions
- ✅ Add monitoring metrics for critical paths
- ✅ Use TypeScript strict mode
- ✅ Follow the established module pattern

### Never Do
- ❌ Don't commit secrets or .env files
- ❌ Don't create raw Prisma/Redis clients
- ❌ Don't throw generic Error objects
- ❌ Don't skip input validation
- ❌ Don't edit migration files manually
- ❌ Don't break existing API contracts without versioning
- ❌ Don't deploy without running tests
- ❌ Don't ignore TypeScript errors
- ❌ Don't use `any` type
- ❌ Don't skip documentation

### Code Review Checklist
- [ ] All tests pass (`npm run test:all`)
- [ ] Build succeeds (`npm run build`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Format check passes (`npm run format:check`)
- [ ] New code has unit tests (coverage threshold: 85%)
- [ ] DTOs have proper validation with `class-validator`
- [ ] Swagger docs are up to date (`@ApiOperation`, `@ApiResponse`)
- [ ] Error handling uses NestJS exceptions (not generic `Error`)
- [ ] Logging uses `Logger` with appropriate levels
- [ ] No secrets in code (all credentials in `.env`)
- [ ] Database migrations are reversible
- [ ] Performance considerations addressed:
  - [ ] Add caching for read-heavy endpoints
  - [ ] Add database indexes for foreign keys
  - [ ] Add Prometheus metrics for business operations
  - [ ] Add rate limiting if expensive operation
- [ ] WebSocket events properly typed (if applicable)
- [ ] Import/export validation for large files (if applicable)

---

## 📚 Additional Resources

### Documentation

#### Core Documentation
- **Monitoring System**: `docs/monitoring/README.md`
- **Windows Setup**: `docs/WINDOWS_QUICK_START.md`
- **Build Troubleshooting**: `docs/BUILD_FIXES_SUMMARY.md`
- **CI/CD Fix**: `docs/CI_CD_FIX_DOCKER_BUILD_PATH.md`

#### Deployment Guides
- **Railway Quick Start**: `docs/RAILWAY_QUICK_START.md`
- **Railway Complete Guide**: `docs/RAILWAY_DEPLOYMENT_GUIDE.md`
- **Railway Troubleshooting**: `docs/RAILWAY_TROUBLESHOOTING.md`
- **Step-by-Step Deployment**: `RAILWAY_DEPLOY_NOW.md`

#### Project Status & Planning
- **Dashboard**: `PROJECT_STATUS_DASHBOARD.md`
- **Completion Summary**: `documents/PROJECT_COMPLETION_SUMMARY.md`
- **Remaining Tasks**: `documents/REMAINING_TASKS_GUIDE.md`
- **Monitoring Checklist**: `documents/MONITORING_CHECKLIST.md`

#### Performance & Testing
- **Load Testing Guide**: `QUICK_START_LOAD_TESTING.md`
- **Performance Docs**: `docs/performance/`
- **Testing Strategy**: `docs/testing/`

#### Feature-Specific
- **IoT/MQTT**: `docs/iot/`
- **Orders System**: `docs/orders/`
- **Production Deployment**: `docs/production/`

### Key Files
- **Environment template**: `.env.example`
- **Environment config**: `.env` (DO NOT COMMIT - contains secrets)
- **Database schema**: `prisma/schema.prisma`
- **Database seed**: `prisma/seed.ts`
- **API collections**: `postman/*.postman_collection.json` (14 collections)
  - Master collection: `00-Master-Complete-API-Collection.postman_collection.json`
  - Auth testing: `99-Complete-Auth-Flow-Testing.postman_collection.json`
- **CI/CD**: `.github/workflows/ci.yml`
- **Docker**: `docker-compose.dev.yml`, `docker-compose.monitoring.yml`, `Dockerfile`
- **Monitoring**: `prometheus/prometheus.yml`, `prometheus/alert.rules.yml`
- **Grafana**: `grafana/dashboards/`, `grafana/provisioning/`

### External Links
- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [OpenTelemetry Tracing](https://opentelemetry.io/docs/instrumentation/js/)

---

**Last Updated**: November 4, 2025  
**Status**: Production Ready ✅  
**Coverage**: 100% of core features documented  
**Performance**: 94% optimization complete (Issue #24)  
**Current Metrics**: 500-1000 req/s throughput, <150ms P95 latency, 85-90% cache hit rate

---

## 🚢 Production Deployment & Infrastructure Notes

### Docker Configuration
- **Dockerfile**: Multi-stage optimized build
  - Stage 1: Dependencies (`npm ci`)
  - Stage 2: Build (`npm run build`)
  - Stage 3: Production runtime (Node.js slim)
  - Expects `dist/health-check.js` for HEALTHCHECK
  - Health check: `node dist/health-check.js` (returns 0 if `/api/v1/health` is 2xx)

### Local Development with Docker
```bash
# Build image
docker build -t mash-backend/api:local .

# Run with full stack (Postgres + Redis + Prometheus + Grafana + Jaeger)
docker-compose -f docker-compose.dev.yml up --build

# Run monitoring stack separately
docker-compose -f docker-compose.monitoring.yml up -d

# Access services:
# - Backend API: http://localhost:3000
# - Grafana: http://localhost:4000 (admin/admin)
# - Prometheus: http://localhost:9090
# - Jaeger: http://localhost:16686
# - Alertmanager: http://localhost:9093
```

### CI/CD Pipeline (`.github/workflows/ci.yml`)
The CI pipeline runs in this order:
1. **Linting**: `npm run lint:check` + `npm run format:check`
2. **Type checking**: `npm run type-check`
3. **Unit tests**: `npm run test:unit` with coverage
4. **E2E tests**: `npm run test:e2e`
5. **Database setup**: `npx prisma generate` + `npx prisma migrate deploy`
6. **API tests**: Newman/Postman collections (14 collections)
   - **Critical**: App must be reachable at `http://localhost:3000/api/v1/health`
7. **Docker build**: Builds and pushes image (only on `main`/`develop` branches)
8. **Health check**: Verifies `/api/v1/health` endpoint responds

**Important Notes**:
- Keep `/api/v1/health` endpoint stable (used by CI, Docker, K8s probes)
- Update `Dockerfile` HEALTHCHECK if health endpoint changes
- CI uses test database (different from local dev)
- Newman tests expect specific test data (see `prisma/seed.ts`)

### Monitoring & Observability

#### Prometheus Metrics (`/metrics`)
- **Location**: `src/monitoring/prometheus/prometheus.service.ts`
- **Scraped every**: 15 seconds
- **Custom metrics**: 60+ metrics across:
  - HTTP requests (status, method, endpoint)
  - Database queries (duration, type, errors)
  - Cache operations (hits, misses, evictions)
  - Business events (orders, products, users)
  - Security events (auth failures, rate limits)
  - System resources (memory, CPU, connections)

#### Distributed Tracing (OpenTelemetry + Jaeger)
- **Configuration**: `src/monitoring/tracing.ts`
- **Auto-instrumentation**: HTTP, Express, NestJS
- **Custom spans**: Add in business logic for deep insights
- **Endpoint**: Configured via `OTEL_EXPORTER_OTLP_ENDPOINT`
- **Note**: Disabled by default in local dev (`OTEL_ENABLED=false`)

#### Logging (Winston)
- **Location**: `src/common/utils/logger.util.ts`
- **Features**:
  - Correlation IDs for request tracking
  - Structured JSON in production
  - Console logs in development
  - Daily rotating files (`logs/` directory)
  - Audit logs for sensitive operations

#### Health Checks (`@nestjs/terminus`)
- **Controller**: `src/health/health.controller.ts`
- **Indicators**:
  - `PrismaHealthIndicator`: Database connectivity
  - `RedisHealthIndicator`: Cache availability
  - `MemoryHealthIndicator`: Memory usage
- **Endpoints**:
  - `/api/v1/health`: Overall health (200 = healthy, 503 = unhealthy)
  - `/api/v1/health/ready`: Readiness probe (K8s)
  - `/api/v1/health/live`: Liveness probe (K8s)

### Rollbacks & Releases
- **Image building**: Only from `main`/`develop` branches
- **Tagging**: See `.github/workflows/ci.yml` for metadata
- **Rollback strategy**: 
  1. Revert to previous Git commit
  2. Re-run CI pipeline
  3. Use previous Docker image tag
  4. Run database migrations backwards (`prisma migrate resolve`)

### Common Infrastructure Failures & Solutions

#### Database Migration Failures
```bash
# Check migration status
npx prisma migrate status

# Reset database (DEVELOPMENT ONLY)
npx prisma migrate reset

# Apply pending migrations
npx prisma migrate deploy

# Mark migration as resolved (if manually fixed)
npx prisma migrate resolve --applied <migration_name>
```

#### Redis Connection Issues
```bash
# Test Redis connection
redis-cli -h proven-aphid-10039.upstash.io -p 6379 -a <password> ping

# Check Redis info
redis-cli -h proven-aphid-10039.upstash.io -p 6379 -a <password> info

# Flush Redis (WARNING: clears all cache)
redis-cli -h proven-aphid-10039.upstash.io -p 6379 -a <password> FLUSHALL
```

#### Newman Test Failures
```bash
# Run specific collection
npm run postman:auth
npm run postman:orders

# Debug mode
newman run postman/01-Authentication-API.postman_collection.json \
  -e postman/MASH-backend.postman_environment.json \
  --verbose

# Common causes:
# 1. App not running on http://localhost:3000
# 2. Database not seeded (run: npm run db:seed)
# 3. Environment variables missing
# 4. Previous test data conflicts
```

### Railway-Specific Configuration
See comprehensive guides in `docs/`:
- `RAILWAY_QUICK_START.md`: 5-minute setup
- `RAILWAY_DEPLOYMENT_GUIDE.md`: Complete walkthrough
- `RAILWAY_TROUBLESHOOTING.md`: Common issues
- `RAILWAY_DEPLOY_NOW.md`: Step-by-step checklist

**Key Railway Features**:
- Variable references: `${{service-name.VARIABLE_NAME}}`
- Automatic deployments on Git push
- Built-in monitoring and logs
- Health checks via `/api/v1/health`
- Auto-scaling based on load
