# Redis Migration - Complete CLI & Dashboard Guide

**Date**: November 18, 2025  
**Status**: ✅ Railway CLI Setup Complete | ⏳ Redis Provisioning Pending

---

## ✅ Progress Checklist

### Phase 1: Railway CLI Setup (COMPLETED) ✅
- [x] Install Railway CLI: `npm install -g @railway/cli`
- [x] Login to Railway: `railway login`
- [x] Authenticate: Logged in as **Jhon Keneth Namias** (jkrbn99@gmail.com)
- [x] Link project: **mash-backend** (production environment)
- [x] Link service: **mash-backend-api**
- [x] Verify connection: `railway whoami` ✅

**Project Details**:
- **Project ID**: `4d3b5375-37f0-4b3f-b48a-b411e17ca06a`
- **Project Name**: `mash-backend`
- **Environment**: `production`
- **Service**: `mash-backend-api`
- **Dashboard URL**: https://railway.app/project/4d3b5375-37f0-4b3f-b48a-b411e17ca06a

---

### Phase 2: Add Redis Database (IN PROGRESS) ⏳

#### Option A: Via Railway Dashboard (RECOMMENDED)

**Step 1: Navigate to Project**
```
1. Open: https://railway.app/project/4d3b5375-37f0-4b3f-b48a-b411e17ca06a
2. You should see your "mash-backend-api" service
```

**Step 2: Add Redis Plugin**
```
1. Click "+ New" button (top-right corner)
2. Select "Database" from dropdown
3. Click "Add Redis"
4. Wait 1-2 minutes for provisioning
```

**Step 3: Verify Redis Added**
```
1. You should see a new "Redis" service card appear
2. Click on the Redis service
3. Check "Deployments" tab - should show "Active"
4. Go to "Variables" tab - should show Redis connection URLs
```

---

#### Option B: Via Railway CLI (Alternative)

**Note**: CLI method requires interactive selection. Dashboard is simpler.

```bash
# Navigate to project directory
cd "C:\Users\Kenneth\Desktop\PP Namias\MASH-Backend"

# Ensure you're linked to the right project
railway status

# Add database (interactive - select Redis from menu)
railway add
# > What do you need? Database
# > Select Redis

# Wait for provisioning
railway status
```

---

### Phase 3: Get Redis Connection URL (PENDING) ⏳

**Wait until Redis provisioning completes** (Step 2).

#### Via Railway Dashboard

```
1. Click on "Redis" service in your project
2. Go to "Variables" tab
3. Look for these variables:
   - REDIS_URL (internal network)
   - REDIS_PRIVATE_URL (alternative name)
   - REDIS_PUBLIC_URL (external access)
4. Copy the INTERNAL URL (format: redis://default:password@redis.railway.internal:6379)
```

#### Via Railway CLI

```bash
# Link to Redis service
railway link
# Select: mash-backend → production → Redis

# Get Redis variables
railway variables --service redis

# Or get specific variable
railway variables get REDIS_URL --service redis
```

**Expected Variables**:
```
REDIS_URL=redis://default:password@redis.railway.internal:6379
REDIS_PUBLIC_URL=redis://default:password@redis.railway.app:6379
```

---

### Phase 4: Update Backend REDIS_URL (PENDING) ⏳

**Current Configuration**:
```
Service: mash-backend-api
Current REDIS_URL: rediss://default:ASc3AAIncDIyOTViMTMwNDVlYTI0ODM4OTBhOGQ5NWFkMGVhN2YyNXAyMTAwMzk@proven-aphid-10039.upstash.io:6379
Provider: Upstash (FREE TIER - QUOTA EXCEEDED)
```

**Target Configuration**:
```
Service: mash-backend-api
New REDIS_URL: redis://default:password@redis.railway.internal:6379
Provider: Railway Redis (UNLIMITED)
```

---

#### Via Railway Dashboard (RECOMMENDED)

**Step 1: Open Backend Service Variables**
```
1. Go to: https://railway.app/project/4d3b5375-37f0-4b3f-b48a-b411e17ca06a
2. Click "mash-backend-api" service
3. Click "Variables" tab
4. Scroll to find "REDIS_URL"
```

