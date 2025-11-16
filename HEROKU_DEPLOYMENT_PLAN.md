# Heroku Deployment Plan for MASH-Backend

**Project:** MASH-Backend (NestJS 10 + Prisma 5 + PostgreSQL)  
**Date:** November 16, 2025  
**Status:** 🔴 Failed - Dependency Conflict

---

## 📊 Current Situation Analysis

### Failed Deployment Error
```
npm error ERESOLVE could not resolve
npm error While resolving: @nestjs/bull@10.2.3
npm error Found: @nestjs/common@11.1.7
npm error Could not resolve dependency:
npm error peer @nestjs/common@"^8.0.0 || ^9.0.0 || ^10.0.0" from @nestjs/bull@10.2.3
```

**Root Cause:** `@nestjs/bull@10.2.3` doesn't support `@nestjs/common@11.x`, but your project uses NestJS 11.

---

## 🎯 Deployment Plan Overview

### Phase 1: Fix Dependency Conflicts ⚠️ **CRITICAL**
### Phase 2: Create Heroku Configuration Files
### Phase 3: Configure PostgreSQL Database
### Phase 4: Set Environment Variables
### Phase 5: Deploy and Test
### Phase 6: Post-Deployment Setup

---

## 📋 Phase 1: Fix Dependency Conflicts (REQUIRED FIRST)

### Option A: Update @nestjs/bull (RECOMMENDED)
```bash
npm uninstall @nestjs/bull @nestjs/bull-shared
npm install @nestjs/bullmq@^11.0.0 --legacy-peer-deps
```

**Why BullMQ?** `@nestjs/bull` is deprecated. BullMQ is the official replacement supporting NestJS 11.

**Code Changes Required:**
1. Update imports: `@nestjs/bull` → `@nestjs/bullmq`
2. Update `BullModule` → `BullMQModule` in all modules
3. Update queue decorators: `@InjectQueue()` remains the same

### Option B: Temporary Workaround (NOT RECOMMENDED)
Set Heroku config var:
```bash
heroku config:set NPM_CONFIG_LEGACY_PEER_DEPS=true -a mash-backend
```

**⚠️ Warning:** This ignores peer dependency conflicts and may cause runtime errors.

