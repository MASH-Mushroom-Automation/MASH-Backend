# Railway Backend Migration Guide

**Date**: November 23, 2025  
**Objective**: Migrate MASH Backend from old Railway deployment to new environment with Redis  
**Status**: Ready to Execute

---

## 📋 Current vs New Environment

### Old Environment
- **Backend URL**: `https://mash-backend-api-production.up.railway.app`
- **Redis**: External (Railway Redis - `caboose.proxy.rlwy.net:6379`)
- **Database**: Neon PostgreSQL (already configured)
- **Status**: Currently running

### New Environment (Target)
- **Backend URL**: `https://mash-space.up.railway.app` / `https://web-production-3946c.up.railway.app`
- **Service Name**: `web` (mash-space)
- **Redis**: ✅ Already deployed in Railway
  - **Internal**: `redis.railway.internal:6379`
  - **Public TCP Proxy**: `interchange.proxy.rlwy.net:34127`
  - **Password**: `lNicVMNJFUNLjGotxGqSkDPjsMAcpKYc`
  - **User**: `default`
- **Database**: Same Neon PostgreSQL (no migration needed)
- **Region**: US West (California, USA)
- **Project**: `mash-space` (ID: `b0b00316-c2d2-4b25-8d2d-8d18ca761e6a`)

---

## 🎯 Migration Strategy

### Zero-Downtime Approach
1. ✅ Configure new environment (parallel to old)
2. ✅ Test new environment thoroughly
3. ✅ Switch DNS/traffic to new environment
4. ✅ Monitor for 24-48 hours
5. ✅ Decommission old environment

**Estimated Time**: 2-3 hours  
**Downtime**: 0 minutes (blue-green deployment)

---

## 📦 Pre-Migration Checklist

### 1. Verify New Railway Services

Current services in new environment:
- [x] **web** service (NestJS backend)
  - Branch: `main`
  - Domain: `mash-space.up.railway.app`
  - Status: ✅ Deployed successfully
- [x] **Redis** service
  - Version: `redis:8.2.1`
  - Internal: `redis.railway.internal:6379`
  - Status: ✅ Deployed successfully

### 2. Backup Current Environment Variables

```bash
# Export current Railway variables (from old deployment)
railway variables --service mash-backend-api > backup-env-vars.txt
```

### 3. Document Current Configuration

**Current `.env` values to migrate**:
```env
# Database (no change needed)
DATABASE_URL=postgresql://neondb_owner:npg_B4tIx6OCXiDN@ep-wispy-dream-aduaegct-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&connection_limit=3&pool_timeout=20
DIRECT_URL=postgresql://neondb_owner:npg_B4tIx6OCXiDN@ep-wispy-dream-aduaegct.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require

# Redis (CHANGE REQUIRED - use new Redis service)
REDIS_URL=redis://default:NEW_REDIS_PASSWORD@redis.railway.internal:6379

# Application URLs (CHANGE REQUIRED)
BACKEND_URL=https://mash-space.up.railway.app
APP_URL=https://mash-space.up.railway.app
BASE_URL=https://mash-space.up.railway.app
FRONTEND_URL=https://mash-space.up.railway.app

# Email (if using SMTP relay)
SMTP_RELAY_URL=YOUR_NGROK_URL  # Update with current ngrok URL
```

---

## 🔧 Step-by-Step Migration

### Step 1: Verify Redis Connection Details ✅

**Redis is already deployed and configured!**

```env
# Redis Variables (from Railway Redis service)
REDIS_PASSWORD=lNicVMNJFUNLjGotxGqSkDPjsMAcpKYc
REDIS_URL=redis://default:lNicVMNJFUNLjGotxGqSkDPjsMAcpKYc@redis.railway.internal:6379
REDISHOST=redis.railway.internal
REDISPORT=6379
REDISUSER=default

# TCP Proxy (for external connections)
RAILWAY_TCP_PROXY_DOMAIN=interchange.proxy.rlwy.net
RAILWAY_TCP_PROXY_PORT=34127
```

