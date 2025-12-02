# Redis Migration: Upstash Free Tier → Railway

**Project**: MASH Backend - Redis Infrastructure Migration  
**Date**: November 18, 2025  
**Status**: Planning Phase  
**Reason**: Upstash free tier quota exceeded (500,000 requests limit)

---

## 📋 Migration Overview

**Current Setup**:
- ❌ Upstash Redis (Free Tier) - **QUOTA EXCEEDED**
- Connection: `rediss://...` (TLS encrypted)
- Usage: 500,000/500,000 requests
- Cost: Free (limited)

**Target Setup**:
- ✅ Railway Redis (Included in Pro Plan)
- Connection: Railway internal network
- Usage: Unlimited requests
- Cost: Included in Railway Pro subscription

---

## 🎯 Migration Benefits

1. **Unlimited Requests**: No more quota limits
2. **Lower Latency**: Same infrastructure as backend (Railway internal network)
3. **Better Performance**: Direct connection without TLS overhead for internal traffic
4. **Cost Effective**: Included in Railway Pro plan (~$5/month)
5. **Easier Management**: Single platform for all services
6. **Auto-scaling**: Railway handles scaling automatically

---

## 📝 Pre-Migration Checklist

### 1. Verify Railway Account Status
- [ ] Railway Pro plan active (required for Redis plugin)
- [ ] Backend already deployed to Railway
- [ ] Railway CLI installed (`npm install -g @railway/cli`)
- [ ] Logged in to Railway CLI (`railway login`)

### 2. Backup Current Configuration
- [ ] Document current `REDIS_URL` from `.env`
- [ ] Export current Redis data (if any important data exists)
- [ ] Document all services using Redis:
  - BullMQ queues (push-notifications, email-notifications, sms-notifications)
  - Import/export queues
  - Session storage
  - Cache layer

### 3. Review Current Redis Usage
```bash
# Current Redis connections in MASH Backend:
- BullMQ for job queues
- Cache for API responses
- Session management
- Rate limiting
```

---

## 🚀 Migration Steps

### Phase 1: Setup Railway Redis (15 minutes)

#### Step 1.1: Add Redis Plugin to Railway Project

**Option A: Via Railway Dashboard (Recommended)**

1. Open Railway Dashboard: https://railway.app/dashboard
2. Select your project: `MASH-Backend` or your project name
3. Click **"+ New"** button
4. Select **"Database"** → **"Add Redis"**
5. Wait for Redis to provision (1-2 minutes)

**Option B: Via Railway CLI**

```bash
# Navigate to project directory
cd "C:\Users\Kenneth\Desktop\PP Namias\MASH-Backend"

# Link to Railway project (if not already linked)
railway link

# Add Redis plugin
railway add redis

# Verify plugin added
railway status
```

#### Step 1.2: Get Redis Connection Details

**Via Railway Dashboard**:
1. Click on **Redis** service in your project
2. Go to **"Variables"** tab
3. Copy these variables:
   - `REDIS_URL` (internal connection string)
   - `REDIS_PUBLIC_URL` (external connection string - if needed)
   - `REDIS_PRIVATE_URL` (preferred for Railway internal services)

**Via Railway CLI**:
```bash
# Get Redis connection string
railway variables --service redis

# Expected output:
# REDIS_URL=redis://default:password@redis.railway.internal:6379
# REDIS_PRIVATE_URL=redis://default:password@redis.railway.internal:6379
# REDIS_PUBLIC_URL=redis://default:password@external-host:port
```

#### Step 1.3: Configure Railway Environment Variables

**Via Railway Dashboard**:
1. Click on your **Backend** service
2. Go to **"Variables"** tab
3. Find or add `REDIS_URL` variable
4. Update value to Railway Redis URL:
   ```
   redis://default:password@redis.railway.internal:6379
   ```
5. Click **"Save Changes"**
6. Railway will auto-redeploy your backend

**Via Railway CLI**:
```bash
# Set Redis URL for backend service
railway variables set REDIS_URL="redis://default:password@redis.railway.internal:6379" --service backend

# Verify variable set
railway variables --service backend | findstr REDIS_URL
```

---

### Phase 2: Update Local Development Configuration (10 minutes)

#### Step 2.1: Update Local `.env` File

Open `C:\Users\Kenneth\Desktop\PP Namias\MASH-Backend\.env` and update:

