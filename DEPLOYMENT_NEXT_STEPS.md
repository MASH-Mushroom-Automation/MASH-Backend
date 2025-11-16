# ✅ Heroku Deployment - Next Steps

## 🎉 Dependency Conflict RESOLVED!

✅ **Completed Steps:**
1. ✅ Migrated from `@nestjs/bull` to `@nestjs/bullmq` 
2. ✅ Updated all imports and processors (12 files)
3. ✅ Fixed BullMQ configuration and added super() calls
4. ✅ Build verified successfully (`npm run build`)
5. ✅ Changes committed and pushed to GitHub main branch
6. ✅ Created Procfile, .npmrc, and heroku-postbuild script

---

## 📋 Remaining Steps (Manual)

### Step 5: Add PostgreSQL to Heroku

**Go to:** https://dashboard.heroku.com/apps/mash-backend/resources

**Then:**
1. Click "Find more add-ons"
2. Search for "Heroku Postgres"
3. Select plan: **Essential-0** ($5/month) or **Mini** (free for testing)
4. Click "Provision"
5. DATABASE_URL will be automatically set

**OR use Heroku CLI (if installed):**
```bash
heroku addons:create heroku-postgresql:essential-0 -a mash-backend
```

---

### Step 6: Configure Environment Variables

**Go to:** https://dashboard.heroku.com/apps/mash-backend/settings

Click "Reveal Config Vars" and add these **REQUIRED** variables:

#### 🔐 Authentication (REQUIRED)
```
NODE_ENV = production
JWT_SECRET = [Generate with: openssl rand -base64 32]
CLERK_PUBLISHABLE_KEY = pk_live_xxx
CLERK_SECRET_KEY = sk_live_xxx
CLERK_WEBHOOK_SECRET = whsec_xxx
```

#### 🌐 Application URLs (REQUIRED)
```
APP_URL = https://mash-backend-xxx.herokuapp.com
FRONTEND_URL = https://your-frontend-url.vercel.app
CORS_ORIGIN = https://your-frontend-url.vercel.app
```

#### 📧 Email (REQUIRED for notifications)
```
SENDGRID_API_KEY = SG.xxx
SENDGRID_FROM_EMAIL = noreply@yourdomain.com
SENDGRID_FROM_NAME = MASH Platform
```

#### Optional but Recommended:
- AWS S3 (file uploads): AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET
- Stripe (payments): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- Twilio (SMS): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
- Firebase (push): FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

**See complete list:** `heroku-env-setup.sh` in project root

---

### Step 7: Deploy to Heroku

**Option A: Deploy from Heroku Dashboard (Easiest)**

1. **Go to:** https://dashboard.heroku.com/apps/mash-backend/deploy/github
2. **Scroll to "Manual deploy"**
3. **Choose branch:** `main`
4. **Click:** "Deploy Branch"
5. **Wait for build to complete** (view logs)

**Option B: Enable Automatic Deploys**

1. Go to same page
2. Scroll to "Automatic deploys"
3. Choose branch: `main`
4. (Optional) Enable "Wait for CI to pass before deploy"
5. Click "Enable Automatic Deploys"

---

### Step 8: Monitor Deployment

**View Real-Time Logs:**
1. Go to: https://dashboard.heroku.com/apps/mash-backend
2. Click "More" → "View logs"
3. Watch for successful deployment

**Expected Success Message:**
```
-----> Build succeeded!
-----> Discovering process types
       Procfile declares types -> web
-----> Compressing...
       Done: XX.XM
-----> Launching...
       Released vX
       https://mash-backend-xxx.herokuapp.com/ deployed to Heroku
```

---

### Step 9: Test Deployment

**Health Check Endpoint:**
```bash
curl https://mash-backend-xxx.herokuapp.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "info": {
    "database": {"status": "up"},
    "memory_heap": {"status": "up"}
  }
}
```