**Volume**: `redis-volume` mounted at `/data`  
**Service ID**: `2f7f349a-ec58-4654-aebc-d54842c4d242`

### Step 2: Configure Environment Variables in New `web` Service

Go to Railway Dashboard → **web** service → **Variables** tab:

#### Core Application Variables
```env
# Node Environment
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Application URLs (updated)
BACKEND_URL=https://mash-space.up.railway.app
APP_URL=https://mash-space.up.railway.app
BASE_URL=https://mash-space.up.railway.app
FRONTEND_URL=https://mash-space.up.railway.app
```

#### Database Variables (no change)
```env
DATABASE_URL=postgresql://neondb_owner:npg_B4tIx6OCXiDN@ep-wispy-dream-aduaegct-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&connection_limit=3&pool_timeout=20
DIRECT_URL=postgresql://neondb_owner:npg_B4tIx6OCXiDN@ep-wispy-dream-aduaegct.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```

#### Redis Variables (CRITICAL - Use Railway Service Reference)
```env
# Option 1: Use Railway service reference (RECOMMENDED)
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_HOST=${{Redis.REDISHOST}}
REDIS_PORT=${{Redis.REDISPORT}}
REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
REDISUSER=${{Redis.REDISUSER}}

# Option 2: Use actual values (if service reference doesn't work)
REDIS_URL=redis://default:lNicVMNJFUNLjGotxGqSkDPjsMAcpKYc@redis.railway.internal:6379
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=lNicVMNJFUNLjGotxGqSkDPjsMAcpKYc
REDISUSER=default
```

#### Firebase Variables (copy from .env)
```env
FIREBASE_PROJECT_ID=mash-5b627
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@mash-5b627.iam.gserviceaccount.com
FIREBASE_DATABASE_URL=https://mash-5b627-default-rtdb.firebaseio.com
FIREBASE_PRIVATE_KEY=<copy-from-current-env>
FCM_SENDER_ID=1001664140460
FCM_SERVICE_ACCOUNT_EMAIL=firebase-adminsdk-fbsvc@mash-5b627.iam.gserviceaccount.com
FCM_PRIVATE_KEY_ID=<copy-from-current-env>
FCM_PRIVATE_KEY=<copy-from-current-env>
```

#### Email Variables (SMTP Relay)
```env
# SMTP Relay (if using ngrok)
SMTP_RELAY_ENABLED=true
SMTP_RELAY_URL=<your-current-ngrok-url>
SMTP_RELAY_ENDPOINT=/send-email

# Gmail SMTP (fallback)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=MASH.Mushroom.Automation@gmail.com
EMAIL_PASSWORD=rtaeavlpvqaovgix
EMAIL_FROM=MASH Mushroom Automation <MASH.Mushroom.Automation@gmail.com>
```

#### Security Variables
```env
JWT_SECRET=<generate-new-secret-use-openssl-rand-hex-32>
CLERK_SECRET_KEY=sk_test_RygR2hOh8zf6ZD17eiFQ1gFJdQxVmYtfSAGfv05VcO
CLERK_WEBHOOK_SECRET=whsec_JtOiAs0zFyPNFKPKL9QCyJJjK1H/timm
```

#### Cache & Performance
```env
CACHE_ENABLED=true
CACHE_TTL_DEFAULT=300
CACHE_TTL_PRODUCTS=600
CACHE_TTL_CATEGORIES=1800
CACHE_TTL_USERS=600
CACHE_TTL_ANALYTICS=1800
```

#### Rate Limiting
```env
THROTTLE_TTL=60
THROTTLE_LIMIT=100
THROTTLE_LIMIT_SUPER_ADMIN=10000
THROTTLE_LIMIT_ADMIN=1000
THROTTLE_LIMIT_GROWER=200
THROTTLE_LIMIT_BUYER=150
THROTTLE_LIMIT_USER=100
THROTTLE_LIMIT_GUEST=20
```

#### Monitoring
```env
METRICS_ENABLED=true
METRICS_PATH=/metrics
OTEL_ENABLED=false
```

