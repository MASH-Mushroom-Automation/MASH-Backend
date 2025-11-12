# MASH-Backend — AI Coding Agent Guide## MASH-Backend — AI Agent Instructions



**Purpose**: Essential knowledge for AI coding agents to be immediately productive in this NestJS e-commerce/IoT backend.**Purpose**: Essential knowledge for AI coding agents to be immediately productive in this NestJS e-commerce/IoT backend.



**Last Updated**: November 13, 2025  ---

**Status**: Production Ready ✅

## � Quick Start

---

### Prerequisites & Setup

## 🚀 Quick Start (5 Minutes)```bash

# Install dependencies (MUST use --legacy-peer-deps)

### 1. Install & Buildnpm install --legacy-peer-deps

```bash

# Install dependencies (MUST use --legacy-peer-deps due to package version conflicts)# Generate Prisma client (REQUIRED before build/run)

npm install --legacy-peer-depsnpx prisma generate



# Generate Prisma client (REQUIRED - creates type-safe database client)# Run migrations

npx prisma generatenpx prisma migrate dev



# Run database migrations# Build & start development server

npx prisma migrate devnpm run build

npm run start:dev

# Build TypeScript → JavaScript (creates dist/ folder)```

npm run build

**Critical**: Always run `npx prisma generate` after `npm install` or any schema changes. Server runs on `http://localhost:3000`.

# Start development server with hot-reload

npm run start:dev### Verify Installation

``````bash

# Health check (must return "ok")

**Server runs on**: `http://localhost:3000`  curl http://localhost:3000/api/v1/health

**Critical**: Always run `npx prisma generate` after `npm install` or Prisma schema changes.

# Swagger docs

### 2. Verify Installationstart http://localhost:3000/api/docs

```bash

# Health check (must return "ok")# Metrics endpoint

curl http://localhost:3000/api/v1/healthcurl http://localhost:3000/metrics

```

# API documentation

start http://localhost:3000/api/docs### Environment Configuration (.env)

**Minimum required variables**:

# Prometheus metrics```bash

curl http://localhost:3000/metricsDATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"

```JWT_SECRET="your-secret-min-32-chars"

NODE_ENV=development

### 3. Windows TroubleshootingPORT=3000

If you get build errors or "cannot find module":```

```cmd

REM Clean everything and reinstall**Optional but recommended**: `REDIS_URL`, `CLERK_SECRET_KEY`, email/Firebase credentials. App degrades gracefully if Redis is unavailable (no caching).

rmdir /s /q node_modules dist

del package-lock.json---

npm install --legacy-peer-deps

npx prisma generate## 🏗️ Architecture Overview

npm run build

```### Tech Stack

- **Framework**: NestJS 10.x (TypeScript + dependency injection)

**Port 3000 already in use?**- **Database**: PostgreSQL 15+ via Prisma ORM 5.x (type-safe client)

```cmd- **Cache**: Redis 7.x (optional - app runs without it)

REM Find and kill the process- **Auth**: Clerk + JWT + Passport (OAuth: Google, Facebook)

netstat -ano | findstr :3000- **Real-time**: Socket.IO WebSockets, MQTT for IoT devices

taskkill /PID <PID> /F- **Monitoring**: Prometheus metrics, Jaeger tracing (OpenTelemetry), Winston logging

```- **Queue**: Bull (Redis-backed background jobs)

- **Storage**: Firebase Storage, Multer for uploads

---- **Notifications**: SendGrid/Nodemailer (email), Twilio (SMS), FCM (push)



## 🏗️ Architecture Overview### Critical Module Structure

```

### Tech Stacksrc/

- **Framework**: NestJS 10.x (TypeScript + dependency injection)├── main.ts                    # Bootstrap (middleware, CORS, Swagger, health)

- **Database**: PostgreSQL 15+ via Prisma ORM 5.x (type-safe client)├── app.module.ts              # Root module (imports all features)

- **Cache**: Redis 7.x (optional - app degrades gracefully if unavailable)├── common/                    # Shared utilities & infrastructure

- **Auth**: Multi-strategy (JWT, Clerk webhooks, OAuth via Google/Facebook)│   ├── decorators/            # @Public, @Roles, @Cacheable

- **Real-time**: Socket.IO WebSockets, MQTT for IoT devices│   ├── guards/                # JwtAuthGuard, RolesGuard

- **Monitoring**: Prometheus metrics + Jaeger tracing (OpenTelemetry) + Winston logs│   ├── interceptors/          # CacheInterceptor, AuditLogInterceptor

- **Queue**: Bull (Redis-backed background jobs)│   ├── filters/               # PrismaExceptionFilter, HttpExceptionFilter

- **Storage**: Firebase Storage (file uploads)│   ├── middleware/            # CorrelationIdMiddleware, CsrfProtectionMiddleware

- **Notifications**: Email (SendGrid/Nodemailer/SMTP), SMS (Twilio), Push (FCM)│   └── utils/                 # CustomLogger, bcrypt helpers, token helpers

├── database/                  # PrismaService, RedisService (singletons)

### Critical Directory Structure├── monitoring/                # PrometheusService, tracing setup

```├── modules/                   # Feature modules (auth, users, orders, products, etc.)

src/│   ├── auth/                  # Multi-strategy auth (JWT, Clerk, OAuth)

├── main.ts                    # Bootstrap (CORS, Swagger, middleware, health)│   ├── users/                 # User management + RBAC

├── app.module.ts              # Root module (imports all feature modules)│   ├── orders/                # E-commerce order processing

├── common/                    # Shared utilities & infrastructure│   ├── products/              # Product catalog + categories

│   ├── decorators/            # @Public, @Roles, @Cacheable│   ├── devices/               # IoT device management (MQTT)

│   ├── guards/                # JwtAuthGuard, RolesGuard│   ├── sensors/               # Sensor data collection & analytics

│   ├── interceptors/          # CacheInterceptor, AuditLogInterceptor│   ├── notifications/         # Email, SMS, Push notifications

│   ├── filters/               # Exception filters (Prisma, HTTP, Validation)│   ├── queues/                # Bull job processing

│   ├── middleware/            # CorrelationId, CSRF, Security Headers│   └── websocket/             # Real-time WebSocket gateway

│   └── utils/                 # CustomLogger, bcrypt, token helpers└── types/                     # Global TypeScript types

├── database/                  # PrismaService, RedisService (singletons)

├── monitoring/                # PrometheusService, OpenTelemetry tracingprisma/

├── modules/                   # Feature modules (see below)├── schema.prisma              # Single source of truth for DB schema

│   ├── auth/                  # Multi-strategy auth (JWT, Clerk, OAuth)├── migrations/                # Versioned migrations (NEVER edit manually)

│   ├── users/                 # User management + RBAC└── seed.ts                    # Database seeding script

│   ├── orders/                # E-commerce order processing```

│   ├── products/              # Product catalog + categories

│   ├── devices/               # IoT device management (MQTT)### Key Architectural Patterns

│   ├── notifications/         # Email, SMS, Push notifications