```bash
# OLD (Upstash - REMOVE)
# REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379

# NEW (Railway Redis for local testing via public URL)
REDIS_URL=redis://default:password@your-redis-public-url:port

# OR use local Redis for development (recommended)
REDIS_URL=redis://localhost:6379
```

**Recommendation for Local Development**:

**Option A: Use Railway Redis Public URL** (easier, but slower)
- Use `REDIS_PUBLIC_URL` from Railway
- Good for: Testing production-like setup locally
- Cons: Higher latency due to internet connection

**Option B: Install Local Redis** (recommended)
- Download Redis for Windows: https://github.com/microsoftarchive/redis/releases
- Install `Redis-x64-3.0.504.msi`
- Use `redis://localhost:6379`
- Good for: Fast local development
- Pros: Zero latency, offline development

#### Step 2.2: Update `.env.example`

```bash
# Update template
cd "C:\Users\Kenneth\Desktop\PP Namias\MASH-Backend"
```

Update the Redis section in `.env.example`:

```bash
# ----------------------------------------------------------------------------
# REDIS CONFIGURATION - Railway
# ----------------------------------------------------------------------------
# For Railway deployment: Use Railway internal Redis URL
# For local development: Use local Redis or Railway public URL
# 
# Railway (Production): redis://default:password@redis.railway.internal:6379
# Railway (Dev/Test): Use REDIS_PUBLIC_URL from Railway dashboard
# Local Development: redis://localhost:6379
REDIS_URL=redis://localhost:6379
```

---

### Phase 3: Test Migration (20 minutes)

#### Step 3.1: Verify Railway Deployment

**Check Deployment Logs**:
```bash
# View backend logs
railway logs --service backend

# Look for successful Redis connection:
# ✅ "Redis connected successfully"
# ✅ "BullMQ queues initialized"
```

**Via Railway Dashboard**:
1. Open **Backend** service
2. Click **"Deployments"** tab
3. Check latest deployment status
4. Click **"View Logs"**
5. Verify Redis connection messages

#### Step 3.2: Test Redis Connection

**Method 1: Check Health Endpoint**
```bash
# Test health endpoint
curl https://mash-backend-api-production.up.railway.app/health

# Expected response includes Redis status:
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

**Method 2: Check Metrics Endpoint**
```bash
# Check Prometheus metrics
curl https://mash-backend-api-production.up.railway.app/metrics | findstr redis

# Should show redis_* metrics
```

**Method 3: Railway CLI**
```bash
# Connect to Redis via Railway
railway run --service redis redis-cli

# Once connected, test:
redis> PING
# Should return: PONG

redis> SET test_migration "success"
# Should return: OK

redis> GET test_migration
# Should return: "success"

redis> DEL test_migration
# Should return: (integer) 1

redis> EXIT
```

#### Step 3.3: Test Local Development

```bash
# Make sure local Redis is running (if using local Redis)
# OR .env points to Railway public URL

# Install dependencies (if needed)
npm install --legacy-peer-deps

# Generate Prisma client
npx prisma generate

# Build
npm run build

# Start dev server
npm run start:dev
```

**Expected Output**:
```
[Nest] LOG [NestApplication] Nest application successfully started
[Nest] LOG [Bootstrap] 🚀 Server running on http://localhost:3000
[Nest] LOG [Bootstrap] 📚 Swagger docs available at http://localhost:3000/api
[Nest] LOG [RedisService] ✅ Redis connected successfully
[Nest] LOG [BullModule] ✅ All queues initialized
```

**Test Lalamove Endpoints**:
```bash
# 1. Health check
curl http://localhost:3000/health

# 2. Get city info (no auth)
curl http://localhost:3000/api/v1/lalamove/city-info

# 3. Check Swagger
# Open: http://localhost:3000/api
```

---

### Phase 4: Verify All Services (15 minutes)

#### Step 4.1: Check BullMQ Queues

**Via Code** (add temporary logging):
```typescript
// In src/main.ts or any bootstrap file
const queueHealth = await app.get(BullModule).checkQueues();
console.log('Queue Status:', queueHealth);
```

**Via Railway Logs**:
```bash
railway logs --service backend | findstr -i "queue\|bull\|redis"
```

#### Step 4.2: Test Notification System

**Create test notification**:
```bash
# Use Postman or curl
POST https://mash-backend-api-production.up.railway.app/api/v1/notifications/test
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "userId": "USER_ID",
  "type": "email",
  "subject": "Redis Migration Test",
  "message": "Testing Railway Redis connection"
}
```

**Check Queue Processing**:
```bash
# View logs for queue processing
railway logs --service backend --tail

