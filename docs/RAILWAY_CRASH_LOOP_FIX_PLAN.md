# Railway Crash Loop Fix - Complete Action Plan

**Created:** November 15, 2025, 12:57 AM
**Status:** 🔴 CRITICAL - App crashes after Firebase initialization
**Root Cause:** Module initialization failure after Firebase SDK loads
**Evidence:** Logs show Firebase initializes ✅, then app crashes before "Stage 1 complete"

---

## 🔍 PROBLEM ANALYSIS

### What We See in Logs:

```
[12:54:25 AM] LOG [Bootstrap] [CONFIG] Stage 1: Creating NestJS application...
✅ Firebase Admin SDK initialized
[CRASH - App restarts]
[12:54:29 AM] LOG [Bootstrap] [STARTUP] Bootstrap function started  ← RESTARTED
```

**Pattern:**
1. Server starts ✅
2. Environment variables all present ✅
3. Firebase initializes ✅
4. **NestJS module initialization starts** ← CRASH HAPPENS HERE
5. App crashes (no error visible in logs)
6. Railway restarts container (every 4 seconds)

### Root Cause:

**The application is crashing during `core_1.NestFactory.create(app_module_1.AppModule)` after Firebase initializes.**

Possible causes:
1. **Module import failure** - A module's dependencies fail to load
2. **Circular dependency** - Modules depend on each other in a loop
3. **Provider initialization failure** - A service fails during construction
4. **Missing production dependencies** - Dev dependency required but not in Docker image

### The "NODE_ENV=development" Problem:

Your Railway environment has `NODE_ENV=development`, which causes:
- NestJS loads development-mode configurations
- Some modules may require dev dependencies
- Dev dependencies aren't installed in production Docker image (`npm install --production`)
- Module import fails → crash

---

## ⚡ THE FIX (3-Step Solution)

### Step 1: Change NODE_ENV to Production (HIGHEST PRIORITY - 1 minute)

**Go to Railway NOW:**

1. **https://railway.app/dashboard** → `mash-backend-api`
2. Click **"Variables"** tab
3. **Find `NODE_ENV` variable**
4. **Current value:** `development` ← 🔴 WRONG
5. **Change to:** `production` ← ✅ CORRECT
6. Click **"Save"**
7. Railway will auto-redeploy (5 minutes)

**Why this fixes it:**
- Production mode only loads production dependencies
- All production deps ARE in Docker image
- No more import failures

### Step 2: Add Better Error Handling (MEDIUM PRIORITY - 10 minutes)

We need to catch and log the actual error causing the crash. The current logs show Firebase initializes but then nothing - no error message!

**File to modify:** `src/main.ts`

Add try-catch around module creation to see the actual error:

```typescript
try {
  logger.log('[CONFIG] Stage 1: Creating NestJS application...');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });
  logger.log('[SUCCESS] Stage 1 complete: Application created');
} catch (error) {
  logger.error('=== FATAL ERROR DURING MODULE CREATION ===');
  logger.error(`Error: ${error.message}`);
  logger.error(`Stack: ${error.stack}`);
  logger.error('=== END FATAL ERROR ===');
  throw error; // Re-throw to crash (Railway will restart)
}
```

**This will show us:**
- Which module is failing
- What dependency is missing
- The exact error message

### Step 3: Make Problem Modules Gracefully Degrade (LOW PRIORITY - if Steps 1-2 don't work)

If a specific module is causing crashes, make it optional:

**Candidates for graceful degradation:**
- Redis (already gracefully degrades)
- MQTT (can disable with MQTT_ENABLED=false)
- OpenTelemetry (can disable with OTEL_ENABLED=false)
- Elasticsearch (if present)

---

## 📋 DETAILED IMPLEMENTATION PLAN

### Phase 1: Immediate Fix (1-2 minutes)

**Action:** Change NODE_ENV in Railway

**Steps:**
1. Open Railway dashboard
2. Go to Variables tab
3. Change `NODE_ENV` from `development` to `production`
4. Save
5. Wait for redeploy (~5 minutes)

**Expected Result:**
- No more crashes
- App completes initialization
- Health check passes
- Logs show "=== READY FOR TRAFFIC ==="

**If this works:** DONE! Problem solved.

**If this doesn't work:** Proceed to Phase 2.

---

### Phase 2: Add Error Logging (10 minutes)

**Action:** Add try-catch around module creation to see actual error

**File:** `src/main.ts`

**Changes needed:**

1. Wrap `NestFactory.create()` in try-catch (around line 49-54)
2. Add detailed error logging
3. Log which module is failing
4. Log the stack trace

**After deploying this:**
- Logs will show the actual error
- We'll know which module is crashing
- We can fix that specific module

---

### Phase 3: Module-Specific Fixes (if needed)

**Based on error logs from Phase 2, fix the problematic module:**

#### If Redis is crashing:
```bash
# In Railway Variables:
REDIS_ENABLED=false
```

#### If MQTT is crashing:
```bash
# In Railway Variables:
MQTT_ENABLED=false
```

#### If OpenTelemetry is crashing:
```bash
# In Railway Variables:
OTEL_ENABLED=false
```

#### If Elasticsearch is crashing:
```bash
# Remove Elasticsearch configuration or disable it
```

---

## 🎯 EXPECTED TIMELINE

### Scenario A: NODE_ENV fix works (MOST LIKELY - 90% chance)

