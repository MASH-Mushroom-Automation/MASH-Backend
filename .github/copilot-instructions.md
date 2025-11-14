# MASH-Backend - AI Coding Agent Guide

**NestJS 10 + Prisma 5 + PostgreSQL 15 | E-commerce + IoT Platform**  
**Production**: Railway (https://mash-backend-api-production.up.railway.app)

---

## 🚀 Quick Start (Windows)

```bash
npm install --legacy-peer-deps  # REQUIRED - peer deps conflict
npx prisma generate             # REQUIRED - generates client
npm run build && npm run start:dev
```

**Clean install if broken:**
```cmd
rmdir /s /q node_modules dist
del package-lock.json
npm install --legacy-peer-deps && npx prisma generate
```

---

## 🏗️ Critical Architecture Patterns

### 1. **Lazy-Loaded Prisma Client** (Windows DLL Fix)
**Problem**: Static imports crash Windows with DLL load errors  
**Solution**: PrismaService uses dynamic imports, lazy initialization  
**Rule**: NEVER `new PrismaClient()` - ALWAYS inject `PrismaService`
```typescript
// ❌ WRONG - crashes on Windows
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ✅ CORRECT - inject lazy-loaded service
constructor(private prisma: PrismaService) {}
```
**See**: `src/database/prisma.service.ts` (lines 1-80)

### 2. **Graceful Redis Degradation**
**Design**: App runs WITHOUT Redis if unavailable  
**Pattern**: `RedisService` returns `null` when Redis down, callers check null
```typescript
const cached = await this.redis.get('key'); // May return null
if (!cached) {
  // Fallback to database
  const data = await this.prisma.user.findUnique(...);
}
```
**Why**: Prevents Redis outage from taking down entire app  
**See**: `src/database/redis.service.ts` (lines 1-60)

### 3. **Emergency Health Check Bypass** (Railway Fix)
**Problem**: Health checks fail during slow startup (crash loop)  
**Solution**: Express middleware responds BEFORE NestJS modules load
```typescript
// src/main.ts - BEFORE app initialization
app.use('/api/v1/health', (req, res, next) => {
  res.status(200).json({ status: 'ok', emergency: true });
});
```
**When to use**: Railway deployments, container health checks  
**See**: `src/main.ts` (lines 71-85), `docs/RAILWAY_CRASH_LOOP_FIX_PLAN.md`

### 4. **Multi-Strategy Authentication**
- **JWT** (default): `@UseGuards(JwtAuthGuard)` - user/password login
- **Clerk**: Webhook `/api/v1/auth/clerk-webhook` - SSO
- **Firebase**: `FirebaseStrategy` - mobile apps
- **OAuth**: `googleId`/`facebookId` in User model
- **Public**: `@Public()` decorator - no auth

**Roles**: USER, GROWER, ADMIN, SUPER_ADMIN  
**See**: `src/modules/auth/strategies/`

### 5. **Email Failover Chain**
SendGrid API → Nodemailer SMTP → ngrok relay (Railway port 587 blocked)  
**Why**: Railway blocks SMTP port, ngrok tunnels localhost SMTP  
**See**: `docs/NGROK_SMTP_SETUP_GUIDE.md`

### 6. **Observability Stack**
- **Metrics**: 60+ Prometheus metrics at `/metrics`
- **Tracing**: OpenTelemetry (commented out - build issue)
- **Logging**: Winston with correlation IDs
- **Health**: `/api/v1/health` (emergency bypass + full controller)
- **Dashboards**: Grafana (13 panels), Jaeger, Alertmanager

**See**: `src/monitoring/`, `grafana/dashboards/`, `prometheus/`

---

## 📋 Daily Commands

```bash
# Development
npm run start:dev              # Build + watch (localhost:3000)
npx prisma studio              # Visual DB editor
npx prisma generate            # After schema.prisma changes
npx prisma migrate dev         # Create migration

# Testing
npm test                       # Unit tests
npm run test:e2e              # E2E tests
npm run postman:test          # API collection tests
npm run test:all              # All tests

# Database
npm run db:generate           # Generate Prisma client
npm run db:migrate            # Create migration
npm run db:push               # Push schema (no migration)
npm run db:seed               # Seed database

# Infrastructure
docker compose -f docker-compose.dev.yml up -d   # Full stack
docker compose -f docker-compose.dev.yml down    # Stop stack
```

---

## 🏛️ Module Structure

```
src/modules/feature/
├── feature.module.ts          # @Module with imports/providers
├── feature.controller.ts      # @Controller + @ApiTags (Swagger)
├── feature.service.ts         # Inject PrismaService, RedisService
├── feature.spec.ts            # Unit tests
└── dto/                       # @IsString, @IsEmail, etc.
    ├── create-feature.dto.ts
    └── update-feature.dto.ts
```

**Generate module:**
```bash
nest g module modules/feature
nest g controller modules/feature
nest g service modules/feature
```

---

## 💾 Database Patterns

### Transaction Pattern
```typescript
// Use executeTransaction for multi-step operations
await this.prisma.executeTransaction(async (tx) => {
  const order = await tx.order.create({ data: orderData });
  await tx.inventory.update({ where: { id }, data: { stock: { decrement: 1 }}});
  return order;
});
```

### Caching Pattern
```typescript
// Try cache → fallback to DB → populate cache
const cacheKey = `user:${id}`;
let user = await this.redis.get(cacheKey);

if (!user) {
  user = await this.prisma.user.findUnique({ where: { id }});
  if (user) await this.redis.set(cacheKey, user, 300); // 5min TTL
}
```

### Error Handling
```typescript
// ✅ Use NestJS exceptions
throw new NotFoundException(`User ${id} not found`);
throw new ConflictException('Email already exists');
throw new BadRequestException('Invalid input');

// ❌ Never throw generic Error
throw new Error('Something failed'); // WRONG
```

---

## 🚢 Deployment (Railway)

### Critical Environment Variables
```bash
NODE_ENV=production           # CRITICAL - development crashes in prod
DATABASE_URL=postgresql://... # Neon PostgreSQL
JWT_SECRET=<random-256-bit>   # MUST be secure random
REDIS_URL=rediss://...        # Upstash Redis (optional)
PORT=3000                     # Railway auto-assigns
```

### Common Deployment Issues

**Crash Loop (restarts every 4s)**
- **Cause**: `NODE_ENV=development` loads dev dependencies not in Docker image
- **Fix**: Set `NODE_ENV=production` in Railway Variables
- **See**: `docs/RAILWAY_CRASH_LOOP_FIX_PLAN.md`

**Health Check Fails**
- **Symptom**: 10 attempts fail, deployment never succeeds
- **Cause**: App initialization too slow (>300s timeout)
- **Fix**: Emergency bypass responds before full startup
- **See**: `docs/RAILWAY_FIX_NOW.md`, `src/main.ts` (lines 71-85)

**Build Fails**
- **Cause**: npm install peer dependency conflicts
- **Fix**: Use `npm install --legacy-peer-deps` in Dockerfile (already done)
- **See**: `Dockerfile` (line 21)

---

## 🧪 Testing

### Postman Collections
```bash
npm run postman:test          # All collections
npm run postman:auth          # Auth endpoints
npm run postman:orders        # Orders endpoints
```

### Test Structure
- `*.spec.ts` - Unit tests (services, utilities)
- `*.int-spec.ts` - Integration tests (database)
- `test/**/*.e2e-spec.ts` - E2E tests (HTTP endpoints)

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3000 in use | `netstat -ano \| findstr :3000` → `taskkill /PID <PID> /F` |
| Cannot find module | Clean install (see Quick Start) |
| Prisma out of sync | `npx prisma generate` |
| Redis errors | App continues - check logs for graceful degradation |
| Build fails on Windows | Use `--legacy-peer-deps` flag |
| Health check fails Railway | Check `NODE_ENV=production`, see docs/RAILWAY_FIX_NOW.md |

---

## 📚 Key Documentation

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema (source of truth) |
| `src/main.ts` | Bootstrap, emergency health, error handling |
| `src/app.module.ts` | Root module, imports all features |
| `docker-compose.dev.yml` | Local dev stack (Postgres, Redis, MQTT) |
| `Dockerfile` | Production build (Railway deployment) |
| `docs/RAILWAY_CRASH_LOOP_FIX_PLAN.md` | Deployment crash loop fixes |
| `docs/NGROK_SMTP_SETUP_GUIDE.md` | Email relay setup |
| `postman/*.json` | API test collections |

---

## ✅ Best Practices

**Always:**
- Inject `PrismaService`, never create raw client
- Run `npx prisma generate` after schema changes
- Add `@ApiTags`, `@ApiOperation` for Swagger docs
- Use NestJS exceptions (NotFoundException, etc.)
- Check if Redis available before using cache
- Add try-catch in `src/main.ts` for module errors

**Never:**
- Import `PrismaClient` directly (Windows crash)
- Edit migration files manually
- Deploy without `NODE_ENV=production`
- Use `any` type in TypeScript
- Commit `.env` to git
- Throw generic `Error` (use NestJS exceptions)

---

## 🎯 Project Specifics

1. **Windows-focused**: All commands tested on Windows (cmd/PowerShell)
2. **IoT platform**: MQTT broker (Mosquitto) in docker-compose
3. **Multi-channel comms**: Email/SMS/push via CommunicationHubService
4. **Observability-first**: 60+ Prometheus metrics, tracing, correlation IDs
5. **Railway deployment**: Production on Railway, ngrok SMTP relay
6. **Graceful degradation**: Runs without Redis, MQTT, OpenTelemetry

---

**Quick Reference**: `src/main.ts` (app bootstrap) • `prisma/schema.prisma` (data model) • `docker-compose.dev.yml` (local infra)