**Step 2: Update REDIS_URL**
```
1. Click "Edit" icon next to REDIS_URL variable
2. Replace old Upstash URL with new Railway Redis URL:
   
   OLD: rediss://default:ASc3AAIncDI...@proven-aphid-10039.upstash.io:6379
   NEW: redis://default:password@redis.railway.internal:6379
   
3. Click "Save" or press Enter
4. Railway will auto-deploy with new configuration
```

**Step 3: Remove Old Upstash Variables (Optional)**
```
1. Delete or disable these variables:
   - REDIS_HOST (proven-aphid-10039.upstash.io)
   - REDIS_PASSWORD (ASc3AAIncDI...)
   - REDIS_PORT (6379)
   - UPSTASH_REDIS_REST_TOKEN
   - UPSTASH_REDIS_REST_URL
   
2. Keep only: REDIS_URL (pointing to Railway Redis)
```

---

#### Via Railway CLI

```bash
# Ensure you're linked to backend service
railway link
# Select: mash-backend → production → mash-backend-api

# Update REDIS_URL with Railway Redis URL
railway variables set REDIS_URL="redis://default:NEW_PASSWORD@redis.railway.internal:6379"

# Verify the change
railway variables get REDIS_URL

# Railway auto-deploys after variable change
railway logs --tail
```

---

### Phase 5: Verify Deployment (PENDING) ⏳

#### Check Deployment Status

**Via Railway Dashboard**:
```
1. Go to mash-backend-api service
2. Click "Deployments" tab
3. Watch latest deployment (should auto-trigger after variable change)
4. Wait for green "Success" status
5. Check deployment logs for errors
```

**Via Railway CLI**:
```bash
# Watch deployment logs in real-time
railway logs --service mash-backend-api --tail

# Look for these success indicators:
# ✅ "Redis connected successfully"
# ✅ "BullMQ queues initialized"
# ✅ "Nest application successfully started"
# ✅ "Application is running on: http://[::]:3000"
```

---

#### Test Redis Connection

**Via Railway CLI**:
```bash
# Test Railway Redis connection
railway run --service redis redis-cli PING
# Expected: PONG

# Check Redis info
railway run --service redis redis-cli INFO server

# Test set/get
railway run --service redis redis-cli SET test-key "Hello Railway"
railway run --service redis redis-cli GET test-key
# Expected: "Hello Railway"
```

**Via Health Endpoint**:
```bash
# Test backend health endpoint
curl https://mash-backend-api-production.up.railway.app/health

# Expected response:
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }  # <-- Should be "up"
  }
}
```

---

### Phase 6: Update Local Development (PENDING) ⏳

**Option A: Use Local Redis** (Recommended for development)

```bash
# Download Redis for Windows
# URL: https://github.com/microsoftarchive/redis/releases

# Install Redis-x64-3.0.504.msi

# Update local .env file
# C:\Users\Kenneth\Desktop\PP Namias\MASH-Backend\.env

REDIS_URL=redis://localhost:6379
```

**Option B: Use Railway Public URL** (For testing)

```bash
# Get Railway Redis public URL
railway variables get REDIS_PUBLIC_URL --service redis

# Update local .env
REDIS_URL=redis://default:password@redis.railway.app:6379
```

---

### Phase 7: Test Local Development (PENDING) ⏳

```bash
cd "C:\Users\Kenneth\Desktop\PP Namias\MASH-Backend"

# Ensure local Redis is running (if using Option A)
# Check: redis-server should be running in background

# Build and start development server
npm run build
npm run start:dev

# Expected output:
# ✅ Redis connected successfully
# ✅ BullMQ queues initialized (5 queues)
# ✅ Nest application successfully started
# ✅ Application is running on: http://[::]:3000

# Test health endpoint locally
curl http://localhost:3000/health
```

---

## 🎯 Current Status Summary

### ✅ Completed
1. ✅ Railway CLI installed and configured
2. ✅ Authenticated as Jhon Keneth Namias
3. ✅ Project linked: mash-backend (production)
4. ✅ Service linked: mash-backend-api
5. ✅ Current Redis configuration identified (Upstash - quota exceeded)

### ⏳ Pending (Next Steps)
1. ⏳ **Add Redis database to Railway project** (Phase 2)
2. ⏳ Get Railway Redis connection URL (Phase 3)
3. ⏳ Update backend REDIS_URL environment variable (Phase 4)
4. ⏳ Verify Railway deployment with new Redis (Phase 5)
5. ⏳ Setup local development environment (Phase 6)
6. ⏳ Test local development server (Phase 7)

