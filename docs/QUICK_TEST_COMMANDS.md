# Quick Test Commands - Railway Health Check Fix

**Run these commands after Railway deployment shows "Successful"**

---

## Test 1: Emergency Health Check (Run Immediately)

```bash
curl -i https://mash-backend-api-production.up.railway.app/api/v1/health
```

**Expected:** HTTP 200, response in <1 second with `"emergency": true`

---

## Test 2: Full Health Controller (Wait 2 Minutes, Then Run)

```bash
curl https://mash-backend-api-production.up.railway.app/api/v1/health
```

**Expected:** HTTP 200, NO `"emergency"` key (controller took over)

---

## Test 3: Database Health

```bash
curl https://mash-backend-api-production.up.railway.app/api/v1/health/database
```

**Expected:** HTTP 200, `"connected": true`

---

## Test 4: System Health

```bash
curl https://mash-backend-api-production.up.railway.app/api/v1/health/system
```

**Expected:** HTTP 200, all components healthy

---

## Test 5: Swagger Docs

```bash
curl -I https://mash-backend-api-production.up.railway.app/api/docs
```

**Expected:** HTTP 200

---

## Local Testing (Optional)

```bash
# Start server
npm run start:dev

# Wait for "READY FOR TRAFFIC" message, then test
curl http://localhost:3000/api/v1/health
```

---

## Success Indicators

✅ All tests return HTTP 200
✅ Emergency bypass works immediately
✅ Full controller takes over after 2 minutes
✅ Database connection successful
✅ No "emergency" key in final response

---

**Monitor Railway:** https://railway.app/dashboard
**Expected Success:** ~6 minutes after push (around 11:41 PM)