│   ├── queues/                # Background job processing#### 1. Lazy-Loaded Prisma Client (Windows Compatibility Fix)

│   └── websocket/             # Real-time connections**Critical**: PrismaService uses dynamic imports to avoid native DLL loading issues on Windows during module initialization.

└── types/                     # Global TypeScript types```typescript

// src/database/prisma.service.ts

prisma/// ❌ NEVER do this: import { PrismaClient } from '@prisma/client'

├── schema.prisma              # Single source of truth for DB schema// ✅ ALWAYS use lazy loading:

├── migrations/                # Versioned migrations (NEVER edit manually!)private client: PrismaClient | null = null; // Initialized on first use

└── seed.ts                    # Database seeding script```

```

#### 2. Graceful Redis Degradation

---**Pattern**: RedisService returns `null` if unavailable; app continues without caching.

```typescript

## 🔑 Critical Architectural Patterns// src/database/redis.service.ts

if (!redisUrl) {

### 1. Lazy-Loaded Prisma Client (Windows Fix)  this.logger.warn('Redis disabled - app runs with degraded caching');

**Why**: Static imports of `@prisma/client` load native DLLs at parse time, causing crashes on Windows during module initialization.  this.client = null; // App continues without Redis

}

**Pattern**: Use dynamic imports + lazy initialization in `PrismaService````

```typescript

// ❌ NEVER do this in services:#### 3. Multi-Strategy Authentication

import { PrismaClient } from '@prisma/client';- **JWT**: Default auth for most endpoints (`@UseGuards(JwtAuthGuard)`)

const prisma = new PrismaClient(); // Crashes on Windows!- **Clerk**: Webhook-based user sync (`/api/v1/auth/clerk-webhook`)

- **OAuth**: Google/Facebook via `oauth` module (stores `googleId`, `facebookId` in User model)

// ✅ ALWAYS inject PrismaService:- **Public endpoints**: Use `@Public()` decorator to skip auth

@Injectable()

export class UserService {#### 4. Role-Based Access Control (RBAC)

  constructor(private prisma: PrismaService) {} // Uses lazy-loaded client```typescript

  enum UserRole { USER, GROWER, ADMIN, SUPER_ADMIN } // Defined in Prisma schema

  async findUser(id: string) {

    return this.prisma.user.findUnique({ where: { id } });// Controller example:

  }@UseGuards(JwtAuthGuard, RolesGuard)

}@Roles('ADMIN', 'SUPER_ADMIN')

```@Delete(':id')

async deleteUser(@Param('id') id: string) { }

**See**: `src/database/prisma.service.ts` lines 1-50```



### 2. Graceful Redis Degradation#### 5. Observability Stack

**Why**: App must run even if Redis is unavailable (local dev, deployment issues).- **Metrics**: 60+ custom Prometheus metrics via `PrometheusService` (`/metrics` endpoint)

- **Tracing**: OpenTelemetry auto-instrumentation + custom spans (`trace.getTracer()`)

**Pattern**: `RedisService` returns `null` for operations when disconnected; app continues without caching.- **Logging**: Winston with correlation IDs (see `CustomLogger`, `CorrelationIdMiddleware`)

```typescript- **Health**: Terminus-based checks at `/api/v1/health` (DB, Redis, Memory)

// RedisService handles unavailability gracefully

if (!redisUrl) {#### 6. Caching Strategy

  this.logger.warn('Redis disabled - app runs with degraded caching');```typescript

  this.client = null; // App continues without Redis// Method-level caching with @Cacheable decorator

}@Cacheable({ ttl: 300, tags: ['products'] })

async findAll() { return this.prisma.product.findMany(); }

// In services, always check for null:

const cached = await this.redis.get<Product>(`product:${id}`);// Invalidate cache with @CacheEvict

if (cached) return cached; // Cache hit@CacheEvict({ tags: ['products'] })

// Cache miss - fetch from databaseasync create(dto: CreateProductDto) { }

``````



**See**: `src/database/redis.service.ts` lines 30-75---



### 3. Multi-Strategy Authentication## 💻 Development Workflow

Three auth mechanisms coexist:

### Daily Commands

1. **JWT (Default)**: Most endpoints use `@UseGuards(JwtAuthGuard)````bash

2. **Clerk Webhooks**: Syncs users from Clerk dashboard (`/api/v1/auth/clerk-webhook`)# Development (hot reload)

3. **OAuth (Google/Facebook)**: Stores `googleId`, `facebookId` in User modelnpm run start:dev



**Public endpoints**: Use `@Public()` decorator to skip authentication.# Build for production

npm run build

```typescript

// Public endpoint (no auth)# Run production server

@Post('login')npm run start:prod

@Public()

async login(@Body() dto: LoginDto) { }# Testing

npm test                  # Unit tests

// JWT-protected endpointnpm run test:e2e         # E2E tests

@Get('profile')npm run test:cov         # Coverage report

@UseGuards(JwtAuthGuard)

async getProfile(@Request() req) { # Code quality

  return this.userService.findOne(req.user.id);npm run lint             # ESLint (auto-fix)

}npm run format           # Prettier (auto-format)



// Role-based access control# Database

@Delete(':id')npx prisma generate      # Regenerate client (after schema changes)

@Roles('ADMIN', 'SUPER_ADMIN')npx prisma migrate dev   # Create migration

@UseGuards(JwtAuthGuard, RolesGuard)npx prisma studio        # Open database GUI

async deleteUser(@Param('id') id: string) { }npm run db:seed          # Seed database

```

# API testing

**User roles** (from Prisma schema): `USER`, `GROWER`, `ADMIN`, `SUPER_ADMIN`npm run postman:test     # Run all Postman collections

npm run postman:auth     # Run auth tests only

### 4. Email Service (Multi-Provider Fallback)```

**Why**: Production uses SendGrid, but Railway blocks port 587. ngrok SMTP relay available as fallback.

### Windows-Specific Commands

**Providers** (in order of preference):```cmd

1. SendGrid (if `SENDGRID_API_KEY` set)REM Kill process on port 3000

2. Nodemailer SMTP (if `SMTP_*` vars set)netstat -ano | findstr :3000

3. ngrok SMTP relay (see `docs/NGROK_SMTP_SETUP_GUIDE.md`)taskkill /PID <PID> /F



**Pattern**: CommunicationHubService handles multi-channel notifications (email, SMS, push)REM Clean install

```typescriptrmdir /s /q node_modules dist

// Send multi-channel notificationdel package-lock.json

await communicationHub.sendNotification({npm install --legacy-peer-deps

  userId: 'user123',npx prisma generate

  message: 'Your order has shipped',npm run build

  channels: ['email', 'push'], // SMS excluded```

  emailTemplate: 'order-shipped',

});### Docker Development Stack

``````bash

# Start all services (Postgres, Redis, Prometheus, Grafana, Jaeger)

**See**: `src/modules/notifications/services/communication-hub.service.ts`docker compose -f docker-compose.dev.yml up -d



