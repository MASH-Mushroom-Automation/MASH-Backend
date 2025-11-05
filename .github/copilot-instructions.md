## MASH-Backend — Comprehensive Instructions for AI Coding Agents

**Purpose**: Provide AI agents with complete, high-value context to be immediately productive in this repository.

---

## 📋 Table of Contents
1. [Quick Start: Build & Run Backend](#quick-start)
2. [Project Architecture](#architecture)
3. [Development Workflow](#development)
4. [Code Conventions](#conventions)
5. [Testing Strategy](#testing)
6. [Deployment & Infrastructure](#deployment)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start: Build & Run Backend {#quick-start}

### Prerequisites Checklist

Before building and running the MASH backend, ensure you have:

- ✅ **Node.js 18.x or higher** installed ([Download](https://nodejs.org/))
- ✅ **npm 9.x or higher** (comes with Node.js)
- ✅ **PostgreSQL 15+** running (or access to Neon cloud database)
- ✅ **Redis 7.x** running (or access to Upstash cloud)
- ✅ **Git** installed for version control
- ✅ **.env file** configured with all required variables (see below)

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/MASH-Mushroom-Automation/MASH-Backend.git
cd MASH-Backend

# Install dependencies (use --legacy-peer-deps for compatibility)
npm install --legacy-peer-deps

# Verify installation
npm list --depth=0
```

**Expected output**: Should show ~88 production dependencies without errors.

### Step 2: Environment Configuration

Create a `.env` file in the root directory. **Required variables** for basic operation:

```bash
# === CORE CONFIGURATION (REQUIRED) ===
NODE_ENV=development
PORT=3000

# Database (PostgreSQL - Neon Cloud or Local)
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"

# Redis Cache (Upstash Cloud or Local)
REDIS_URL="redis://default:password@host:port"

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key-min-32-chars-recommended"
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# === OPTIONAL BUT RECOMMENDED ===

# Clerk Authentication (if using Clerk)
CLERK_SECRET_KEY="sk_test_..."
CLERK_PUBLISHABLE_KEY="pk_test_..."

# Email Notifications (SendGrid or SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@mash.com

# Firebase (for Storage & FCM)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com

# OpenTelemetry Tracing
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces

# Frontend URL (for CORS and email links)
FRONTEND_URL=http://localhost:3001
```

**Quick tip**: Copy `.env.example` if available:
```bash
cp .env.example .env
# Then edit .env with your actual credentials
```

### Step 3: Database Setup

```bash
# Generate Prisma Client (creates type-safe database client)
npx prisma generate

# Run database migrations (creates all tables)
npx prisma migrate dev

# Seed database with initial data (optional but recommended)
npm run db:seed
```

**Troubleshooting**:
- If migrations fail, check `DATABASE_URL` connection string
- For "SSL required" errors, add `?sslmode=require` to DATABASE_URL
- Use `npx prisma migrate reset` to reset database (WARNING: deletes all data)

### Step 4: Build the Application

```bash
# Build TypeScript to JavaScript
npm run build

# Verify build output
ls dist/main.js  # Linux/Mac
dir dist\main.js  # Windows
```

**Expected output**: 
- `dist/` folder created
- `dist/main.js` exists (entry point)
- Build completes without TypeScript errors

**If build fails**:
```bash
# Check for TypeScript errors
npm run type-check

# Fix linting issues
npm run lint -- --fix

# Clean build (if needed)
rm -rf dist node_modules package-lock.json  # Linux/Mac
rmdir /s /q dist node_modules & del package-lock.json  # Windows
npm install --legacy-peer-deps
npm run build
```

### Step 5: Run the Backend

#### **Development Mode** (Recommended for local development)

```bash
# Start with hot-reload (auto-restart on code changes)
npm run start:dev
```

**What happens**:
- ✅ Server starts on `http://localhost:3000`
- ✅ Swagger API docs available at `http://localhost:3000/api/docs`
- ✅ Health check at `http://localhost:3000/api/v1/health`
- ✅ Prometheus metrics at `http://localhost:3000/metrics`
- ✅ File watching enabled (changes auto-reload)

#### **Production Mode** (For deployment or testing production build)

```bash
# Build first (if not already built)
npm run build

# Start production server
npm run start:prod
```

**Production features**:
- ✅ Optimized performance
- ✅ JSON logging (structured logs)
- ✅ No file watching (faster startup)
- ✅ Process management ready (PM2, Docker, etc.)

#### **Debug Mode** (For troubleshooting)

```bash
# Start with Node.js debugger attached
npm run start:debug
```

**Debugger access**:
- Debugger listening on `ws://127.0.0.1:9229`
- Use Chrome DevTools: `chrome://inspect`
- VSCode: Use "Attach to Node Process" debug configuration

### Step 6: Verify Backend is Running

Open a new terminal and test the endpoints:

```bash
# Test health endpoint
curl http://localhost:3000/api/v1/health

# Expected response:
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "memory_heap": { "status": "up" }
  }
}

# Test Swagger documentation
# Open in browser: http://localhost:3000/api/docs

# Test Prometheus metrics
curl http://localhost:3000/metrics
```

### Step 7: Start Monitoring Stack (Optional)

```bash
# Start Prometheus, Grafana, Jaeger with Docker
docker compose -f docker-compose.dev.yml up -d

# Access monitoring dashboards:
# - Grafana: http://localhost:4000 (admin/admin)
# - Prometheus: http://localhost:9090
# - Jaeger: http://localhost:16686
```

### Complete Startup Command Reference

| Command | Purpose | Use When |
|---------|---------|----------|
| `npm run start:dev` | Hot-reload development server | Active development, coding |
| `npm run start:prod` | Production optimized server | Testing production build |
| `npm run start:debug` | Development server with debugger | Debugging issues |
| `npm run build` | Compile TypeScript to JavaScript | Before production deployment |
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