#### CORS Configuration
```env
CORS_ORIGINS=https://mash-space.up.railway.app,http://localhost:4200,http://localhost:5173,http://localhost:3000
CORS_CREDENTIALS=true
```

### Step 3: Update railway.toml (if exists)

Check if `railway.toml` exists in project root. If yes, verify configuration:

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm run start:prod:migrate"
healthcheckPath = "/api/v1/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### Step 4: Update Code for New URLs

Update `.env` file locally (for testing):

```bash
# Update BACKEND_URL references
BACKEND_URL=https://mash-space.up.railway.app
APP_URL=https://mash-space.up.railway.app
BASE_URL=https://mash-space.up.railway.app
```

### Step 5: Deploy to New Environment

```bash
# Ensure you're on the main branch
git checkout main
git pull origin main

# Link to new Railway project (if needed)
railway link

# Deploy to production environment
railway up --service web

# Or push to GitHub (auto-deploys via Railway)
git push origin main
```

### Step 6: Verify Deployment

#### Check Deployment Status
```bash
# In Railway dashboard, verify:
# 1. web service shows "Deployment successful"
# 2. Redis service shows "Deployment successful"
# 3. No error logs in Observability tab
```

#### Test Health Endpoint
```bash
# Test new backend
curl https://mash-space.up.railway.app/api/v1/health

# Expected response:
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

#### Test Redis Connection
```bash
# Check Railway logs for Redis connection
railway logs --service web

# Look for:
# "✅ Redis connected successfully"
# "✅ Cache service initialized"
```

#### Test API Endpoints
```bash
# Test Swagger docs
https://mash-space.up.railway.app/api/docs

# Test metrics
https://mash-space.up.railway.app/metrics
```

### Step 7: Smoke Test Critical Features

```bash
# 1. Authentication
curl -X POST https://mash-space.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# 2. Products endpoint (with caching)
curl https://mash-space.up.railway.app/api/v1/products

# 3. WebSocket connection
# Open browser console on your frontend
# const socket = io('https://mash-space.up.railway.app')
# Check if connection succeeds
```

### Step 8: Monitor for 1 Hour

Watch Railway logs in real-time:
```bash
railway logs --service web --follow
```

**What to watch for**:
- ✅ No Redis connection errors
- ✅ No database timeouts
- ✅ Successful API requests
- ✅ Cache hit rate > 80%
- ✅ Response times < 200ms

### Step 9: Update DNS/Frontend (If Applicable)

If you have a custom domain or frontend:

```javascript
// Frontend: Update API base URL
const API_BASE_URL = 'https://mash-space.up.railway.app/api/v1'

// Or use environment variables
VITE_API_URL=https://mash-space.up.railway.app
REACT_APP_API_URL=https://mash-space.up.railway.app
NEXT_PUBLIC_API_URL=https://mash-space.up.railway.app
```

### Step 10: Update ngrok SMTP Relay (If Using)

If using SMTP relay for emails:

```bash
# 1. Update Railway variables with current ngrok URL
SMTP_RELAY_URL=<your-current-ngrok-url>

# 2. Or start fresh ngrok tunnel pointing to new backend
ngrok http 2525 --region ap

# 3. Update Railway env var with new URL
```

---

## 🧪 Post-Migration Testing

### Automated Tests

```bash
# Run Postman collection against new URL
newman run postman/00-Master-Complete-API-Collection.postman_collection.json \
  --env-var "BASE_URL=https://mash-space.up.railway.app"

# Or update Postman environment
# Edit: postman/MASH-backend.postman_environment.json
# Change: "value": "https://mash-space.up.railway.app"
```

### Manual Test Checklist

- [ ] Health check returns 200 OK
- [ ] Swagger docs load correctly
- [ ] Login/authentication works
- [ ] Products API returns data
- [ ] Redis caching is working (check logs)
- [ ] WebSocket connections succeed
- [ ] Email sending works (test password reset)
- [ ] Metrics endpoint accessible
- [ ] Database queries succeed
- [ ] File uploads work (if applicable)

---

## 📊 Monitoring Post-Migration

### Key Metrics to Watch (First 24 Hours)

| Metric | Target | Check Interval |
|--------|--------|----------------|
| Error Rate | < 1% | Every 15 min |
| Response Time (P95) | < 200ms | Hourly |
| Cache Hit Rate | > 80% | Hourly |
| Redis Connection | 100% uptime | Continuous |
| Database Connection | 100% uptime | Continuous |
| Memory Usage | < 500MB | Hourly |
| CPU Usage | < 50% | Hourly |

### Railway Dashboard Monitoring

```
1. Go to Railway Dashboard → web service
2. Click "Metrics" tab
3. Monitor:
   - CPU usage (should be < 50%)
   - Memory usage (should be < 500MB)
   - Network I/O
