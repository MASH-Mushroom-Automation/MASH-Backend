# MASH-Backend - AI Coding Agent Guide

**NestJS 10 + Prisma 5 + PostgreSQL 15 | E-commerce + IoT Platform**

## 🚀 Local Development with Frontend

**Run backend on PORT 4000 to avoid conflict with Next.js frontend (port 3000):**

### Terminal 1: Backend
```bash
cd MASH-Backend
# Create .env from .env.example and set PORT=4000
npm install --legacy-peer-deps  # REQUIRED for Windows
npx prisma generate             # REQUIRED before first run
npm run start:dev               # http://localhost:4000
```

### Terminal 2: Frontend
```bash
cd MASH-Ecommerce-Web
npm install && npm run dev      # http://localhost:3000
```

### Backend .env (minimum for local dev)
```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://user:pass@host/db?schema=public"
JWT_SECRET="your-secret-key-32-chars-minimum"
JWT_EXPIRATION=1d
CORS_ORIGINS=http://localhost:3000
```

## Critical Setup (Windows)

```bash
npm install --legacy-peer-deps  # REQUIRED
npx prisma generate             # REQUIRED
npm run build && npm run start:dev
```

**Windows troubleshooting**: Clean install if fails:
```cmd
rmdir /s /q node_modules dist
del package-lock.json
npm install --legacy-peer-deps && npx prisma generate
```


## Architecture Decisions

### 1. Lazy-Loaded Prisma Client (Windows DLL Fix)
**Why**: Static imports crash Windows. PrismaService uses dynamic imports.
**NEVER** create new PrismaClient() directly. ALWAYS inject PrismaService.
**See**: src/database/prisma.service.ts

### 2. Graceful Redis Degradation
**Why**: App must run without Redis. RedisService returns null when unavailable.
**See**: src/database/redis.service.ts

### 3. Multi-Strategy Auth
- JWT (default): @UseGuards(JwtAuthGuard)
- Clerk Webhooks: /api/v1/auth/clerk-webhook
- OAuth: googleId/facebookId in User model
- Public: @Public() decorator
- Roles: USER, GROWER, ADMIN, SUPER_ADMIN

### 4. Email Multi-Provider Fallback
SendGrid → Nodemailer SMTP → ngrok relay (Railway blocks port 587)
**See**: docs/NGROK_SMTP_SETUP_GUIDE.md

### 5. Observability
60+ Prometheus metrics at /metrics, OpenTelemetry tracing, Winston logging
**See**: src/monitoring/, src/health/

## Daily Commands

```bash
npm run start:dev         # localhost:3000
npx prisma studio         # DB GUI
npx prisma generate      # After schema changes!
npx prisma migrate dev   # Create migration
npm test                 # Unit tests
npm run test:e2e        # E2E tests
npm run postman:test    # API tests
docker compose -f docker-compose.dev.yml up -d  # Full stack
```


## Code Conventions

**Module Structure**:
```
src/modules/feature/
├── feature.module.ts
├── feature.controller.ts  # @Controller, @ApiTags
├── feature.service.ts     # Inject PrismaService
├── feature.spec.ts
└── dto/
```

**Database Pattern**: Always inject PrismaService, use `executeTransaction` for multi-step ops

**Error Handling**: Use NestJS exceptions (NotFoundException, ConflictException), never throw Error

**Caching**: Try `redis.get()` → `prisma.findUnique()` → `redis.set(key, data, 300)`

## Common Tasks

**Add table**: Edit prisma/schema.prisma → npx prisma migrate dev --name add_table → npx prisma generate
**Add module**: nest g module modules/feature && nest g controller modules/feature && nest g service modules/feature

## Troubleshooting

- **Port 4000 in use**: `netstat -ano | findstr :4000` → `taskkill /PID <PID> /F`
- **Cannot find module**: Clean install (see top)
- **Prisma out of sync**: `npx prisma generate`
- **Redis errors**: App continues without Redis
- **ERR_REQUIRE_ESM with uuid**: Use `crypto.randomUUID()` instead of uuid package (v9+ is ESM-only)

## ESM/CommonJS Compatibility

**IMPORTANT**: This project uses CommonJS. Avoid ESM-only packages:
- ❌ `uuid` v9+ (ESM-only) → ✅ Use `crypto.randomUUID()` 
- ❌ `nanoid` v4+ → ✅ Use `nanoid@3.x` or `crypto.randomBytes()`

Example fix for uuid:
```typescript
// ❌ Before (breaks with uuid v9+)
import { v4 as uuidv4 } from 'uuid';

// ✅ After (Node.js built-in)
import { randomUUID } from 'crypto';
```

## Key Docs

- Monitoring: docs/monitoring/README.md
- Email: docs/NGROK_SMTP_SETUP_GUIDE.md
- OAuth: docs/OAUTH_SETUP_GUIDE.md
- Schema: prisma/schema.prisma
- Tests: postman/*.json

## Best Practices

**Always**: Inject services, run npx prisma generate after schema changes, add Swagger decorators, use NestJS exceptions

**Never**: Create raw clients, edit migrations manually, deploy without tests, use any type, commit .env

## Project Quirks

1. Windows-focused: All commands tested on Windows
2. IoT integration: MQTT broker in docker-compose.dev.yml
3. Multi-channel: CommunicationHubService handles email/SMS/push
4. Observability-first: 60+ metrics, tracing, correlation IDs
5. Railway deployment: ngrok SMTP relay for email
6. Graceful degradation: Runs without Redis

---

**Need details?** Check src/main.ts (bootstrap), prisma/schema.prisma (data model), docker-compose.dev.yml (infrastructure)