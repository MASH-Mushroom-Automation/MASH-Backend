# Railway Deployment Fix Plan

## 🔍 Problem Analysis

**Issue**: Health check endpoint `/api/v1/health` is not responding (service unavailable)

**Current Status**:
- ✅ Docker build: **SUCCESS** (175.50 seconds)
- ✅ Image creation: **SUCCESS**
- ❌ Health check: **FAILED** (14 attempts over 5 minutes)
- ❌ Application startup: **UNKNOWN** (need logs)

---

## 📊 Diagnostic Steps (Priority Order)

### Step 1: Check Application Startup Logs ⚡ CRITICAL
**Action**: View Railway deployment logs to see why the app isn't starting

**How to Check**:
1. Go to Railway Dashboard → `mash-backend-api` service
2. Click **"Deployments"** tab
3. Click on the **failed deployment**
4. Click **"View Logs"** or **"Deploy Logs"** tab
5. Look for error messages in the **application logs** (not build logs)

**What to Look For**:
- ❌ `Error: Cannot find module`
- ❌ `ECONNREFUSED` (database connection failed)
- ❌ `Missing environment variable`
- ❌ `Port already in use`
- ❌ `Sharp module` errors
- ❌ Stack traces or exceptions

**Expected Behavior**:
```
[Nest] 1  - 10/21/2025, XX:XX:XX AM     LOG [NestFactory] Starting Nest application...
[Nest] 1  - 10/21/2025, XX:XX:XX AM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 1  - 10/21/2025, XX:XX:XX AM     LOG [NestApplication] Nest application successfully started
[Nest] 1  - 10/21/2025, XX:XX:XX AM     LOG Application is running on: http://[::]:3000
```

---

### Step 2: Verify Environment Variables 🔧 HIGH PRIORITY

**Required Variables** (check Railway service settings):

#### Database Connection (CRITICAL)
```bash
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
DIRECT_URL=postgresql://user:password@host:5432/database?sslmode=require
```

#### Port Configuration (CRITICAL)
```bash
PORT=3000  # Must match Railway's injected PORT or be omitted
```

#### Authentication (CRITICAL)
```bash
# Clerk Auth
CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# JWT
JWT_SECRET=your-long-secure-secret-min-32-chars
JWT_EXPIRES_IN=7d
```

#### Redis (if used)
```bash
REDIS_URL=redis://default:password@host:6379
```

#### Other Required
```bash
NODE_ENV=production
APP_URL=https://your-app.railway.app
FRONTEND_URL=https://your-frontend.com
```

**How to Check**:
1. Railway Dashboard → Service → **Variables** tab
2. Ensure all required variables are set
3. Check for typos or missing values

---

### Step 3: Verify Health Check Endpoint Configuration 🏥 HIGH PRIORITY

**Current Configuration**:
- Path: `/api/v1/health`
- Timeout: 300 seconds (5 minutes)
- Port: Should use Railway's `PORT` variable

**Potential Issues**:

#### Issue 3.1: Port Mismatch
**Problem**: App listening on wrong port
**Solution**: 
```typescript
// In main.ts, ensure:
const port = process.env.PORT || 3000;
await app.listen(port, '0.0.0.0'); // Listen on all interfaces
```

#### Issue 3.2: Health Check Path Wrong
**Problem**: Endpoint doesn't exist or has different path
**Solution**: Verify in Railway settings:
- Service Settings → Healthcheck Path: `/api/v1/health`

#### Issue 3.3: Global Prefix Issue
**Problem**: App uses `/api/v1` prefix but health check doesn't
**Check**: Verify `main.ts` has:
```typescript
app.setGlobalPrefix('api/v1');
```

---

### Step 4: Test Health Endpoint Locally 🧪 MEDIUM PRIORITY

**Action**: Verify health endpoint works locally

```bash
# Build and run locally
npm run build
npm run start:prod

# In another terminal, test health endpoint
curl http://localhost:3000/api/v1/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-10-21T...",
  "uptime": 123.456
}
```

---

## 🔨 Potential Fixes (Based on Common Issues)

### Fix 1: Missing Environment Variables
**If logs show**: `Missing required environment variable`

**Solution**:
1. Go to Railway → Service → Variables
2. Add all required variables (see Step 2)
3. Click **"Redeploy"**

---

### Fix 2: Database Connection Failed
**If logs show**: `ECONNREFUSED`, `Connection timeout`, `authentication failed`

**Solution**:
1. Verify DATABASE_URL format:
   ```
   postgresql://user:pass@host.railway.app:5432/railway?sslmode=require
   ```
