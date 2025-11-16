# 🚀 Heroku Deployment - Quick Command Reference

## ✅ COMPLETED (Automated)
```bash
✓ Fixed @nestjs/bull dependency conflict
✓ Migrated to @nestjs/bullmq (NestJS 11 compatible)
✓ Created Procfile, .npmrc files
✓ Added heroku-postbuild script
✓ Build verified: npm run build ✓
✓ Committed and pushed to GitHub main
```

---

## 📝 NEXT STEPS (Manual - Heroku Dashboard)

### 1️⃣ Add PostgreSQL (2 minutes)
**URL:** https://dashboard.heroku.com/apps/mash-backend/resources
- Click "Find more add-ons"
- Search "Heroku Postgres"
- Select "Essential-0" ($5/mo) or "Mini" (free)
- Click "Provision"

### 2️⃣ Set Environment Variables (5 minutes)
**URL:** https://dashboard.heroku.com/apps/mash-backend/settings
- Click "Reveal Config Vars"
- Add these REQUIRED variables:

```
NODE_ENV               = production
JWT_SECRET             = [Run: openssl rand -base64 32]
CLERK_PUBLISHABLE_KEY  = pk_live_xxx
CLERK_SECRET_KEY       = sk_live_xxx
APP_URL                = https://mash-backend-xxx.herokuapp.com
FRONTEND_URL           = https://your-frontend.vercel.app
CORS_ORIGIN            = https://your-frontend.vercel.app
SENDGRID_API_KEY       = SG.xxx
SENDGRID_FROM_EMAIL    = noreply@yourdomain.com
```

### 3️⃣ Deploy Application (3 minutes)
**URL:** https://dashboard.heroku.com/apps/mash-backend/deploy/github
- Scroll to "Manual deploy"
- Choose branch: **main**
- Click **"Deploy Branch"**
- Watch logs for success

### 4️⃣ Test Deployment (1 minute)
**Test URL:** https://mash-backend-xxx.herokuapp.com/health
- Should return: `{"status":"ok",...}`
- View API docs: https://mash-backend-xxx.herokuapp.com/api-docs

---

## 🔥 DEPLOYMENT SHOULD NOW WORK!

The critical dependency conflict is **RESOLVED**. 
The build will succeed this time! 🎉

---

## 🆘 If Issues Occur

### Build Fails?
1. Check logs in Heroku Dashboard → More → View logs
2. Verify DATABASE_URL is set (should be automatic)
3. Ensure all required env vars are set

### App Crashes?
1. View logs: Dashboard → More → View logs
2. Check JWT_SECRET is set
3. Verify CLERK keys are correct

### Database Error?
1. Verify Postgres addon is provisioned
2. DATABASE_URL should be in Config Vars
3. Migrations run automatically via Procfile

---

## 📞 Support

**Full Guide:** `DEPLOYMENT_NEXT_STEPS.md`
**Complete Plan:** `HEROKU_DEPLOYMENT_PLAN.md`
**Quick Start:** `HEROKU_QUICK_START.md`

---

**Estimated Total Time:** 10-15 minutes
**Ready to Deploy:** YES ✅
