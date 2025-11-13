# Railway Deployment Troubleshooting Guide

**Last Updated:** November 14, 2025  
**Issue:** Health check endpoint not responding - application crashing on startup

---

## 🔍 Changes Made to Fix Health Check Issues

### 1. **Health Endpoint Made Database-Independent** ✅

**File:** `src/health/health.controller.ts`

**Change:** The primary `/api/v1/health` endpoint no longer waits for database connection.

```typescript
@Get()
checkHealth() {
  // IMPORTANT: This endpoint should NOT await database connection
  // It's designed for rapid health checks by load balancers
  return {
    status: 'ok',
    message: 'MASH Backend API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    env: process.env.NODE_ENV || 'development',
  };
}
```

**Why:** Railway's health check needs a fast response. Database connections can be slow on cold starts.

**Separate Database Check:** Use `/api/v1/health/database` for actual database connectivity testing.

---

### 2. **Enhanced Startup Logging** ✅

**File:** `src/main.ts`

**Added logging for:**
- Environment variables (DATABASE_URL, PORT, NODE_ENV)
- Each bootstrap stage with timing
- Critical errors with full context

```typescript
logger.log('[STARTUP] Bootstrap function started');
logger.log(`[ENV] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
logger.log(`[ENV] PORT: ${process.env.PORT || 'not set (default 3000)'}`);
logger.log(`[ENV] DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ MISSING'}`);
```

**Why:** Helps identify missing environment variables in Railway logs.

---

### 3. **Increased Docker Health Check Timeout** ✅

**File:** `Dockerfile`

**Changed:**
```dockerfile
# Before: 120s start-period, 30s timeout
HEALTHCHECK --interval=30s --timeout=30s --start-period=120s --retries=3

# After: 180s start-period, 45s timeout
HEALTHCHECK --interval=30s --timeout=45s --start-period=180s --retries=3
```

**Why:** Railway cold starts can take longer, especially with Prisma engine initialization.

---

### 4. **Better Error Logging** ✅

**File:** `src/main.ts`

**Enhanced bootstrap error handler:**
```typescript
.catch(error => {
  logger.error('[ERROR] FATAL ERROR DURING BOOTSTRAP:');
  logger.error(`Error name: ${error.name}`);
  logger.error(`Message: ${error.message}`);
  logger.error(`Stack: ${error.stack}`);
  
  // Log critical environment variables
  logger.error('[DEBUG] Environment check:');
  logger.error(`  DATABASE_URL: ${process.env.DATABASE_URL ? '✅ SET' : '❌ MISSING'}`);
  logger.error(`  PORT: ${process.env.PORT || '❌ NOT SET'}`);
  // ... more checks
});
```

**Why:** Provides immediate visibility into missing or invalid configuration.

---

## 🚨 Common Railway Deployment Issues

### Issue 1: Missing DATABASE_URL

**Symptom:** App crashes immediately on startup, health checks fail.

**Log Pattern:**
```
[ENV] DATABASE_URL: ❌ MISSING
```

**Fix:**
1. Go to Railway project → Variables
2. Add `DATABASE_URL` with your PostgreSQL connection string
3. Format: `postgresql://user:password@host:port/database?sslmode=require`

---

### Issue 2: Prisma Engine Download Timeout

**Symptom:** Build succeeds but runtime fails with "Prisma engine not found".

**Log Pattern:**
```
Prisma generate failed, retrying...
```

**Fix:** Already handled in Dockerfile with retry logic and pre-configured targets:
```dockerfile
ENV PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl,linux-musl-openssl-3.0.x
```

---

### Issue 3: Port Binding Issues

**Symptom:** App starts but Railway can't route traffic.

**Log Pattern:**
```
[CONFIG] Stage 9: Binding to port 3000 on 0.0.0.0...
```

**Fix:** Ensure app binds to `0.0.0.0`, not `localhost`:
```typescript
await app.listen(port, '0.0.0.0'); // ✅ Correct
await app.listen(port); // ❌ May bind to localhost only
```