### 5. Observability Stack# Access monitoring dashboards

**Metrics**: 60+ custom Prometheus metrics exposed at `/metrics`# Grafana:       http://localhost:4000 (admin/admin)

- HTTP requests, response times, status codes# Prometheus:    http://localhost:9090

- Database query performance, connection pool stats# Jaeger:        http://localhost:16686

- Cache hit/miss rates, Redis operations# Alertmanager:  http://localhost:9093

- Business metrics (orders, user registrations)

- Security events (failed logins, rate limit hits)# Stop all services

docker compose -f docker-compose.dev.yml down

**Tracing**: OpenTelemetry auto-instrumentation + custom spans

```typescript# Fresh start (delete volumes)

import { trace } from '@opentelemetry/api';docker compose -f docker-compose.dev.yml down -v

```

async processPayment(amount: number) {

  const span = this.tracer.startSpan('processPayment');---

  try {

    span.setAttribute('payment.amount', amount);## 📝 Code Conventions & Patterns

    const result = await this.gateway.charge(amount);

    return result;### Module Structure (Standard Template)

  } catch (error) {Every feature module follows this pattern:

    span.recordException(error);```

    throw error;src/modules/feature/

  } finally {├── feature.module.ts        # Module definition

    span.end();├── feature.controller.ts    # REST API endpoints

  }├── feature.service.ts       # Business logic

}├── feature.spec.ts          # Unit tests

```├── dto/

│   ├── create-feature.dto.ts  # Input validation (class-validator)

**Logging**: Winston with correlation IDs for request tracking│   ├── update-feature.dto.ts  # PartialType of CreateDto

```typescript│   └── query-feature.dto.ts   # Query parameters

private readonly logger = new Logger(OrderService.name);├── guards/                  # Feature-specific guards (if any)

└── interfaces/              # TypeScript interfaces

this.logger.log(`Creating order for user ${userId}`);```

this.logger.error(`Failed to create order: ${error.message}`, error.stack);

```### Database Access Pattern (ALWAYS use PrismaService)

```typescript

**Health Checks**: Terminus-based endpoints at `/api/v1/health`// ✅ CORRECT: Inject PrismaService

- Database health: `PrismaHealthIndicator`@Injectable()

- Cache health: `RedisHealthIndicator`  export class UserService {

- Memory health: `MemoryHealthIndicator`  constructor(private prisma: PrismaService) {}

  

**See**: `src/monitoring/` and `src/health/`  async findUser(id: string) {

    return this.prisma.user.findUnique({ where: { id } });

---  }

  

## 💻 Daily Development Workflow  // Use executeTransaction for multi-step operations

  async createWithProfile(data: CreateUserDto) {

### Essential Commands    return this.prisma.executeTransaction(async (tx) => {

```bash      const user = await tx.user.create({ data: userData });

# Development (hot reload)      const profile = await tx.profile.create({ data: profileData });

npm run start:dev      return { user, profile };

    });

# Build for production  }

npm run build}



# Run production server// ❌ NEVER create new PrismaClient instances

npm run start:prodconst prisma = new PrismaClient(); // WRONG!

```

# Testing

npm test                  # Unit tests### Caching Pattern (RedisService)

npm run test:e2e         # E2E tests```typescript

npm run test:cov         # Coverage report@Injectable()

export class ProductService {

# Code quality  constructor(

npm run lint             # ESLint (auto-fix)    private prisma: PrismaService,

npm run format           # Prettier (auto-format)    private redis: RedisService,

  ) {}

# Database  

npx prisma generate      # Regenerate client (after schema changes)  async getProduct(id: string) {

npx prisma migrate dev   # Create migration    // Try cache first

npx prisma studio        # Open database GUI (http://localhost:5555)    const cached = await this.redis.get<Product>(`product:${id}`);

npm run db:seed          # Seed database with test data    if (cached) return cached;

    

# API testing    // Fetch from DB

npm run postman:test     # Run all Postman collections (Newman)    const product = await this.prisma.product.findUnique({ where: { id } });

npm run postman:auth     # Run auth tests only    

```    // Cache for 5 minutes

    await this.redis.set(`product:${id}`, product, 300);

### Docker Development Stack    return product;

```bash  }

# Start all services (Postgres, Redis, Prometheus, Grafana, Jaeger)  

docker compose -f docker-compose.dev.yml up -d  // Invalidate cache on update

  async updateProduct(id: string, data: UpdateProductDto) {

# Access monitoring dashboards:    const updated = await this.prisma.product.update({ where: { id }, data });

# - Grafana:       http://localhost:4000 (admin/admin)    await this.redis.delete(`product:${id}`);

# - Prometheus:    http://localhost:9090    return updated;

# - Jaeger:        http://localhost:16686 (distributed tracing)  }

# - Alertmanager:  http://localhost:9093}

```

# View logs

docker compose -f docker-compose.dev.yml logs -f api### Error Handling (Use NestJS Exceptions)

```typescript

# Stop all servicesimport { NotFoundException, BadRequestException } from '@nestjs/common';

docker compose -f docker-compose.dev.yml down

async getUser(id: string) {

# Fresh start (delete volumes - WARNING: deletes all data)  const user = await this.prisma.user.findUnique({ where: { id } });

docker compose -f docker-compose.dev.yml down -v  

```  if (!user) {

    throw new NotFoundException(`User with ID ${id} not found`);

---  }

  

## 📝 Code Conventions (Project-Specific)  return user;

}

### Module Structure (Standard Template)

Every feature module follows this exact pattern:// ❌ NEVER throw generic errors

```throw new Error('User not found'); // WRONG!

src/modules/feature/```

├── feature.module.ts        # Module definition (imports, providers)

├── feature.controller.ts    # REST API endpoints### DTO Validation Pattern

├── feature.service.ts       # Business logic```typescript

├── feature.spec.ts          # Unit testsimport { IsEmail, IsString, MinLength, Matches } from 'class-validator';

├── dto/import { ApiProperty } from '@nestjs/swagger';

│   ├── create-feature.dto.ts  # Input validation (class-validator)

│   ├── update-feature.dto.ts  # PartialType of CreateDtoexport class CreateUserDto {

│   └── query-feature.dto.ts   # Query parameters (pagination, filters)  @ApiProperty({ example: 'john.doe@example.com' })

├── guards/                  # Feature-specific guards (if any)  @IsEmail()

└── interfaces/              # TypeScript interfaces  email: string;

```  

  @ApiProperty({ minLength: 8 })

### Database Access Pattern  @IsString()

```typescript  @MinLength(8)

// ✅ CORRECT: Always inject PrismaService  @Matches(/^(?=.*[0-9])(?=.*[!@#$%^&*])/, {

@Injectable()    message: 'Password must contain at least one number and special character',

export class UserService {  })

  constructor(private prisma: PrismaService) {}  password: string;

  }

  async findUser(id: string) {

    return this.prisma.user.findUnique({ where: { id } });// Update DTOs extend PartialType

  }export class UpdateUserDto extends PartialType(CreateUserDto) {}

  ```

  // Use executeTransaction for multi-step operations (atomicity)

  async createWithProfile(data: CreateUserDto) {### Controller Pattern (CRUD + Auth)

    return this.prisma.executeTransaction(async (tx) => {```typescript

      const user = await tx.user.create({ data: userData });@Controller('users')

      const profile = await tx.profile.create({ @ApiTags('Users')

        data: { userId: user.id, ...profileData } @UseGuards(JwtAuthGuard)  // All routes require JWT auth

      });export class UserController {

      return { user, profile };  constructor(private userService: UserService) {}

    });  

  }  @Get()

}  @ApiOperation({ summary: 'List all users' })

  async findAll(@Query() query: QueryUserDto) {

// ❌ NEVER create new PrismaClient instances    return this.userService.findAll(query);

const prisma = new PrismaClient(); // WRONG! Bypasses lazy loading, causes crashes  }

```  

  @Post()

### Caching Pattern (RedisService)  @Roles('ADMIN', 'SUPER_ADMIN')  // Role-based access

```typescript  @UseGuards(RolesGuard)

@Injectable()  @ApiOperation({ summary: 'Create user' })

export class ProductService {  async create(@Body() dto: CreateUserDto) {

  constructor(    return this.userService.create(dto);

    private prisma: PrismaService,  }

    private redis: RedisService,  

  ) {}  @Post('public-endpoint')

    @Public()  // Skip authentication

  async getProduct(id: string) {  async publicEndpoint() { }

    // Try cache first (5-minute TTL)  

    const cached = await this.redis.get<Product>(`product:${id}`);  @Post('rate-limited')

    if (cached) return cached;  @Throttle({ short: { limit: 5, ttl: 60000 } })  // 5 req/min

      async rateLimited() { }

    // Cache miss - fetch from DB}

    const product = await this.prisma.product.findUnique({ where: { id } });```

    if (!product) throw new NotFoundException(`Product ${id} not found`);

    ### Logging Pattern

    // Cache for 5 minutes (300 seconds)```typescript

    await this.redis.set(`product:${id}`, product, 300);@Injectable()

    return product;export class OrderService {

  }  private readonly logger = new Logger(OrderService.name);

    

  // Invalidate cache on update  async createOrder(data: CreateOrderDto) {

  async updateProduct(id: string, data: UpdateProductDto) {    this.logger.log(`Creating order for user ${data.userId}`);

    const updated = await this.prisma.product.update({ where: { id }, data });    

    await this.redis.delete(`product:${id}`); // Clear stale cache    try {

    return updated;      const order = await this.prisma.order.create({ data });

  }      this.logger.log(`Order created: ${order.id}`);

        return order;

  // Invalidate pattern (e.g., all product caches)    } catch (error) {

  async clearProductCache() {      this.logger.error(`Failed to create order: ${error.message}`, error.stack);

    await this.redis.deletePattern('product:*');      throw error;

  }    }

}  }