### Option C: Downgrade NestJS (NOT RECOMMENDED)
Downgrade entire project to NestJS 10.x (not feasible - you're using NestJS 11 features).

---

## 📋 Phase 2: Create Heroku Configuration Files

### 2.1 Create `Procfile`
```bash
echo web: npm run start:prod:migrate > Procfile
```

**File Content:**
```
web: npm run start:prod:migrate
```

**What it does:**
- Runs Prisma migrations on startup
- Starts production server
- Uses existing script from `package.json`

### 2.2 Create `.npmrc` (Optional but Recommended)
```
legacy-peer-deps=true
engine-strict=false
```

### 2.3 Update `package.json` - Add Heroku Scripts
```json
{
  "scripts": {
    "heroku-postbuild": "npm run build && npx prisma generate"
  },
  "engines": {
    "node": "22.x",
    "npm": "10.x"
  }
}
```

**What `heroku-postbuild` does:**
1. Builds NestJS app (`npm run build`)
2. Generates Prisma Client (`npx prisma generate`)

---

## 📋 Phase 3: Configure PostgreSQL Database

### 3.1 Add Heroku Postgres Add-on
```bash
heroku addons:create heroku-postgresql:essential-0 -a mash-backend
```

**Plans:**
- `essential-0` - $5/month (20 GB storage, 20 connections)
- `mini` - $5/month (10 GB storage, 20 connections)
- `hobby-dev` - FREE (10k rows, 20 connections) - **Good for testing**

### 3.2 Verify Database Configuration
```bash
heroku config:get DATABASE_URL -a mash-backend
```

**Expected format:**
```
postgres://user:password@host:5432/database
```

### 3.3 Update Prisma Schema (Already Correct ✓)
Your `schema.prisma` already has:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

## 📋 Phase 4: Set Environment Variables

### 4.1 Required Environment Variables

Run these commands:

```bash
# Database (Auto-configured by Heroku Postgres)
# DATABASE_URL is automatically set by Heroku

# For Prisma connection pooling (optional but recommended)
heroku config:set DIRECT_URL=$(heroku config:get DATABASE_URL -a mash-backend) -a mash-backend

# Node Environment
heroku config:set NODE_ENV=production -a mash-backend

# JWT Configuration
heroku config:set JWT_SECRET=your-super-secure-jwt-secret-min-32-chars -a mash-backend
heroku config:set JWT_EXPIRES_IN=7d -a mash-backend

# Clerk Authentication
heroku config:set CLERK_PUBLISHABLE_KEY=pk_live_xxx -a mash-backend
heroku config:set CLERK_SECRET_KEY=sk_live_xxx -a mash-backend
heroku config:set CLERK_WEBHOOK_SECRET=whsec_xxx -a mash-backend

# Application Settings
heroku config:set PORT=3000 -a mash-backend
heroku config:set APP_NAME="MASH Backend" -a mash-backend
heroku config:set APP_URL=https://mash-backend-xxx.herokuapp.com -a mash-backend
heroku config:set FRONTEND_URL=https://your-frontend.vercel.app -a mash-backend

# Email Configuration (SendGrid)
heroku config:set SENDGRID_API_KEY=SG.xxx -a mash-backend
heroku config:set SENDGRID_FROM_EMAIL=noreply@yourdomain.com -a mash-backend
heroku config:set SENDGRID_FROM_NAME="MASH Platform" -a mash-backend

# File Upload (AWS S3)
heroku config:set AWS_ACCESS_KEY_ID=xxx -a mash-backend
heroku config:set AWS_SECRET_ACCESS_KEY=xxx -a mash-backend
heroku config:set AWS_REGION=us-east-1 -a mash-backend
heroku config:set AWS_S3_BUCKET=mash-uploads -a mash-backend

# Redis (Optional - for caching/queues)
# If you want Redis, add Heroku Redis add-on:
# heroku addons:create heroku-redis:mini -a mash-backend
# REDIS_URL is automatically set

# Payment Gateway (Stripe/PayPal)
heroku config:set STRIPE_SECRET_KEY=sk_live_xxx -a mash-backend
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_xxx -a mash-backend

# SMS (Twilio/Vonage)
heroku config:set TWILIO_ACCOUNT_SID=xxx -a mash-backend
heroku config:set TWILIO_AUTH_TOKEN=xxx -a mash-backend
heroku config:set TWILIO_PHONE_NUMBER=+1234567890 -a mash-backend

# Firebase (Push Notifications)
heroku config:set FIREBASE_PROJECT_ID=xxx -a mash-backend
heroku config:set FIREBASE_CLIENT_EMAIL=xxx -a mash-backend
heroku config:set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nxxx\n-----END PRIVATE KEY-----\n" -a mash-backend

# CORS Configuration
heroku config:set CORS_ORIGIN=https://your-frontend.vercel.app,https://admin.yourdomain.com -a mash-backend
```

### 4.2 View All Config Vars
```bash
heroku config -a mash-backend
```

---

## 📋 Phase 5: Deploy and Test

### 5.1 Deploy from GitHub (Current Setup)

**Manual Deploy:**
1. Go to Heroku Dashboard → mash-backend → Deploy tab
2. Choose branch: `main`
3. Click "Deploy Branch"

### 5.2 Enable Automatic Deploys (Optional)
1. Go to "Automatic deploys" section
2. Choose branch: `main`
3. ✅ Enable "Wait for CI to pass before deploy" (if you have GitHub Actions)
4. Click "Enable Automatic Deploys"

### 5.3 Monitor Deployment
```bash
# View build logs
heroku logs --tail -a mash-backend

# Check dyno status
heroku ps -a mash-backend

# Run one-off dyno for debugging
heroku run bash -a mash-backend
```

### 5.4 Test Endpoints

```bash
# Health check
curl https://mash-backend-xxx.herokuapp.com/health

# API documentation
curl https://mash-backend-xxx.herokuapp.com/api-docs

# Metrics (if enabled)
curl https://mash-backend-xxx.herokuapp.com/metrics
```

---

## 📋 Phase 6: Post-Deployment Setup

### 6.1 Run Database Migrations (If Not Auto-Run)
```bash
heroku run npm run db:deploy -a mash-backend
```

### 6.2 Seed Database (Optional)
```bash
heroku run npm run db:seed -a mash-backend
```

### 6.3 Scale Dynos (If Needed)
```bash
# Check current dyno configuration
heroku ps -a mash-backend

# Scale web dynos
heroku ps:scale web=1 -a mash-backend

# For production, consider:
# heroku ps:scale web=2:standard-1x -a mash-backend
```

### 6.4 Set Up Custom Domain (Optional)
```bash
heroku domains:add api.yourdomain.com -a mash-backend
```

Then add DNS record:
```
CNAME api.yourdomain.com -> mash-backend-xxx.herokuapp.com
```

### 6.5 Enable SSL (Heroku provides free SSL)
```bash
heroku certs:auto:enable -a mash-backend
```

---

## 🛠️ Troubleshooting Common Issues

### Issue 1: Build Still Fails After Fixing Dependencies
```bash
# Clear build cache
heroku repo:purge_cache -a mash-backend

# Redeploy
git commit --allow-empty -m "Trigger rebuild"
git push heroku main
```

### Issue 2: Database Connection Fails
```bash
# Verify DATABASE_URL
heroku config:get DATABASE_URL -a mash-backend

# Check Prisma schema
heroku run npx prisma db pull -a mash-backend

# Test connection
heroku run node -e "require('@prisma/client').PrismaClient && console.log('OK')" -a mash-backend
```

### Issue 3: Application Crashes on Startup
```bash
# View logs
heroku logs --tail -a mash-backend

# Common fixes:
# - Ensure PORT uses process.env.PORT
# - Check environment variables
# - Verify Procfile exists
```

### Issue 4: Prisma Client Not Generated
```bash
# Manually generate
heroku run npx prisma generate -a mash-backend

# Or add to package.json:
# "heroku-postbuild": "npm run build && npx prisma generate"
```

---

## 💰 Cost Estimation (Monthly)

| Service | Plan | Cost |
|---------|------|------|
| Heroku Dyno | Eco (1000 hrs/month) | $5 |
| PostgreSQL | Essential-0 (20 GB) | $5 |
| Redis (Optional) | Mini (25 MB) | $3 |
| **Total** | | **$10-13/month** |

**Free Tier Option:**
- Use `hobby-dev` PostgreSQL (free, limited to 10k rows)
- Skip Redis (app gracefully degrades)
- Use free dyno hours (550 hrs/month)

---

## 📝 Pre-Deployment Checklist

- [ ] Fix `@nestjs/bull` dependency conflict (Phase 1)
- [ ] Create `Procfile`
- [ ] Add `heroku-postbuild` script to `package.json`
- [ ] Add PostgreSQL add-on
- [ ] Set all required environment variables
- [ ] Test locally with `npm run build && npm run start:prod`
- [ ] Commit and push changes to GitHub
- [ ] Deploy from Heroku Dashboard
- [ ] Monitor logs for errors
- [ ] Test API endpoints
- [ ] Run database migrations
- [ ] Verify health check endpoint

---

## 🚀 Quick Start Commands

```bash
# 1. Fix dependencies (CRITICAL FIRST STEP)
npm uninstall @nestjs/bull @nestjs/bull-shared
npm install @nestjs/bullmq@^11.0.0 --legacy-peer-deps
npm run build  # Verify build works

# 2. Create Procfile
echo web: npm run start:prod:migrate > Procfile

# 3. Add Heroku postbuild to package.json (manual edit)
# Add: "heroku-postbuild": "npm run build && npx prisma generate"

# 4. Commit changes
git add .
git commit -m "fix: resolve @nestjs/bull dependency conflict for Heroku deployment"
git push origin main

# 5. Add PostgreSQL to Heroku
heroku addons:create heroku-postgresql:essential-0 -a mash-backend

# 6. Set essential environment variables
heroku config:set NODE_ENV=production -a mash-backend
heroku config:set JWT_SECRET=your-secret-here -a mash-backend

# 7. Deploy from Heroku Dashboard (GitHub integration)
# Or push directly:
# git push heroku main

# 8. Monitor deployment
heroku logs --tail -a mash-backend

# 9. Test deployment
curl https://mash-backend-xxx.herokuapp.com/health
```

---

## 📚 Additional Resources

- [Heroku Node.js Support](https://devcenter.heroku.com/articles/nodejs-support)
- [Heroku Postgres](https://devcenter.heroku.com/articles/heroku-postgresql)
- [Prisma + Heroku Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-heroku)
- [NestJS Deployment](https://docs.nestjs.com/faq/serverless)
- [BullMQ Migration Guide](https://docs.bullmq.io/bull/migration)

---

## 🆘 Need Help?

**Common Commands:**
```bash
heroku logs --tail -a mash-backend              # View logs
heroku ps -a mash-backend                       # Check dyno status
heroku config -a mash-backend                   # View environment variables
heroku run bash -a mash-backend                 # Access dyno shell
heroku restart -a mash-backend                  # Restart application
heroku releases -a mash-backend                 # View release history
heroku rollback -a mash-backend                 # Rollback to previous release
```

**Support Contacts:**
- Heroku Support: https://help.heroku.com
- GitHub Issues: https://github.com/MASH-Mushroom-Automation/MASH-Backend/issues

---

**Last Updated:** November 16, 2025  
**Next Review:** After successful deployment