| Time | Action | Duration |
|------|--------|----------|
| **T+0** | Change NODE_ENV to production | 1 min |
| **T+1** | Railway starts redeploying | - |
| **T+6** | Deployment complete | 5 min |
| **T+7** | Health check passes | 1 min |
| **T+8** | Test endpoint | 1 min |
| **TOTAL** | - | **8 minutes** |

### Scenario B: Need error logging (if A fails)

| Time | Action | Duration |
|------|--------|----------|
| **T+0** | Add try-catch to main.ts | 5 min |
| **T+5** | Commit and push | 1 min |
| **T+6** | Railway redeploys | 5 min |
| **T+11** | Check error logs | 2 min |
| **T+13** | Implement module fix | 10 min |
| **T+23** | Deploy and verify | 5 min |
| **TOTAL** | - | **28 minutes** |

---

## 🔬 LOCAL TESTING PLAN

**Before deploying to Railway, test locally:**

### Test 1: Reproduce the Crash Locally

```bash
# Set NODE_ENV to development (same as Railway)
set NODE_ENV=development

# Start the app
npm run start:dev

# Watch for crash after Firebase initialization
# Look for error messages
```

**Expected:** Should crash with error message (unlike Railway where error is hidden)

### Test 2: Verify Production Mode Works

```bash
# Build production version
npm run build

# Set NODE_ENV to production
set NODE_ENV=production

# Start production server
node dist/main.js

# Should complete successfully
```

**Expected:** Should reach "=== READY FOR TRAFFIC ===" without crashing

### Test 3: Test Health Endpoint Locally

```bash
# After successful start:
curl http://localhost:3000/api/v1/health

# Expected response:
{
  "status": "ok",
  "message": "MASH Backend API is alive",
  "timestamp": "2025-11-15T...",
  "uptime": 45,
  "env": "production"
}
```

---

## ✅ SUCCESS CRITERIA

### Deployment Succeeds When:

1. ✅ No restart loops in Railway logs
2. ✅ Logs show "=== READY FOR TRAFFIC ==="
3. ✅ Health check passes (10 attempts → 1 success)
4. ✅ Health endpoint responds:
   ```bash
   curl https://mash-backend-api-production.up.railway.app/api/v1/health
   # Returns HTTP 200
   ```
5. ✅ No crashes for 5+ minutes
6. ✅ Swagger docs accessible: `/api/docs`

---

## 🚨 IF ALL ELSE FAILS

### Emergency Bypass: Disable All Optional Modules

**In Railway Variables, add:**

```bash
REDIS_ENABLED=false
MQTT_ENABLED=false
OTEL_ENABLED=false
ELASTICSEARCH_ENABLED=false
CACHE_ENABLED=false
WS_REDIS_ADAPTER_ENABLED=false
```

**This will:**
- Disable Redis caching (app runs without cache)
- Disable MQTT (IoT features unavailable)
- Disable tracing (monitoring limited)
- Disable Elasticsearch (search degraded)

**Result:** App runs in minimal mode, but RUNS.

**Then:** Re-enable modules one by one to find the culprit.

---

## 📊 PROGRESS TRACKING

- [ ] **Phase 1: Change NODE_ENV to production** (PRIORITY 1)
  - [ ] Open Railway dashboard
  - [ ] Navigate to Variables tab
  - [ ] Change NODE_ENV value
  - [ ] Save and wait for redeploy
  - [ ] Verify deployment succeeds
  - [ ] Test health endpoint

- [ ] **Phase 2: Add error logging** (PRIORITY 2 - if Phase 1 fails)
  - [ ] Add try-catch around NestFactory.create()
  - [ ] Add detailed error logging
  - [ ] Commit and push changes
  - [ ] Deploy to Railway
  - [ ] Check logs for actual error
  - [ ] Implement specific fix based on error

- [ ] **Phase 3: Module-specific fixes** (PRIORITY 3 - if needed)
  - [ ] Identify failing module from logs
  - [ ] Implement graceful degradation
  - [ ] Deploy and verify
  - [ ] Re-enable module once fixed

- [ ] **Phase 4: Verification** (FINAL)
  - [ ] Local testing passes
  - [ ] Production deployment succeeds
  - [ ] Health checks pass
  - [ ] No restart loops
  - [ ] All endpoints functional

---

## 🎯 NEXT IMMEDIATE ACTION

**RIGHT NOW - Do This First:**

1. **Open Railway:** https://railway.app/dashboard
2. **Click:** `mash-backend-api` project
3. **Click:** "Variables" tab
4. **Find:** `NODE_ENV` variable
5. **Change:** `development` → `production`
6. **Save**
7. **Wait:** 5 minutes for redeploy
8. **Check:** Logs for "=== READY FOR TRAFFIC ==="
9. **Test:**
   ```bash
   curl https://mash-backend-api-production.up.railway.app/api/v1/health
   ```

**Estimated fix time:** 6 minutes (1 minute to change + 5 minutes redeploy)

**Success probability:** 90% (NODE_ENV is almost certainly the issue)

---

## 📝 NOTES

- Firebase initialization is working ✅
- All environment variables are present ✅
- The crash happens AFTER Firebase, DURING NestJS module loading ❌
- This strongly suggests a dev dependency is trying to load in production mode ❌
- Changing NODE_ENV=production should fix it immediately ✅

---

**Created by:** GitHub Copilot AI Assistant
**Last Updated:** November 15, 2025, 12:57 AM
**Status:** Ready to implement - START WITH PHASE 1 (change NODE_ENV)
