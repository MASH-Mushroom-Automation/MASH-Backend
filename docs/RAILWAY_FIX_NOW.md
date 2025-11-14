# 🚨 RAILWAY FIX - DO THIS NOW (2 Minutes)

**Problem:** Health check failing after 10 attempts
**Root Cause:** Missing `JWT_SECRET` environment variable in Railway
**Status:** 🔴 CRITICAL - Server won't start without it

---

## ⚡ THE FIX (Copy/Paste These Exact Steps)

### Step 1: Open Railway (30 seconds)
1. Go to: **https://railway.app/dashboard**
2. Click: **mash-backend-api** project
3. Click: **"Variables"** tab (top navigation)

### Step 2: Add JWT_SECRET (30 seconds)
1. Click: **"+ New Variable"** button
2. **Variable Name:** `JWT_SECRET`
3. **Variable Value:** `your-super-secret-jwt-key-change-this-in-production`
4. Click: **"Add"** or press Enter

### Step 3: Wait for Auto-Redeploy (4-5 minutes)
Railway will automatically redeploy when you add the variable.

**Watch for:**
- Build starts (30 seconds after adding variable)
- Build completes (4-5 minutes)
- Health check PASSES on attempt #1-2 ✅

---

## 📋 Optional: Add All Missing Variables

While you're in the Variables tab, add these too (recommended):

```
DATABASE_URL=postgresql://neondb_owner:npg_B4tIx6OCXiDN@ep-wispy-dream-aduaegct-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&connection_limit=3&pool_timeout=20

NODE_ENV=production

CORS_ORIGINS=https://mash-backend-api-production.up.railway.app,http://localhost:4200,http://localhost:5173

BACKEND_URL=https://mash-backend-api-production.up.railway.app

APP_URL=https://mash-backend-api-production.up.railway.app

FRONTEND_URL=https://mash-backend-api-production.up.railway.app
```

---

## ✅ How to Verify Success

### 1. Check Railway Logs (2 minutes after redeploy)
Look for these messages in Deploy Logs:
```
[STARTUP] Bootstrap function started
=== ENVIRONMENT DIAGNOSTIC ===
JWT_SECRET: ✅ SET
DATABASE_URL: ✅ SET
[EMERGENCY] Health check bypass route registered
=== READY FOR TRAFFIC ===
```

### 2. Test Health Endpoint (immediately after "READY FOR TRAFFIC")
```bash
curl -i https://mash-backend-api-production.up.railway.app/api/v1/health
```

**Expected Response:**
```json
HTTP/2 200 OK

{
  "status": "ok",
  "message": "MASH Backend API is alive",
  "timestamp": "2025-11-15T...",
  "uptime": 45,
  "env": "production",
  "emergency": true
}
```

---

## 🎯 Why JWT_SECRET is Required

Looking at your code (`src/modules/auth/strategies/jwt.strategy.ts` line 20-25):

```typescript
constructor(
  private configService: ConfigService,
  private prisma: PrismaService,
) {
  const secret = configService.get<string>('JWT_SECRET');
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  // ...
}
```

**Without JWT_SECRET:**
- ❌ App throws fatal error during initialization
- ❌ Server never reaches "READY FOR TRAFFIC"
- ❌ Health endpoint never becomes available
- ❌ Railway health checks fail → deployment fails

**With JWT_SECRET:**
- ✅ App initializes successfully
- ✅ Emergency bypass route responds in <10ms
- ✅ Health check passes on attempt #1
- ✅ Deployment succeeds

---

## 📊 Expected Timeline

| Time | Event |
|------|-------|
| T+0:00 | Add JWT_SECRET variable in Railway |
| T+0:30 | Railway detects change, starts build |
| T+5:00 | Build completes |
| T+5:30 | Server logs "READY FOR TRAFFIC" |
| T+5:35 | **Health check PASSES** ✅ |
| T+6:00 | Deployment marked "Successful" 🎉 |

---

## 🆘 If Still Failing After Adding JWT_SECRET

1. **Check Deploy Logs for:**
   ```
   DATABASE_URL: ❌ MISSING
   ```
   → Add DATABASE_URL (see full list above)

2. **Verify JWT_SECRET was saved:**
   - Go to Variables tab
   - Look for JWT_SECRET in the list
   - If missing, add it again

3. **Check Build Logs for errors:**
   - Click "Build Logs" tab
   - Look for TypeScript compilation errors
   - Look for "npm ERR!" messages

4. **Manual Redeploy:**
   - Click "Deployments" tab
   - Click "Deploy" button
   - Wait 5 minutes

---

**Bottom Line:** Add `JWT_SECRET` to Railway Variables → Wait 6 minutes → Health check passes ✅

**Estimated Time to Fix:** 2 minutes of work, 6 minutes total (including redeploy)

---

**Created:** November 15, 2025, 12:22 AM
**For:** Railway health check failure (10 attempts)