# Should see:
# [EmailNotificationConsumer] Processing email job...
# [EmailNotificationConsumer] Email sent successfully
```

#### Step 4.3: Test Lalamove Integration

Follow `LALAMOVE_QUICK_START.md`:

1. **Import Postman Collection**:
   - `postman/MASH-Lalamove-PH.postman_collection.json`
   - `postman/PH.postman_environment.json`

2. **Update Postman Environment**:
   ```
   baseUrl: https://mash-backend-api-production.up.railway.app
   token: YOUR_JWT_TOKEN
   ```

3. **Run Test Sequence**:
   - ✅ GET /api/v1/lalamove/city-info
   - ✅ POST /api/v1/lalamove/quotations
   - ✅ GET /api/v1/lalamove/quotations/:id
   - ✅ POST /api/v1/lalamove/orders
   - ✅ GET /api/v1/lalamove/orders/:id

---

### Phase 5: Cleanup & Documentation (10 minutes)

#### Step 5.1: Remove Upstash Configuration

**From Railway Dashboard**:
1. Go to Backend service → Variables
2. Remove or archive old `REDIS_URL` pointing to Upstash
3. Verify only Railway Redis URL remains

**From Local `.env`**:
```bash
# Remove or comment out Upstash URL
# REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379  # OLD - REMOVED
```

#### Step 5.2: Update Documentation

**Files to Update**:
1. ✅ `README.md` - Update Redis section
2. ✅ `.env.example` - Update Redis configuration
3. ✅ `LALAMOVE_QUICK_START.md` - Update Step 2 (Redis setup)
4. ✅ `DEPLOYMENT_STATUS.md` - Update infrastructure section

**Update README.md Redis Section**:
```markdown
## Redis Configuration

**Production (Railway)**:
```bash
REDIS_URL=redis://default:password@redis.railway.internal:6379
```

**Local Development** (Choose one):
```bash
# Option 1: Local Redis (Recommended)
REDIS_URL=redis://localhost:6379

# Option 2: Railway Public URL (for testing)
REDIS_URL=redis://default:password@external-host:port
```
```

#### Step 5.3: Optional - Cancel Upstash Subscription

**If Upstash is no longer needed**:
1. Go to https://console.upstash.com
2. Select your Redis database
3. Click **"Delete Database"**
4. Confirm deletion
5. Save ~$0/month (free tier) or your paid plan cost

---

## ⚠️ Troubleshooting

### Issue 1: Railway Redis Not Connecting

**Error**: `Error: connect ECONNREFUSED`

**Solution**:
```bash
# Check Redis service is running
railway status --service redis

# Check Redis URL is correct
railway variables --service backend | findstr REDIS_URL

# Verify Redis is healthy
railway logs --service redis

# Restart Redis if needed
railway restart --service redis
```

### Issue 2: Local Development Can't Connect

**Error**: `Redis connection to localhost:6379 failed`

**Solution**:
```bash
# Option A: Install local Redis
# Download: https://github.com/microsoftarchive/redis/releases
# Install Redis-x64-3.0.504.msi

# Start Redis
redis-server

# Option B: Use Railway public URL in .env
REDIS_URL=redis://default:password@your-public-redis-url:port
```

### Issue 3: BullMQ Queues Not Processing

**Error**: Jobs stuck in queue

**Solution**:
```bash
# Check Redis connection
railway logs --service backend | findstr "redis\|Redis"

# Verify queue consumers are running
railway logs --service backend | findstr "consumer\|Consumer"

# Restart backend
railway restart --service backend

# Check for memory issues
railway metrics --service redis
```

### Issue 4: High Latency from Local Development

**Error**: Slow API responses when using Railway public Redis URL

**Solution**:
```bash
# Switch to local Redis for development
REDIS_URL=redis://localhost:6379

# Test latency
redis-cli -h your-redis-host -p port --latency