```}

```

### Error Handling (NestJS Exceptions)

```typescript### Monitoring Integration

import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';```typescript

// Add custom metrics

async getUser(id: string) {@Injectable()

  const user = await this.prisma.user.findUnique({ where: { id } });export class OrderService {

    constructor(

  if (!user) {    private prisma: PrismaService,

    throw new NotFoundException(`User with ID ${id} not found`);    private prometheus: PrometheusService,

  }  ) {}

    

  return user;  async createOrder(data: CreateOrderDto) {

}    const order = await this.prisma.order.create({ data });

    

async createUser(dto: CreateUserDto) {    // Record business metric

  // Check for conflicts    this.prometheus.recordOrder(order.id, order.status);

  const existing = await this.prisma.user.findUnique({     

    where: { email: dto.email }     return order;

  });  }

  }

  if (existing) {

    throw new ConflictException(`User with email ${dto.email} already exists`);// Add custom tracing spans

  }import { trace } from '@opentelemetry/api';

  

  return this.prisma.user.create({ data: dto });@Injectable()

}export class PaymentService {

  private tracer = trace.getTracer('payment-service');

// ❌ NEVER throw generic errors  

throw new Error('User not found'); // WRONG! Use NestJS exceptions  async processPayment(orderId: string, amount: number) {

```    return await this.tracer.startActiveSpan('processPayment', async (span) => {

      try {

### DTO Validation Pattern        span.setAttribute('order.id', orderId);

```typescript        span.setAttribute('payment.amount', amount);

import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';        

import { ApiProperty } from '@nestjs/swagger';        const result = await this.externalPaymentGateway.charge(amount);

        return result;

export class CreateUserDto {      } catch (error) {

  @ApiProperty({        span.recordException(error);

    example: 'john.doe@example.com',        throw error;

    description: 'User email address',      } finally {

  })        span.end();

  @IsEmail()      }

  email: string;    });

    }

  @ApiProperty({}

    example: 'SecurePass123!',```

    description: 'Password (min 8 chars, must include number and special char)',

  })---

  @IsString()

  @MinLength(8)## 🧪 Testing Strategy

  @Matches(/^(?=.*[0-9])(?=.*[!@#$%^&*])/, {

    message: 'Password must contain at least one number and special character',### Test Organization

  })- **Unit tests**: `*.spec.ts` co-located with source files

  password: string;- **E2E tests**: `test/*.e2e-spec.ts`

  - **Postman collections**: `postman/*.postman_collection.json`

  @ApiProperty({- **Load tests**: `test/k6/*.js` (k6 scripts)

    example: '09171234567',

    description: 'Philippine mobile number',### Running Tests

    required: false,```bash

  })npm test                 # All unit tests

  @IsOptional()npm run test:watch       # Watch mode

  @IsString()npm run test:cov         # Coverage report

  @Matches(/^(09|\+639)\d{9}$/, {npm run test:e2e         # E2E tests

    message: 'Invalid Philippine mobile number format',npm run postman:test     # Postman collections

  })```

  phoneNumber?: string;

}### Unit Test Template

```typescript

// Update DTOs extend PartialType (all fields optional)describe('UserService', () => {

import { PartialType } from '@nestjs/swagger';  let service: UserService;

export class UpdateUserDto extends PartialType(CreateUserDto) {}  let prisma: PrismaService;

```  

  beforeEach(async () => {

### Controller Pattern (CRUD + Auth + Swagger)    const module: TestingModule = await Test.createTestingModule({

```typescript      providers: [

@Controller('users')        UserService,

@ApiTags('Users')        {

@UseGuards(JwtAuthGuard) // All routes require JWT auth by default          provide: PrismaService,

export class UserController {          useValue: {

  constructor(private userService: UserService) {}            user: {

                findUnique: jest.fn(),

  @Get()              create: jest.fn(),

  @ApiOperation({ summary: 'List all users' })            },

  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })          },

  async findAll(@Query() query: QueryUserDto) {        },

    return this.userService.findAll(query);      ],

  }    }).compile();

      

  @Post()    service = module.get<UserService>(UserService);

  @Roles('ADMIN', 'SUPER_ADMIN') // Role-based access    prisma = module.get<PrismaService>(PrismaService);

  @UseGuards(RolesGuard)  });

  @ApiOperation({ summary: 'Create user' })  

  async create(@Body() dto: CreateUserDto) {  it('should return a user', async () => {

    return this.userService.create(dto);    const mockUser = { id: '1', email: 'test@example.com' };

  }    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      

  @Post('public-endpoint')    const result = await service.findOne('1');

  @Public() // Skip authentication    

  async publicEndpoint() { }    expect(result).toEqual(mockUser);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });

  @Post('rate-limited')  });

  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min});

  async rateLimited() { }```

}

```---



### Logging Pattern## 🚀 CI/CD & Deployment

```typescript

@Injectable()### CI Pipeline (`.github/workflows/ci.yml`)

export class OrderService {Runs on push to `main`, `develop`, feature branches:

  private readonly logger = new Logger(OrderService.name);1. **Linting**: ESLint + Prettier checks

  2. **Type checking**: `tsc --noEmit`

  async createOrder(data: CreateOrderDto) {3. **Unit tests**: Jest with coverage

    this.logger.log(`Creating order for user ${data.userId}`);4. **E2E tests**: Integration tests with Postgres/Redis

    5. **Database**: Prisma generate + migrations

    try {6. **API tests**: Newman Postman collections

      const order = await this.prisma.order.create({ data });7. **Docker**: Build and push image (main/develop only)

      this.logger.log(`Order created successfully: ${order.id}`);

      return order;**Important**: CI expects `/api/v1/health` to respond 200 OK during tests.

    } catch (error) {

      this.logger.error(`Failed to create order: ${error.message}`, error.stack);### Production Deployment Checklist

      throw error;```bash

    }# 1. Run tests

  }npm test && npm run test:e2e

}

```# 2. Build application

npm run build

---

# 3. Apply migrations (production)

## 🧪 Testing Patternsnpx prisma migrate deploy



### Unit Test Template# 4. Start server

```typescriptnpm run start:prod

describe('UserService', () => {

  let service: UserService;# 5. Verify health

  let prisma: PrismaService;curl https://your-domain.com/api/v1/health

  ```

  beforeEach(async () => {

    const module: TestingModule = await Test.createTestingModule({### Docker Deployment

      providers: [```bash

        UserService,# Build image

        {docker build -t mash-backend:latest .

          provide: PrismaService,

          useValue: {# Run with docker-compose (includes monitoring)

            user: {docker compose -f docker-compose.dev.yml up -d

              findUnique: jest.fn(),```

              create: jest.fn(),

              update: jest.fn(),**Note**: Dockerfile uses multi-stage build with health check (`node dist/health-check.js`).

              delete: jest.fn(),

            },---

          },

        },## 🔧 Common Tasks

      ],

    }).compile();### Adding a New Module

    ```bash

    service = module.get<UserService>(UserService);nest g module modules/feature

    prisma = module.get<PrismaService>(PrismaService);nest g controller modules/feature

  });nest g service modules/feature

  

  describe('findOne', () => {# Create DTOs

    it('should return a user', async () => {mkdir src/modules/feature/dto

      const mockUser = { id: '1', email: 'test@example.com' };# Add create-feature.dto.ts, update-feature.dto.ts, query-feature.dto.ts

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      # Create test

      const result = await service.findOne('1');# Add feature.service.spec.ts

      ```

      expect(result).toEqual(mockUser);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });### Adding a Database Table

    });```typescript

    // 1. Edit prisma/schema.prisma

    it('should throw NotFoundException when user not found', async () => {model Feature {

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);  id        String   @id @default(cuid())

        name      String

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);  userId    String

    });  user      User     @relation(fields: [userId], references: [id])

  });  createdAt DateTime @default(now())

});  updatedAt DateTime @updatedAt

```  

  @@index([userId])

### Running Tests  @@map("features")

```bash}

npm test                 # All unit tests

npm run test:watch       # Watch mode// 2. Create migration

npm run test:cov         # Coverage report (opens in browser)npx prisma migrate dev --name add_feature_table

npm run test:e2e         # E2E tests (requires running server)

npm run postman:test     # Postman/Newman API tests// 3. Regenerate client

```npx prisma generate



---// 4. Use in service

const feature = await this.prisma.feature.create({ data });

## 🔧 Common Tasks```



### Adding a New Module### Adding a New API Endpoint

```bash```typescript

# Generate scaffolding with NestJS CLI// 1. Create DTO (dto/create-feature.dto.ts)

nest g module modules/featureexport class CreateFeatureDto {

nest g controller modules/feature  @IsString()

nest g service modules/feature  @ApiProperty()

  name: string;

# Create DTOs manually}

mkdir src/modules/feature/dto

# Add create-feature.dto.ts, update-feature.dto.ts, query-feature.dto.ts// 2. Add controller method

@Post('features')

# Create test file@ApiOperation({ summary: 'Create feature' })

touch src/modules/feature/feature.service.spec.tsasync createFeature(@Body() dto: CreateFeatureDto) {

```  return this.featureService.create(dto);

}

### Adding a Database Table

```prisma// 3. Implement service

// 1. Edit prisma/schema.prismaasync create(dto: CreateFeatureDto) {

model Feature {  return this.prisma.feature.create({ data: dto });

  id        String   @id @default(cuid())}

  name      String

  userId    String// 4. Add unit test

  user      User     @relation(fields: [userId], references: [id])it('should create a feature', async () => {

  createdAt DateTime @default(now())  const dto = { name: 'Test' };

  updatedAt DateTime @updatedAt  const result = await service.create(dto);

    expect(result.name).toBe('Test');

  @@index([userId])});

  @@map("features")

}// 5. Update Postman collection in postman/ folder

```

// 2. Create and apply migration

// Terminal:---

npx prisma migrate dev --name add_feature_table

## 🔥 Troubleshooting

// 3. Regenerate Prisma client (REQUIRED)

npx prisma generate### Build Issues

**Problem**: "Cannot find module" errors

// 4. Use in service```bash

const feature = await this.prisma.feature.create({ data });# Solution: Clean install

```rmdir /s /q node_modules dist

del package-lock.json

### Adding Monitoring to New Codenpm install --legacy-peer-deps

```typescriptnpx prisma generate

// 1. Add custom metric in PrometheusService```

private readonly featureCounter = new Counter({

  name: 'mash_features_total',**Problem**: TypeScript compilation errors

  help: 'Total features created',```bash

  labelNames: ['status'],npm run lint -- --fix

});npx tsc --noEmit

npm run build

recordFeature(status: string) {```

  this.featureCounter.inc({ status });

}### Database Issues

**Problem**: Prisma client out of sync

// 2. Add tracing span```bash

import { trace } from '@opentelemetry/api';npx prisma generate  # Always run after schema changes

```

@Injectable()

export class FeatureService {**Problem**: Migration conflicts

  private tracer = trace.getTracer('feature-service');```bash

  # DEVELOPMENT ONLY (deletes all data)

  async create(dto: CreateFeatureDto) {npx prisma migrate reset

    return await this.tracer.startActiveSpan('createFeature', async (span) => {npx prisma migrate dev

      try {```

        span.setAttribute('feature.name', dto.name);

        const result = await this.prisma.feature.create({ data: dto });**Problem**: Connection errors

        this.prometheus.recordFeature('success');```bash

        return result;# Check DATABASE_URL format

      } catch (error) {# postgresql://user:password@localhost:5432/database?sslmode=require

        span.recordException(error);

        this.prometheus.recordFeature('error');# Test connection

        throw error;npx prisma db push

      } finally {```

        span.end();

      }### Redis Issues

    });**Problem**: Redis connection refused

  }```bash

}# Start Redis with Docker

```docker run -d -p 6379:6379 redis:7-alpine



---# Or disable Redis (app runs without it)

# Comment out REDIS_URL in .env

## 🔥 Troubleshooting```



### Build Issues### Runtime Issues

**Problem**: "Cannot find module" errors**Problem**: Port 3000 in use (Windows)

```bash```cmd

# Solution: Clean installnetstat -ano | findstr :3000

rmdir /s /q node_modules disttaskkill /PID <PID> /F

del package-lock.json```

npm install --legacy-peer-deps

npx prisma generate**Problem**: Health endpoint returns unhealthy

``````bash

curl http://localhost:3000/api/v1/health

**Problem**: TypeScript compilation errors# Check response for failing service (database/redis/memory)

```bash```

npm run lint -- --fix

npx tsc --noEmit  # Type-check without emitting### Monitoring Issues

npm run build**Problem**: No metrics in Prometheus

``````bash

# 1. Check metrics endpoint

### Database Issuescurl http://localhost:3000/metrics

**Problem**: Prisma client out of sync with schema

```bash# 2. Check Prometheus targets

npx prisma generate  # Always run after schema changesstart http://localhost:9090/targets

```

# 3. Restart Prometheus

**Problem**: Migration conflictsdocker compose -f docker-compose.dev.yml restart prometheus

```bash```

# DEVELOPMENT ONLY (deletes all data)

npx prisma migrate reset---

npx prisma migrate dev

```## 🎯 Best Practices



**Problem**: Connection errors### Always Do ✅

```bash- Use `PrismaService` for database access (never create raw PrismaClient)

# Check DATABASE_URL format in .env:- Use `RedisService` for caching (handles unavailability gracefully)

# postgresql://user:password@localhost:5432/database?sslmode=require- Add Swagger decorators (`@ApiOperation`, `@ApiProperty`) to all endpoints

- Write unit tests for all services

# Test connection- Use DTOs with class-validator for input validation

npx prisma db push- Handle errors with NestJS exceptions (NotFoundException, etc.)

```- Add logging with proper log levels (Logger)

- Add monitoring metrics for critical paths (PrometheusService)

### Redis Issues- Run `npx prisma generate` after schema changes

**Problem**: Redis connection refused- Use TypeScript strict mode (no `any` types)

```bash

# Start Redis with Docker### Never Do ❌

docker run -d -p 6379:6379 redis:7-alpine- Don't commit secrets or `.env` files

- Don't create raw Prisma/Redis clients (use services)

# Or disable Redis (app runs without it)- Don't throw generic `Error` objects (use NestJS exceptions)

# Comment out REDIS_URL in .env- Don't skip input validation

```- Don't edit migration files manually

- Don't deploy without running tests

### Runtime Issues- Don't ignore TypeScript errors

**Problem**: Port 3000 in use (Windows)- Don't use `any` type

```cmd- Don't break API contracts without versioning

netstat -ano | findstr :3000

taskkill /PID <PID> /F### Code Review Checklist

```- [ ] All tests pass (`npm run test`)

- [ ] Build succeeds (`npm run build`)

**Problem**: Health endpoint returns unhealthy- [ ] Linting passes (`npm run lint`)

```bash- [ ] Type checking passes (`npx tsc --noEmit`)

curl http://localhost:3000/api/v1/health- [ ] New code has unit tests

# Check response for failing service (database/redis/memory)- [ ] DTOs have proper validation

```- [ ] Swagger docs are up to date

- [ ] Error handling is complete

---- [ ] Logging is adequate

- [ ] No secrets in code

## 🎯 Best Practices- [ ] Database migrations are reversible



### Always Do ✅---

- Use `PrismaService` for database access (never create raw PrismaClient)

- Use `RedisService` for caching (handles unavailability gracefully)## 📚 Key Resources

- Add Swagger decorators (`@ApiOperation`, `@ApiProperty`) to all endpoints

- Write unit tests for all services### Documentation

- Use DTOs with class-validator for input validation- **Monitoring**: `docs/monitoring/README.md`

- Handle errors with NestJS exceptions (NotFoundException, etc.)- **Windows Setup**: `docs/WINDOWS_QUICK_START.md`

- Add logging with proper log levels (Logger)- **OAuth Setup**: `docs/OAUTH_SETUP_GUIDE.md`

- Add monitoring metrics for critical paths (PrometheusService)- **API Specification**: `API_SPECIFICATION.md`

- Run `npx prisma generate` after schema changes

- Use TypeScript strict mode (no `any` types)### Key Files

- **Environment template**: `.env.example`

### Never Do ❌- **Database schema**: `prisma/schema.prisma` (single source of truth)

- Don't commit secrets or `.env` files- **API collections**: `postman/*.postman_collection.json`

- Don't create raw Prisma/Redis clients (use services)- **CI/CD**: `.github/workflows/ci.yml`

- Don't throw generic `Error` objects (use NestJS exceptions)- **Docker**: `docker-compose.dev.yml`, `Dockerfile`

- Don't skip input validation

- Don't edit migration files manually### External Links

- Don't deploy without running tests- [NestJS Docs](https://docs.nestjs.com)

- Don't ignore TypeScript errors- [Prisma Docs](https://www.prisma.io/docs)

- Don't use `any` type- [Prometheus Best Practices](https://prometheus.io/docs/practices/)

- Don't break API contracts without versioning

---

---

**Last Updated**: November 13, 2024  

## 📚 Key Documentation**Version**: 2.0 (Condensed for AI agents)  

**Coverage**: Core patterns, critical workflows, project-specific conventions

### Internal Docs (docs/)

- **Email Setup**: `docs/NGROK_SMTP_SETUP_GUIDE.md` (ngrok SMTP relay for Railway)```bash

- **OAuth Setup**: `docs/OAUTH_SETUP_GUIDE.md` (Google/Facebook integration)# Build TypeScript to JavaScript

- **Monitoring**: `docs/monitoring/README.md` (Prometheus, Grafana, Jaeger)npm run build

- **Troubleshooting**: `docs/troubleshooting/` (Windows setup, build fixes)

- **Deployment**: `docs/RAILWAY_PRODUCTION_STATUS.md`, `docs/DEPLOYMENT_QUICK_GUIDE.md`# Verify build output

ls dist/main.js  # Linux/Mac

### Key Filesdir dist\main.js  # Windows

- **Environment template**: `.env.example````

- **Database schema**: `prisma/schema.prisma` (single source of truth)

- **API collections**: `postman/*.postman_collection.json`**Expected output**: 

- **CI/CD**: `.github/workflows/ci.yml`- `dist/` folder created

- **Docker**: `docker-compose.dev.yml`, `Dockerfile`- `dist/main.js` exists (entry point)

- Build completes without TypeScript errors

### External Resources

- [NestJS Docs](https://docs.nestjs.com)**If build fails**:

- [Prisma Docs](https://www.prisma.io/docs)```bash

- [Prometheus Best Practices](https://prometheus.io/docs/practices/)# Check for TypeScript errors

- [OpenTelemetry JS](https://opentelemetry.io/docs/instrumentation/js/)npm run type-check



---# Fix linting issues

npm run lint -- --fix

## 🚀 CI/CD & Deployment Notes

# Clean build (if needed)

### CI Pipeline (`.github/workflows/ci.yml`)rm -rf dist node_modules package-lock.json  # Linux/Mac

Runs on push to `main`, `develop`, feature branches:rmdir /s /q dist node_modules & del package-lock.json  # Windows

1. Linting (ESLint + Prettier)npm install --legacy-peer-deps

2. Type checking (`tsc --noEmit`)npm run build

3. Unit tests (Jest with coverage)```

4. E2E tests (integration tests with Postgres/Redis)

5. Database (Prisma generate + migrations)### Step 5: Run the Backend

6. API tests (Newman/Postman collections)

7. Docker build/push (main/develop only)#### **Development Mode** (Recommended for local development)



**Critical**: CI expects `/api/v1/health` to respond 200 OK during tests.```bash

# Start with hot-reload (auto-restart on code changes)

### Production Deployment Checklistnpm run start:dev

```bash```

# 1. Run all tests

npm test && npm run test:e2e**What happens**:

- ✅ Server starts on `http://localhost:3000`

# 2. Build application- ✅ Swagger API docs available at `http://localhost:3000/api/docs`

npm run build- ✅ Health check at `http://localhost:3000/api/v1/health`

- ✅ Prometheus metrics at `http://localhost:3000/metrics`

# 3. Apply migrations (production - no rollback!)- ✅ File watching enabled (changes auto-reload)

npx prisma migrate deploy

#### **Production Mode** (For deployment or testing production build)

# 4. Start server

npm run start:prod```bash

# Build first (if not already built)

# 5. Verify healthnpm run build

curl https://your-domain.com/api/v1/health

```# Start production server

npm run start:prod

### Docker Deployment```

```bash

# Build image**Production features**:

docker build -t mash-backend:latest .- ✅ Optimized performance

- ✅ JSON logging (structured logs)

# Run with docker-compose (includes monitoring)- ✅ No file watching (faster startup)

docker compose -f docker-compose.dev.yml up -d- ✅ Process management ready (PM2, Docker, etc.)

```

#### **Debug Mode** (For troubleshooting)

**Note**: Dockerfile uses multi-stage build with health check (`node dist/health-check.js`).

```bash

---# Start with Node.js debugger attached

npm run start:debug

## 📋 Environment Variables```



### Required (Minimum Setup)**Debugger access**:

```bash- Debugger listening on `ws://127.0.0.1:9229`

DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"- Use Chrome DevTools: `chrome://inspect`

JWT_SECRET="your-secret-min-32-chars"- VSCode: Use "Attach to Node Process" debug configuration

NODE_ENV=development

PORT=3000### Step 6: Verify Backend is Running

```

Open a new terminal and test the endpoints:

### Optional (Recommended)

```bash```bash

# Cache & Sessions# Test health endpoint

REDIS_URL="redis://localhost:6379"curl http://localhost:3000/api/v1/health



# Authentication# Expected response:

CLERK_SECRET_KEY="sk_test_..."{

CLERK_PUBLISHABLE_KEY="pk_test_..."  "status": "ok",

  "info": {

# OAuth    "database": { "status": "up" },

GOOGLE_CLIENT_ID="..."    "redis": { "status": "up" },

GOOGLE_CLIENT_SECRET="..."    "memory_heap": { "status": "up" }

FACEBOOK_APP_ID="..."  }

FACEBOOK_APP_SECRET="..."}



# Email (choose one)# Test Swagger documentation

SENDGRID_API_KEY="SG...."              # Production (preferred)# Open in browser: http://localhost:3000/api/docs

SMTP_HOST="smtp.gmail.com"             # SMTP fallback

SMTP_PORT=587# Test Prometheus metrics

SMTP_USER="your-email@gmail.com"curl http://localhost:3000/metrics

SMTP_PASS="app-password"```



# Notifications### Step 7: Start Monitoring Stack (Optional)

TWILIO_ACCOUNT_SID="AC..."             # SMS

TWILIO_AUTH_TOKEN="..."```bash

FIREBASE_PROJECT_ID="..."              # Push notifications# Start Prometheus, Grafana, Jaeger with Docker

FIREBASE_PRIVATE_KEY="..."docker compose -f docker-compose.dev.yml up -d



# Observability# Access monitoring dashboards:

OTEL_EXPORTER_OTLP_ENDPOINT="http://jaeger:4318/v1/traces"# - Grafana: http://localhost:4000 (admin/admin)

```# - Prometheus: http://localhost:9090

# - Jaeger: http://localhost:16686

---```



**Questions or need clarification?** Ask about:### Complete Startup Command Reference

- Specific module implementations (auth, orders, notifications, IoT)

- Testing strategies for complex features| Command | Purpose | Use When |

- Deployment procedures (Railway, Render, Docker)|---------|---------|----------|

- Email service configuration (SendGrid vs ngrok SMTP relay)| `npm run start:dev` | Hot-reload development server | Active development, coding |

- IoT device integration (MQTT, sensor data processing)| `npm run start:prod` | Production optimized server | Testing production build |

- Performance optimization techniques| `npm run start:debug` | Development server with debugger | Debugging issues |

- Security best practices (rate limiting, CSRF, helmet)| `npm run build` | Compile TypeScript to JavaScript | Before production deployment |

| `npm test` | Run unit tests | Before committing code |
| `npm run test:e2e` | Run end-to-end tests | Before releasing features |
| `npx prisma studio` | Open database GUI | Inspecting/editing data |
| `npm run lint` | Check code quality | Before committing code |

### Quick Validation Checklist

After starting the backend, verify these endpoints work:

```bash
# 1. Health check (should return "ok")
curl http://localhost:3000/api/v1/health

# 2. API documentation (should show Swagger UI)
open http://localhost:3000/api/docs  # Mac
start http://localhost:3000/api/docs  # Windows

# 3. Metrics endpoint (should return Prometheus metrics)
curl http://localhost:3000/metrics | head -20

# 4. Database connection (should show query stats)
curl http://localhost:3000/api/v1/health/ready
```

### Common Startup Issues & Solutions

#### Issue: "Cannot find module" errors
```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npx prisma generate
```

#### Issue: "Port 3000 already in use"
```bash
# Solution: Kill process or change port

# Find process using port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Find process using port 3000 (Linux/Mac)
lsof -ti:3000 | xargs kill -9

# Or change PORT in .env file
PORT=3001
```

#### Issue: "Database connection failed"
```bash
# Solution: Verify DATABASE_URL
echo $DATABASE_URL  # Linux/Mac
echo %DATABASE_URL%  # Windows

# Test connection manually
npx prisma db push
```

#### Issue: "Redis connection refused"
```bash
# Solution: Start Redis or use Upstash cloud
docker run -d -p 6379:6379 redis:7-alpine

# Or comment out Redis-dependent features temporarily
# Backend will run with degraded functionality (no caching)
```

### Next Steps After Successful Startup

1. **Import Postman Collections**: Load API collections from `postman/` folder
2. **Run Tests**: Execute `npm test` to verify everything works
3. **Check Logs**: Review `logs/` folder for any warnings
4. **Configure IDE**: Set up debugging, linting, formatting in your editor
5. **Read Documentation**: Review `docs/` folder for detailed guides

---

## 🏗️ Architecture {#architecture}

### Tech Stack
- **Framework**: NestJS 10.x (TypeScript-first Node.js framework)
- **Database**: PostgreSQL 15+ via Prisma ORM 5.x
- **Cache**: Redis 7.x (Upstash/local)
- **Authentication**: Clerk + JWT + Passport
- **Real-time**: Socket.IO WebSockets
- **Monitoring**: Prometheus + Grafana + Jaeger + OpenTelemetry
- **Task Queue**: Bull (Redis-backed)
- **Email**: SendGrid/Nodemailer
- **Storage**: Firebase Storage
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
# Optional: CLERK_*, SENDGRID_*, TWILIO_*, FIREBASE_*

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
npx prisma migrate dev --name migration_name

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
docker compose -f docker-compose.dev.yml up -d

# Start specific service
docker compose -f docker-compose.dev.yml up -d postgres

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Stop all services
docker compose -f docker-compose.dev.yml down

# Stop and remove volumes (fresh start)
docker compose -f docker-compose.dev.yml down -v

# Rebuild and start
docker compose -f docker-compose.dev.yml up --build
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
**Required for all environments**:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT signing (min 32 chars)
- `NODE_ENV`: `development` | `production` | `test`

**Optional but recommended**:
- `REDIS_URL`: Redis connection string (enables caching)
- `CLERK_SECRET_KEY`: Clerk authentication
- `SENDGRID_API_KEY`: Email notifications
- `TWILIO_*`: SMS notifications
- `FIREBASE_*`: Push notifications & storage
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OpenTelemetry collector (default: `http://jaeger:4318/v1/traces`)

### Production Deployment Checklist
```bash
# 1. Ensure all tests pass
npm run test
npm run test:e2e

# 2. Build the application
npm run build

# 3. Run database migrations
npx prisma migrate deploy

# 4. Start the application
npm run start:prod

# 5. Verify health endpoint
curl http://localhost:3000/api/v1/health

# 6. Check metrics endpoint
curl http://localhost:3000/metrics
```

### Docker Deployment
```bash
# Build Docker image
docker build -t mash-backend:latest .

# Run with docker-compose (includes monitoring stack)
docker compose -f docker-compose.dev.yml up -d

# Production deployment
docker compose -f docker-compose.yml up -d
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
docker compose -f docker-compose.dev.yml up postgres
```

### Redis Issues

**Problem**: Redis connection refused
```bash
# Solution: Start Redis
docker compose -f docker-compose.dev.yml up redis

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
# Start database: docker compose up postgres
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
docker compose -f docker-compose.dev.yml restart prometheus
```

**Problem**: No traces in Jaeger
```bash
# 1. Check OTEL_EXPORTER_OTLP_ENDPOINT in .env
# Should be: http://jaeger:4318/v1/traces

# 2. Verify Jaeger is running
docker compose -f docker-compose.dev.yml ps jaeger

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
- [ ] All tests pass (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] New code has unit tests
- [ ] DTOs have proper validation
- [ ] Swagger docs are up to date
- [ ] Error handling is complete
- [ ] Logging is adequate
- [ ] No secrets in code
- [ ] Database migrations are reversible
- [ ] Performance considerations addressed

---

## 📚 Additional Resources

### Documentation
- **Monitoring System**: `docs/monitoring/README.md`
- **Windows Setup**: `docs/WINDOWS_QUICK_START.md`
- **API Testing**: `documents/MONITORING_CHECKLIST.md`
- **Build Troubleshooting**: `docs/BUILD_FIXES_SUMMARY.md`

### Key Files
- **Environment template**: `.env.example`
- **Database schema**: `prisma/schema.prisma`
- **API collections**: `postman/*.postman_collection.json`
- **CI/CD**: `.github/workflows/ci.yml`
- **Docker**: `docker-compose.dev.yml`, `Dockerfile`

### External Links
- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [OpenTelemetry Tracing](https://opentelemetry.io/docs/instrumentation/js/)

---

**Last Updated**: November 1, 2025  
**Status**: Production Ready ✅  
**Coverage**: 100% of core features documented

---

## Production deployment & infrastructure notes

- Docker: multi-stage optimized Dockerfile is at `Dockerfile`. It builds with `npm ci` then `npm run build` and expects `dist/health-check.js` (we add a small health-check script at `src/health/health-check.ts`). The HEALTHCHECK runs `node dist/health-check.js`.

- Build & run locally (recommended): build with Docker and run with the provided compose file for local infra:
  - Build image: `docker build -t mash-backend/api:local .`
  - Run with compose (Postgres + Redis + Prometheus): `docker compose -f docker-compose.dev.yml up --build`

- CI/CD: `.github/workflows/ci.yml` runs lint, tests, Prisma generate/migrate, Newman Postman collections and a Docker build/push step. CI expects the app to be reachable at `http://localhost:3000/api/v1/health` while running Postman tests.

- Monitoring & logging: Prometheus metrics are exposed under `/metrics` (see `src/monitoring/prometheus`); traces are exported via OpenTelemetry (`src/monitoring/tracing.ts`) to the endpoint configured by `OTEL_EXPORTER_OTLP_ENDPOINT`.

- Health & recovery: use `src/health/health.controller.ts` for HTTP health endpoints. The Docker health-check is lightweight and should return 0 when `/api/v1/health` responds 2xx. When changing the health endpoints, update `Dockerfile` and CI health checks accordingly.

- Rollbacks & releases: CI builds and pushes images only from `main`/`develop` branches (`docker-build` job). Review tags and metadata in `.github/workflows/ci.yml` before changing image naming/tagging behavior.

If you want, I can:
- Add a small README under `docs/` with exact docker-compose commands and a troubleshooting checklist for common infra failures (DB migrations, Redis down, failed Newman tests).
- Open a PR with these changes and include the health-check script in the build pipeline validation.
