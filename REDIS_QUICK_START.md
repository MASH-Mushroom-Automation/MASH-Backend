# Redis Migration Quick Start - Railway Setup

**⏱️ Time Required**: 15 minutes  
**📋 Prerequisites**: Railway Pro plan, Backend already deployed

---

## 🚀 Quick Migration Steps

### ✅ STEP 1: Railway CLI Setup (COMPLETED)

**Status**: ✅ **COMPLETED**
- ✅ Railway CLI installed globally
- ✅ Logged in as: Jhon Keneth Namias (jkrbn99@gmail.com)
- ✅ Project linked: `mash-backend` (production environment)
- ✅ Service linked: `mash-backend-api`

---

### 1️⃣ Add Redis to Railway (5 minutes) - IN PROGRESS

**Option A: Via Railway Dashboard** (Recommended):

1. Open: https://railway.app/dashboard
2. Select project: **mash-backend**
3. Click **"+ New"** → **"Database"** → **"Add Redis"**
4. Wait 1-2 minutes for provisioning ✅

**Option B: Via Railway Dashboard (Direct)**:
- Direct link: https://railway.app/project/4d3b5375-37f0-4b3f-b48a-b411e17ca06a
- Click "+ New" button in top-right
- Select "Database" → "Redis"

**Note**: Railway CLI `railway add` command may require interactive selection. Dashboard method is more straightforward.

---

### 2️⃣ Get Redis Connection URL (2 minutes) - WAITING FOR STEP 1

**After Redis is provisioned** (from Step 1):

**Via Railway Dashboard**:

1. Click **Redis** service in your project
2. Go to **"Variables"** tab
3. Look for these variables:
   - **`REDIS_URL`** or **`REDIS_PRIVATE_URL`** (internal network)
   - **`REDIS_PUBLIC_URL`** (external access)
4. Copy the **internal URL**: `redis://default:password@redis.railway.internal:6379`

**Via CLI**:
```bash
# After Redis is added, link to Redis service
railway link

# Then get Redis variables
railway variables --service redis
```

**Expected Output**:
```
REDIS_URL=redis://default:password@redis.railway.internal:6379
REDIS_PUBLIC_URL=redis://default:password@redis-production.railway.app:6379
```

---

### 3️⃣ Update Backend Environment Variable (3 minutes) - WAITING FOR STEP 2

**Via Railway Dashboard** (Easiest):

1. Go to: https://railway.app/project/4d3b5375-37f0-4b3f-b48a-b411e17ca06a
2. Click your **mash-backend-api** service
3. Go to **"Variables"** tab
4. Find `REDIS_URL` variable (currently points to Upstash)
4. Update value to Railway Redis URL:
   ```
   redis://default:password@redis.railway.internal:6379
   ```
5. Click **"Save"** → Railway auto-deploys ✅

**Via CLI**:
```bash
railway variables set REDIS_URL="redis://default:password@redis.railway.internal:6379" --service backend
```

---

### 4️⃣ Verify Deployment (3 minutes)

**Check Deployment Status**:

```bash
# View logs
railway logs --service backend

# Look for:
✅ "Redis connected successfully"
✅ "BullMQ queues initialized"
✅ "Nest application successfully started"
```

**Test Health Endpoint**:
```bash
curl https://mash-backend-api-production.up.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

---

### 5️⃣ Update Local Development (2 minutes)

**Option A: Use Local Redis** (Recommended for development)

1. Download Redis: https://github.com/microsoftarchive/redis/releases
2. Install `Redis-x64-3.0.504.msi`
3. Update `.env`:
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

**Option B: Use Railway Public URL** (Easier, but slower)

1. Get `REDIS_PUBLIC_URL` from Railway dashboard
2. Update `.env`:
   ```bash
   REDIS_URL=redis://default:password@external-host:port
   ```

---

## ✅ Success Verification

### Railway Production:
```bash
✅ Deployment successful (green status)
✅ Health endpoint returns redis: "up"
✅ No quota errors in logs
```

### Local Development:
```bash
# Start server
npm run start:dev

# Should see:
✅ "Redis connected successfully"
✅ "Nest application successfully started"
✅ No "ERR max requests limit exceeded"
```

---

## 🎯 What's Next?

1. **Test Lalamove Integration**:
   - Follow `LALAMOVE_QUICK_START.md` Step 6
   - Import Postman collection
   - Test all 10 endpoints

2. **Verify Notifications**:
   - Test webhook events
   - Check email/SMS/push delivery
   - Verify BullMQ queue processing

3. **Setup Production Webhook**:
   - Use Railway URL for webhook
   - Update Lalamove credentials to production
   - Test end-to-end flow

---

## ⚠️ Quick Troubleshooting

**Issue**: Deployment failed  
**Fix**: Check logs → `railway logs --service backend`

**Issue**: Can't connect locally  
**Fix**: Install local Redis OR use Railway public URL

**Issue**: Queues not processing  
**Fix**: Restart backend → `railway restart --service backend`

---

## 📚 Full Documentation

For detailed migration steps, troubleshooting, and rollback plan:
→ See `REDIS_RAILWAY_MIGRATION.md`

---

**Questions?** Check Railway docs: https://docs.railway.app/databases/redis

**Ready?** Start with Step 1 above! 🚀