# For Railway deployment, latency should be <5ms (internal network)
```

---

## 📊 Migration Verification Checklist

### Pre-Migration
- [ ] Railway Pro plan active
- [ ] Backend deployed to Railway
- [ ] Current Redis configuration documented
- [ ] Upstash credentials backed up

### Migration
- [ ] Railway Redis plugin added
- [ ] Redis connection string obtained
- [ ] Backend environment variables updated
- [ ] Local `.env` updated
- [ ] `.env.example` updated

### Testing
- [ ] Railway deployment successful
- [ ] Redis health check passes
- [ ] BullMQ queues initialized
- [ ] Local development server starts
- [ ] All 10 Lalamove endpoints working
- [ ] Notification system functional
- [ ] Webhook processing works
- [ ] Queue jobs processing correctly

### Cleanup
- [ ] Old Upstash configuration removed
- [ ] Documentation updated
- [ ] Upstash database deleted (optional)
- [ ] Team notified of migration

---

## 🎯 Success Criteria

### Railway Production
```bash
✅ Backend deploys without Redis quota errors
✅ Redis connection latency < 5ms
✅ All BullMQ queues processing jobs
✅ Health endpoint returns Redis: "up"
✅ Lalamove webhooks process successfully
✅ Notifications sent via email/SMS/push
```

### Local Development
```bash
✅ Server starts without Redis errors
✅ All endpoints respond correctly
✅ Swagger documentation accessible
✅ Postman tests pass
✅ No quota limit warnings
```

---

## 📈 Post-Migration Monitoring

### Week 1: Monitor Closely

**Daily Checks**:
```bash
# Check error rates
railway logs --service backend | findstr -i "error\|failed"

# Check Redis memory usage
railway metrics --service redis

# Check queue health
railway logs --service backend | findstr -i "queue"
```

### Week 2-4: Periodic Checks

**Weekly Checks**:
- Railway Redis memory usage
- Queue processing times
- API response times
- Error rates

**Metrics to Track**:
- Redis memory: Should stay under 256MB for typical usage
- Queue latency: Should be <100ms
- API response time: Should improve by 10-20%
- Error rate: Should be 0% for Redis connections

---

## 💰 Cost Comparison

### Before (Upstash Free Tier)
- Cost: $0/month
- Limit: 500,000 requests/month
- **Problem**: Quota exceeded ❌
- Latency: ~50-100ms (external)

### After (Railway Redis)
- Cost: Included in Railway Pro ($5-20/month total)
- Limit: Unlimited requests ✅
- Latency: ~2-5ms (internal network)
- Auto-scaling: Yes
- Backups: Yes (Railway handles)

**Net Benefit**: Unlimited requests, better performance, no extra cost

---

## 🔄 Rollback Plan (If Needed)

If migration fails, rollback to Upstash:

```bash
# Step 1: Revert Railway environment variable
railway variables set REDIS_URL="rediss://default:xxx@xxx.upstash.io:6379" --service backend

# Step 2: Restart backend
railway restart --service backend

# Step 3: Update local .env
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379

# Step 4: Test
npm run start:dev
```

**Note**: Rollback to Upstash will still face quota limits. Consider upgrading Upstash plan or using local Redis for development.

---

## 📞 Support Resources

**Railway Documentation**:
- Redis Plugin: https://docs.railway.app/databases/redis
- Environment Variables: https://docs.railway.app/develop/variables
- Private Networking: https://docs.railway.app/deploy/private-networking

**Railway Support**:
- Discord: https://discord.gg/railway
- Email: team@railway.app
- Docs: https://docs.railway.app

**MASH Backend**:
- GitHub Issues: https://github.com/MASH-Mushroom-Automation/MASH-Backend/issues
- Developer: Kenneth
- Sprint: Issue #131

---

## ✅ Next Steps After Migration

1. **Complete Lalamove Testing**:
   - Run full Postman collection
   - Test all 10 endpoints
   - Verify webhook delivery
   - Check notification multi-channel delivery

2. **Setup Production Webhook**:
   - Use Railway deployment URL
   - POST /api/v1/lalamove/webhook/setup
   - Update Lalamove dashboard with webhook URL

3. **Monitor Performance**:
   - Set up Railway metrics alerts
   - Monitor Redis memory usage
   - Track API response times

4. **Update Team**:
   - Document migration completion
   - Update runbooks
   - Train team on Railway Redis management

---

**Migration Estimated Time**: 1-2 hours  
**Complexity**: Low-Medium  
**Risk Level**: Low (easy rollback available)  
**Downtime**: 0 minutes (Railway handles deployment gracefully)

---

**Ready to migrate? Start with Phase 1: Setup Railway Redis** 🚀
