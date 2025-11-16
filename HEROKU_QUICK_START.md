# 🚀 Heroku Deployment Quick Start

**Critical:** Fix dependency conflict FIRST before deploying!

## Step 1: Fix @nestjs/bull Dependency Conflict ⚠️

```bash
# Uninstall conflicting packages
npm uninstall @nestjs/bull @nestjs/bull-shared

# Install BullMQ (official NestJS 11 compatible version)
npm install @nestjs/bullmq@^11.0.0 --legacy-peer-deps

# Verify build works
npm run build
```

### Update Code (if using Bull)
If you're using Bull queues, update imports:
```typescript
// Before
import { BullModule } from '@nestjs/bull';

// After
import { BullModule } from '@nestjs/bullmq';
```

## Step 2: Commit Changes

```bash
git add .
git commit -m "fix: resolve @nestjs/bull dependency conflict for Heroku"
git push origin main
```

## Step 3: Add PostgreSQL to Heroku

```bash
heroku addons:create heroku-postgresql:essential-0 -a mash-backend
```

**Or use free tier for testing:**
```bash
heroku addons:create heroku-postgresql:hobby-dev -a mash-backend
```

## Step 4: Set Essential Environment Variables

```bash
# Node environment
heroku config:set NODE_ENV=production -a mash-backend

# JWT (generate with: openssl rand -base64 32)
heroku config:set JWT_SECRET=your-super-secure-secret-here -a mash-backend

# Clerk Auth (get from clerk.dev dashboard)
heroku config:set CLERK_PUBLISHABLE_KEY=pk_live_xxx -a mash-backend
heroku config:set CLERK_SECRET_KEY=sk_live_xxx -a mash-backend

# CORS (update with your frontend URL)
heroku config:set CORS_ORIGIN=https://your-frontend.vercel.app -a mash-backend
heroku config:set FRONTEND_URL=https://your-frontend.vercel.app -a mash-backend

# App URLs
heroku config:set APP_URL=https://mash-backend.herokuapp.com -a mash-backend
```

**For complete list, see:** `heroku-env-setup.sh`

## Step 5: Deploy

### Option A: Deploy from Heroku Dashboard (Recommended)
1. Go to: https://dashboard.heroku.com/apps/mash-backend/deploy/github
2. Choose branch: `main`
3. Click **"Deploy Branch"**
4. Wait for build to complete

### Option B: Deploy via Git
```bash
# If you haven't added Heroku remote
heroku git:remote -a mash-backend

# Push to Heroku
git push heroku main
```

## Step 6: Monitor Deployment

```bash
# View real-time logs
heroku logs --tail -a mash-backend

# Check app status
heroku ps -a mash-backend
```

## Step 7: Test Deployment

```bash
# Health check
curl https://mash-backend.herokuapp.com/health

# Should return: {"status":"ok","info":{...},"details":{...}}
```

## Step 8: Run Migrations (if needed)

```bash
heroku run npm run db:deploy -a mash-backend
```

## ✅ Deployment Checklist

- [ ] Fixed @nestjs/bull dependency
- [ ] Committed Procfile and .npmrc
- [ ] Added PostgreSQL addon
- [ ] Set JWT_SECRET
- [ ] Set Clerk credentials
- [ ] Set CORS_ORIGIN
- [ ] Deployed successfully
- [ ] Tested /health endpoint
- [ ] Ran database migrations

## 🆘 Troubleshooting

### Build fails with npm error
```bash
# Set legacy peer deps config
heroku config:set NPM_CONFIG_LEGACY_PEER_DEPS=true -a mash-backend

# Clear build cache
heroku repo:purge_cache -a mash-backend

# Redeploy
git commit --allow-empty -m "Trigger rebuild"
git push heroku main
```

### Application crashes (H10 error)
```bash
# Check logs
heroku logs --tail -a mash-backend

# Common causes:
# - Missing environment variables
# - Database connection failed
# - Port not using process.env.PORT
```

### Database connection error
```bash
# Verify DATABASE_URL exists
heroku config:get DATABASE_URL -a mash-backend

# Test Prisma connection
heroku run npx prisma db pull -a mash-backend
```

## 📚 Next Steps

1. **Set up Redis** (for queues/caching):
   ```bash
   heroku addons:create heroku-redis:mini -a mash-backend
   ```

2. **Configure custom domain**:
   ```bash
   heroku domains:add api.yourdomain.com -a mash-backend
   ```

3. **Enable automatic deploys**:
   - Dashboard → Deploy → Enable Automatic Deploys

4. **Scale dynos** (for production):
   ```bash
   heroku ps:scale web=2:standard-1x -a mash-backend
   ```

5. **Set up monitoring**:
   - Add Heroku metrics
   - Configure error tracking (Sentry)
   - Set up uptime monitoring

## 📖 Full Documentation

See `HEROKU_DEPLOYMENT_PLAN.md` for complete deployment guide.

---

**Need help?** Run: `heroku help` or visit https://devcenter.heroku.com