---

## 📋 Quick Commands Reference

### Railway CLI Essentials

```bash
# Check auth status
railway whoami

# Check project status
railway status

# View all variables
railway variables

# View backend variables
railway variables --service mash-backend-api

# View Redis variables (after Redis added)
railway variables --service redis

# Watch logs
railway logs --service mash-backend-api --tail

# Update variable
railway variables set REDIS_URL="new-url"

# Restart service
railway restart --service mash-backend-api

# Open project in browser
railway open
```

### Redis CLI Commands (After Redis Added)

```bash
# Test connection
railway run --service redis redis-cli PING

# Get server info
railway run --service redis redis-cli INFO

# Check memory usage
railway run --service redis redis-cli INFO memory

# List all keys
railway run --service redis redis-cli KEYS "*"

# Get specific key
railway run --service redis redis-cli GET key-name

# Clear all data (careful!)
railway run --service redis redis-cli FLUSHDB
```

---

## 🚨 Troubleshooting

### Issue: Railway CLI not recognized
```bash
# Reinstall Railway CLI
npm install -g @railway/cli

# Verify installation
railway --version
```

### Issue: Not authenticated
```bash
# Re-login
railway login

# Verify
railway whoami
```

### Issue: Wrong project/service linked
```bash
# Unlink current
railway unlink

# Re-link to correct project
railway link
# Select: mash-backend → production → mash-backend-api
```

### Issue: Redis not showing in project
```bash
# Option 1: Use Railway dashboard
# https://railway.app/project/4d3b5375-37f0-4b3f-b48a-b411e17ca06a
# Click "+ New" → "Database" → "Add Redis"

# Option 2: Check if already exists
railway status

# Option 3: Contact Railway support
# Discord: https://discord.gg/railway
```

### Issue: Backend not connecting to Railway Redis
```bash
# Check REDIS_URL format
railway variables get REDIS_URL --service mash-backend-api

# Should be internal URL:
# redis://default:password@redis.railway.internal:6379

# NOT external URL:
# redis://...@redis.railway.app:6379 (higher latency)

# Check deployment logs
railway logs --service mash-backend-api | findstr -i "redis"
```

---

## 📞 Support Resources

- **Railway Documentation**: https://docs.railway.app
- **Railway Redis Docs**: https://docs.railway.app/databases/redis
- **Railway Discord**: https://discord.gg/railway
- **Railway CLI Docs**: https://docs.railway.app/develop/cli

---

## 🎉 Success Criteria

### Railway Production
- [ ] Redis service visible in Railway dashboard
- [ ] REDIS_URL variable updated in backend service
- [ ] Deployment successful (green status)
- [ ] Health endpoint returns `redis: "up"`
- [ ] No quota errors in logs
- [ ] BullMQ queues processing jobs

### Local Development
- [ ] Local Redis installed OR Railway public URL configured
- [ ] `.env` updated with correct REDIS_URL
- [ ] `npm run start:dev` starts successfully
- [ ] No "ERR max requests limit exceeded" errors
- [ ] Health endpoint returns `redis: "up"`
- [ ] Can test Lalamove endpoints

---

## 📈 Next Steps After Migration

Once Redis migration is complete:

1. **Test Locally** (30 minutes)
   - Run `npm run start:dev`
   - Import Postman collection: `MASH-Lalamove-PH.postman_collection.json`
   - Test all 10 Lalamove endpoints
   - Verify webhook signature validation
   - Check notification delivery (email, SMS, push)

2. **Test Production** (30 minutes)
   - Verify Railway deployment healthy
   - Run Postman tests against production URL
   - Monitor BullMQ queue processing
   - Test end-to-end webhook flow

3. **Setup Production Webhook** (15 minutes)
   - Get admin JWT token
   - Call `/api/v1/lalamove/webhook/setup`
   - Update to production Lalamove credentials
   - Test production webhook events

4. **Monitor & Optimize** (Ongoing)
   - Watch Redis memory usage
   - Monitor queue processing times
   - Check for any errors
   - Optimize cache TTLs if needed

---

**Last Updated**: November 18, 2025  
**Author**: Kenneth (with AI assistance)  
**Railway Project**: mash-backend (4d3b5375-37f0-4b3f-b48a-b411e17ca06a)