2. Check if database service is running in Railway
3. Verify database credentials are correct
4. Ensure `?sslmode=require` is added to connection string

---

### Fix 3: Port Configuration Issue
**If logs show**: `EADDRINUSE`, `Port 3000 is already in use`

**Solution**:

**Option A**: Remove PORT variable (let Railway inject it)
1. Railway → Service → Variables
2. Delete `PORT` variable if manually set
3. Redeploy

**Option B**: Ensure app listens on Railway's PORT
```typescript
// main.ts
const port = process.env.PORT || 3000;
await app.listen(port, '0.0.0.0'); // Must bind to 0.0.0.0
```

---

### Fix 4: Health Check Endpoint Not Accessible
**If logs show**: App starts but health check fails

**Solution A**: Add hostname whitelist
```typescript
// main.ts
app.enableCors({
  origin: ['healthcheck.railway.app', process.env.FRONTEND_URL],
  credentials: true,
});
```

**Solution B**: Ensure no auth on health endpoint
```typescript
// health.controller.ts
@Get()
@Public() // Should bypass authentication
async check(): Promise<HealthCheckResult> {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}
```

---

### Fix 5: Prisma Migration Not Run
**If logs show**: `Table 'users' doesn't exist`, `Invalid schema`

**Solution**: Add migration to Dockerfile or Railway settings

**Option A**: Update Dockerfile (before COPY dist)
```dockerfile
# After installing dependencies, run migrations
RUN npx prisma migrate deploy

# Or in production stage:
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
RUN npx prisma migrate deploy  # Add this line
```

**Option B**: Add Railway deploy command
1. Railway → Service → Settings → Deploy
2. Start Command: 
   ```bash
   npx prisma migrate deploy && node dist/src/main.js
   ```

---

### Fix 6: Sharp Library Still Failing
**If logs show**: `Could not load sharp module`

**Already Fixed**: Dockerfile now includes `vips` runtime library ✅

**If still failing**: Check logs for specific Sharp error and try:
```dockerfile
# Add to production stage BEFORE npm rebuild
RUN npm install --arch=x64 --platform=linux --libc=musl sharp
```

---

## 🚀 Recommended Action Plan

### Immediate Actions (Do These First):

1. **Check Application Logs** ⚡
   ```
   Railway → Deployments → Failed Deploy → View Logs
   ```
   - This will reveal the ACTUAL error
   - Share the error message for specific fix

2. **Verify Environment Variables** 🔧
   ```
   Railway → Service → Variables tab
   ```
   - Ensure DATABASE_URL, CLERK keys, JWT_SECRET are set
   - Remove PORT variable (let Railway inject it)

3. **Test Health Endpoint Path** 🏥
   ```
   Railway → Service → Settings → Healthcheck Path
   ```
   - Verify it's set to: `/api/v1/health`
   - Match with your actual controller route

### If Logs Show Specific Error:

| Error Message | Fix Location | Action |
|---------------|--------------|--------|
| `Missing DATABASE_URL` | Railway Variables | Add database connection string |
| `ECONNREFUSED` | Database | Check DB service is running |
| `Cannot find module` | Dockerfile | Verify COPY statements |
| `Port in use` | main.ts | Use `process.env.PORT` |
| `Table doesn't exist` | Prisma | Run migrations in Railway |
| `Sharp error` | Dockerfile | Already fixed, redeploy |
| `Clerk error` | Railway Variables | Add Clerk API keys |

---

## 📝 Next Steps

**Step 1**: Check the application logs in Railway
**Step 2**: Share the error message from logs
**Step 3**: Apply specific fix based on error
**Step 4**: Redeploy and monitor logs

---

## 🔍 Debug Commands (Run in Railway Shell)

If you have Railway CLI:
```bash
# View live logs
railway logs

# Connect to service shell
railway shell

# Inside shell:
node dist/src/main.js  # Test startup manually
curl localhost:3000/api/v1/health  # Test health endpoint
```

---

## ⚠️ Important Notes

1. **Don't guess** - Check logs first to see actual error
2. **One fix at a time** - Apply fixes individually and test
3. **Database required** - App won't start without valid DATABASE_URL
4. **Redis optional** - App should gracefully handle missing Redis
5. **Migrations** - Ensure database schema is up to date

---

## 📞 Need Help?

If you share the **actual error message from Railway logs**, I can provide a **specific fix** instead of generic solutions.

**What to share**:
- Screenshot or text of Railway deployment logs (the red error lines)
- Any stack traces
- Environment variables (hide sensitive values)

---

**Last Updated**: October 21, 2025  
**Status**: Waiting for application logs to diagnose specific issue