4. Click "Observability" → "Logs"
   - Filter by error level
   - Look for Redis/DB connection issues
```

### Grafana Dashboard (If Using)

```bash
# Update Grafana datasource to point to new backend
PROMETHEUS_URL=https://mash-space.up.railway.app/metrics
```

---

## 🔄 Rollback Plan (If Issues Occur)

### Quick Rollback to Old Environment

If critical issues arise within first 48 hours:

```bash
# 1. Re-enable old backend URL in frontend/DNS
BACKEND_URL=https://mash-backend-api-production.up.railway.app

# 2. Keep old Railway service running (don't delete yet)

# 3. Investigate issues in new environment
railway logs --service web --lines 500

# 4. Fix issues, then retry migration
```

### Rollback Checklist
- [ ] Old environment still deployed (DO NOT DELETE for 7 days)
- [ ] Database unchanged (same Neon DB for both)
- [ ] Frontend can switch back instantly
- [ ] DNS TTL set low (60 seconds) for quick switching

---

## 🧹 Post-Migration Cleanup (After 7 Days)

Once new environment is stable for 7 days:

### 1. Decommission Old Railway Service

```bash
# In Railway dashboard:
# 1. Go to old "mash-backend-api-production" service
# 2. Settings → Danger → Delete Service
# 3. Confirm deletion
```

### 2. Update All Documentation

Update URLs in these files:
- [ ] `README.md`
- [ ] `.env.example`
- [ ] `docs/RAILWAY_DEPLOY_NOW.md`
- [ ] `postman/*.json` (environment files)
- [ ] `.github/copilot-instructions.md`

```bash
# Find and replace old URL
# Old: https://mash-backend-api-production.up.railway.app
# New: https://mash-space.up.railway.app
```

### 3. Update Git Repository Settings

If using Railway GitHub integration:
- [ ] Verify webhook points to new service
- [ ] Test auto-deployment on push to `main`

---

## 📝 Environment Variables Comparison

### Critical Changes Required

| Variable | Old Value | New Value | Priority |
|----------|-----------|-----------|----------|
| `REDIS_URL` | `redis://...@caboose.proxy.rlwy.net:6379` | `${{Redis.REDIS_URL}}` or `redis://...@redis.railway.internal:6379` | 🔴 Critical |
| `REDIS_HOST` | `caboose.proxy.rlwy.net` | `redis.railway.internal` | 🔴 Critical |
| `BACKEND_URL` | `https://mash-backend-api-production.up.railway.app` | `https://mash-space.up.railway.app` | 🔴 Critical |
| `APP_URL` | `https://mash-backend-api-production.up.railway.app` | `https://mash-space.up.railway.app` | 🔴 Critical |
| `CORS_ORIGINS` | Old URL | New URL | 🟡 Important |
| `SMTP_RELAY_URL` | Old ngrok | Current ngrok | 🟡 Important |

### Variables That Stay The Same

- ✅ All Firebase credentials
- ✅ Database URLs (Neon PostgreSQL)
- ✅ Gmail/Email credentials
- ✅ JWT secrets (rotate after migration if desired)
- ✅ Twilio credentials
- ✅ All cache/rate limit settings

---

## 🚨 Common Issues & Solutions

### Issue 1: Redis Connection Failed

**Symptom**: Logs show `ECONNREFUSED` for Redis

**Solution**:
```bash
# 1. Verify Redis service is running in Railway
# 2. Check REDIS_URL uses internal URL
REDIS_URL=redis://default:${REDIS_PASSWORD}@redis.railway.internal:6379

# 3. Restart web service
railway up --service web
```

### Issue 2: Database Migration Errors

**Symptom**: `prisma migrate deploy` fails

**Solution**:
```bash
# Run migration manually
railway run --service web npx prisma migrate deploy

# Or update start command to include migration
# In railway.toml or Railway settings:
startCommand = "npm run start:prod:migrate"
```

### Issue 3: CORS Errors from Frontend

**Symptom**: Browser shows "CORS policy blocked"

**Solution**:
```env
# Update CORS_ORIGINS to include new URL
CORS_ORIGINS=https://mash-space.up.railway.app,http://localhost:3000
```

### Issue 4: Email Not Sending

**Symptom**: Password reset emails fail

**Solution**:
```bash
# 1. Verify SMTP relay is running locally
curl http://localhost:2525/health

# 2. Verify ngrok tunnel is active
ngrok http 2525 --region ap

# 3. Update Railway with current ngrok URL
SMTP_RELAY_URL=<new-ngrok-url>
```

---

## ✅ Migration Completion Checklist

### Pre-Migration
- [ ] Backup all environment variables
- [ ] Document current Redis URL
- [ ] Test local build succeeds
- [ ] Commit all code changes

### During Migration
- [ ] Configure all environment variables in new Railway service
- [ ] Update Redis URL to use `redis.railway.internal`
- [ ] Update BACKEND_URL to `mash-space.up.railway.app`
- [ ] Deploy to new service
- [ ] Verify health check passes
- [ ] Test Redis connection in logs
- [ ] Run Postman tests

### Post-Migration (First Hour)
- [ ] Monitor error rates (< 1%)
- [ ] Check response times (< 200ms)
- [ ] Verify cache hit rate (> 80%)
- [ ] Test all critical endpoints
- [ ] Monitor Railway logs for errors

### Post-Migration (First Day)
- [ ] No critical errors in logs
- [ ] Performance metrics stable
- [ ] User-reported issues: 0
- [ ] Email sending works
- [ ] WebSocket connections stable

### Post-Migration (After 7 Days)
- [ ] Delete old Railway service
- [ ] Update all documentation
- [ ] Archive old environment variables
- [ ] Rotate secrets (JWT, API keys)

---

## 📞 Support & Resources

### Railway Documentation
- **Service References**: https://docs.railway.app/reference/variables#service-variables
- **Private Networking**: https://docs.railway.app/reference/private-networking
- **Deployment**: https://docs.railway.app/deploy/deployments

### Project Documentation
- **Full Setup**: `docs/NGROK_SMTP_SETUP_GUIDE.md`
- **Redis Guide**: `REDIS_MIGRATION_CLI_GUIDE.md`
- **Quick Start**: `QUICK_START_SMTP_RELAY.md`

### Railway Dashboard URLs
- **New web service**: https://railway.app/project/<project-id>/service/web
- **Redis service**: https://railway.app/project/<project-id>/service/Redis

---

## 📊 Success Criteria

Migration is successful when:

✅ **Deployment**
- New service deploys without errors
- Health check returns 200 OK
- All environment variables configured

✅ **Functionality**
- API endpoints respond correctly
- Redis caching works (hit rate > 80%)
- Database queries succeed
- Authentication works
- Email sending works

✅ **Performance**
- Response time P95 < 200ms
- Error rate < 1%
- No Redis connection drops
- No database timeouts

✅ **Stability**
- Zero errors for 24 hours
- No crashes or restarts
- Memory usage stable < 500MB
- CPU usage < 50%

---

**Migration Status**: Ready to Execute  
**Estimated Duration**: 2-3 hours  
**Risk Level**: Low (same database, parallel deployment)  
**Rollback Time**: < 5 minutes

**Next Step**: Begin with Step 1 (Get Redis Connection Details)

---

**Last Updated**: November 23, 2025  
**Created by**: GitHub Copilot  
**Project**: MASH-Backend Migration to mash-space.up.railway.app
