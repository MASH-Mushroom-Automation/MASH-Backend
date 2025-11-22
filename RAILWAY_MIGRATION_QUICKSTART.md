# 🚀 Quick Railway Migration Checklist

**From**: `mash-backend-api-production` → **To**: `mash-space` (web service)  
**Time**: 2-3 hours | **Downtime**: 0 minutes

---

## ⚡ Super Quick Steps

### 1. Redis Already Configured ✅
```env
# Redis is deployed! Credentials:
REDIS_PASSWORD=lNicVMNJFUNLjGotxGqSkDPjsMAcpKYc
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDISUSER=default
```

### 2. Set Environment Variables in `web` Service

**Critical Variables (Railway Dashboard → web → Variables):**

```env
# Redis (NEW - use Railway service reference)
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_HOST=${{Redis.REDISHOST}}
REDIS_PORT=${{Redis.REDISPORT}}
REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
REDISUSER=${{Redis.REDISUSER}}

# Application URLs (NEW)
BACKEND_URL=https://mash-space.up.railway.app
APP_URL=https://mash-space.up.railway.app
BASE_URL=https://mash-space.up.railway.app
FRONTEND_URL=https://mash-space.up.railway.app

# CORS (UPDATE)
CORS_ORIGINS=https://mash-space.up.railway.app,http://localhost:3000

# Database (NO CHANGE)
DATABASE_URL=postgresql://neondb_owner:npg_B4tIx6OCXiDN@ep-wispy-dream-aduaegct-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&connection_limit=3&pool_timeout=20
DIRECT_URL=<same-as-current>

# All other variables: Copy from current .env file
```

**Paste ALL 100+ variables** from `.env` file (see `RAILWAY_MIGRATION_GUIDE.md` Section "Step 2")

### 3. Deploy
```bash
git checkout main
git pull origin main
railway up --service web

# Or push to GitHub (auto-deploys)
git push origin main
```

### 4. Test
```bash
# Health check
curl https://mash-space.up.railway.app/api/v1/health

# Expected: {"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}}}
```

### 5. Monitor (15 minutes)
```bash
railway logs --service web --follow

# Look for:
# ✅ "Redis connected successfully"
# ✅ "Database connected"
# ❌ No errors
```

### 6. Update Frontend (if applicable)
```javascript
// Change API base URL
const API_URL = 'https://mash-space.up.railway.app'
```

---

## 🎯 Key Changes Summary

| What | Old | New |
|------|-----|-----|
| **Backend URL** | mash-backend-api-production.up.railway.app | mash-space.up.railway.app |
| **Redis Host** | caboose.proxy.rlwy.net | redis.railway.internal |
| **Redis URL** | Manual connection string | `${{Redis.REDIS_URL}}` |
| **Database** | ✅ No change | ✅ Same Neon DB |

---

## ✅ Success Checklist

- [ ] Health check returns 200
- [ ] Redis connection in logs shows ✅
- [ ] Database queries work
- [ ] API endpoints respond
- [ ] No errors in Railway logs (15 min monitoring)
- [ ] Postman tests pass

---

## 🔧 Troubleshooting

### Redis Connection Failed
```env
# Fix: Use internal URL
REDIS_URL=redis://default:${REDIS_PASSWORD}@redis.railway.internal:6379
REDIS_HOST=redis.railway.internal
```

### CORS Errors
```env
# Fix: Add new URL to CORS_ORIGINS
CORS_ORIGINS=https://mash-space.up.railway.app,http://localhost:3000
```

### Deployment Failed
```bash
# Check logs
railway logs --service web --lines 100

# Redeploy
railway up --service web
```

---

## 📚 Full Documentation

Complete guide with 100+ environment variables:
- **File**: `RAILWAY_MIGRATION_GUIDE.md`
- **Sections**: Pre-migration, Step-by-step, Testing, Rollback

---

**Status**: Ready to migrate  
**Risk**: Low (same database, parallel deployment)  
**Rollback**: Keep old service for 7 days

**Start**: Open `RAILWAY_MIGRATION_GUIDE.md` → Follow Step 1