**Already Fixed:** Line 212 in `src/main.ts`

---

### Issue 4: Health Check Path Mismatch

**Symptom:** Railway shows "health check endpoint didn't respond as expected".

**Current Configuration:**
- **Railway Config:** `/api/v1/health` (railway.json)
- **Docker Config:** Runs `node dist/health/health-check.js` which hits `/api/v1/health`
- **Controller:** `@Controller('health')` under `api/v1` prefix

**Fix Verification:**
```bash
# Test locally
curl http://localhost:3000/api/v1/health

# Expected response:
{
  "status": "ok",
  "message": "MASH Backend API is running",
  "timestamp": "2025-11-14T...",
  "version": "1.0.0",
  "uptime": 120
}
```

---

### Issue 5: Memory Issues

**Symptom:** App crashes with OOM (Out of Memory) errors.

**Fix in Railway:**
1. Go to Settings → Resources
2. Increase memory allocation (default is 512MB)
3. Recommended: 1GB for NestJS + Prisma

---

### Issue 6: Redis Connection Errors (Non-Critical)

**Symptom:** Warnings about Redis connection failures.

**Note:** App designed to run WITHOUT Redis (graceful degradation).

**Log Pattern:**
```
[WARN] Redis connection failed, running without cache
```

**Fix (Optional):**
1. Add Redis plugin in Railway
2. Set `REDIS_HOST`, `REDIS_PORT` variables

---

## 🔧 Debugging Checklist

### Pre-Deployment
- [ ] All required environment variables set in Railway
- [ ] DATABASE_URL is valid PostgreSQL connection string
- [ ] JWT_SECRET is set (random 32+ character string)
- [ ] NODE_ENV is set to 'production'

### Post-Deployment
- [ ] Build logs show successful compilation
- [ ] No errors in startup logs
- [ ] Environment check shows all ✅ marks
- [ ] Health endpoint responds within 10s
- [ ] Database endpoint (optional) shows connection

---

## 📊 Expected Startup Logs (Healthy Deployment)

```log
[STARTUP] Bootstrap function started
[ENV] NODE_ENV: production
[ENV] PORT: 3000
[ENV] DATABASE_URL: ✅ Set
[CONFIG] Stage 1: Creating NestJS application...
[SUCCESS] Stage 1 complete: Application created
[CONFIG] Stage 2: Setting up custom logger...
[SUCCESS] Stage 2 complete: Logger configured
...
[CONFIG] Stage 9: Binding to port 3000 on 0.0.0.0...
[SUCCESS] Stage 9 complete: Server listening on port 3000
[READY] Application successfully started!
[INFO] Running on: http://localhost:3000
[HEALTH] Health Check: http://localhost:3000/api/v1/health
```

---

## 🚀 Deployment Commands

### Trigger New Deployment
Railway auto-deploys on git push to main. Manual trigger:

```bash
# Commit changes
git add .
git commit -m "fix: resolve Railway health check issues"
git push origin main
```

### View Logs
```bash
# Via Railway CLI
railway logs

# Or use Railway dashboard → Deploy Logs tab
```

---

## 📞 Support

If issues persist after applying these fixes:

1. **Check Railway Status:** https://railway.app/status
2. **Review Deploy Logs:** Look for the specific error message
3. **Verify Environment:** Ensure all variables are set correctly
4. **Test Locally:** Build and run Docker image locally:
   ```bash
   docker build -t mash-backend .
   docker run -p 3000:3000 --env-file .env mash-backend
   curl http://localhost:3000/api/v1/health
   ```

---

## ✅ Success Indicators

Your deployment is healthy when:

- ✅ Build completes in <5 minutes
- ✅ Health checks pass within 30 seconds
- ✅ No restart loops
- ✅ `/api/v1/health` returns `{"status":"ok"}`
- ✅ Swagger docs accessible at `/api/docs`

---

**Next Steps After Successful Deployment:**
1. Test all critical endpoints
2. Verify database migrations applied
3. Check monitoring metrics at `/metrics`
4. Configure custom domain (optional)