**API Documentation:**
```
https://mash-backend-xxx.herokuapp.com/api-docs
```

---

### Step 10: Post-Deployment Tasks

#### Verify Database Migrations Ran
The Procfile runs migrations automatically: `npm run start:prod:migrate`

If you need to manually run migrations:
1. Go to: https://dashboard.heroku.com/apps/mash-backend
2. Click "More" → "Run console"
3. Type: `npm run db:deploy`
4. Click "Run"

#### Seed Database (Optional)
Run console command:
```bash
npm run db:seed
```

#### Scale Dynos (If Needed)
For production with more traffic:
1. Go to: https://dashboard.heroku.com/apps/mash-backend/resources
2. Click edit (pencil icon) next to "web"
3. Change to 2+ dynos
4. Consider upgrading to Standard or Performance dynos

---

## 🐛 Troubleshooting

### If Build Fails:
1. Check build logs in dashboard
2. Verify all env vars are set
3. Ensure `package.json` has `heroku-postbuild` script
4. Try clearing build cache: Dashboard → Settings → "Clear build cache"

### If App Crashes (H10 Error):
1. View logs: Dashboard → More → View logs
2. Common causes:
   - Missing JWT_SECRET or CLERK keys
   - DATABASE_URL not set (should be automatic with Postgres addon)
   - Port not using `process.env.PORT`

### If Database Connection Fails:
1. Verify Postgres addon is provisioned
2. Check DATABASE_URL is set: Config Vars should show it
3. Check logs for Prisma errors

---

## 📊 What Changed (BullMQ Migration)

**Files Modified (16 total):**
- ✅ package.json (added @nestjs/bullmq, heroku-postbuild)
- ✅ Procfile (created)
- ✅ .npmrc (created)
- ✅ All queue modules and processors (12 files)

**Key Changes:**
- `@nestjs/bull` → `@nestjs/bullmq`
- `BullAdapter` → `BullMQAdapter`
- `@Process()` decorator → `process()` method
- `@OnQueueActive()` → `@OnWorkerEvent('active')`
- Added `super()` calls to all processor constructors
- Changed `redis:` config to `connection:`

---

## 🎯 Success Criteria

- ✅ Build completes without errors
- ✅ Migrations run successfully
- ✅ `/health` endpoint returns 200 OK
- ✅ `/api-docs` shows Swagger UI
- ✅ No crash errors in logs
- ✅ Can create test user/product via API

---

## 📚 Resources

- **Heroku Dashboard:** https://dashboard.heroku.com/apps/mash-backend
- **GitHub Repo:** https://github.com/MASH-Mushroom-Automation/MASH-Backend
- **BullMQ Docs:** https://docs.bullmq.io/
- **Heroku Node.js:** https://devcenter.heroku.com/articles/nodejs-support

---

## 💡 Pro Tips

1. **Enable Automatic Deploys** after verifying manual deploy works
2. **Set up Heroku Scheduler** for cron jobs (free)
3. **Add Redis addon** for queue persistence: `heroku-redis:mini` ($3/month)
4. **Enable Heroku Metrics** for monitoring (free)
5. **Set up custom domain** when ready

---

## ✅ Deployment Checklist

- [x] Fix dependency conflict (@nestjs/bull → @nestjs/bullmq)
- [x] Build verified locally (npm run build)
- [x] Changes committed and pushed to GitHub
- [x] Procfile created
- [x] heroku-postbuild script added
- [ ] PostgreSQL addon added to Heroku
- [ ] Essential env vars configured (JWT_SECRET, CLERK keys)
- [ ] Deployed from Heroku Dashboard
- [ ] Health check endpoint tested
- [ ] API documentation accessible
- [ ] Database migrations verified

---

**Questions?** Check the full deployment plan in `HEROKU_DEPLOYMENT_PLAN.md`

**Last Updated:** November 16, 2025  
**Status:** Ready for Steps 5-10 (manual Heroku dashboard steps)
