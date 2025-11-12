# 🚀 OAuth Deployment Checklist

## 📋 Pre-Deployment Checklist

### ✅ Phase 1-7: Backend Implementation (COMPLETE)
- [x] Database schema updated with OAuth fields
- [x] Google OAuth library installed and configured
- [x] Facebook OAuth library configured
- [x] OAuthService implemented with token validation
- [x] AuthService integrated with OAuth methods
- [x] 6 REST API endpoints created
- [x] Swagger documentation complete
- [x] Security features configured (rate limiting, guards, audit logs)

### ✅ Phase 8-11: Documentation & Testing (COMPLETE)
- [x] OAuth setup guide created (`docs/OAUTH_SETUP_GUIDE.md`)
- [x] Frontend integration guide created (`docs/FRONTEND_INTEGRATION_GUIDE.md`)
- [x] Unit tests written for OAuth service
- [x] `.env.example` updated with OAuth variables

### ⏳ Phase 12-14: Testing & Deployment (PENDING)
- [ ] Manual testing with real OAuth credentials
- [ ] E2E tests written and passing
- [ ] Production deployment configured

---

## 🔧 Environment Setup Checklist

### Development Environment

**1. Google OAuth Setup**
- [ ] Google Cloud project created
- [ ] OAuth consent screen configured
- [ ] Web client ID created
- [ ] iOS client ID created (if applicable)
- [ ] Android client ID created (if applicable)
- [ ] Authorized origins configured:
  - `http://localhost:3000`
  - `http://localhost:3001` (frontend)
- [ ] `.env` file updated:
  ```env
  GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
  GOOGLE_CLIENT_SECRET="GOCSPX-xxx"
  ```

**2. Facebook OAuth Setup**
- [ ] Facebook Developer account created
- [ ] Facebook App created (Consumer type)
- [ ] Facebook Login product added
- [ ] Valid OAuth Redirect URIs configured:
  - `http://localhost:3000/api/v1/auth/oauth/facebook/callback`
  - `http://localhost:3001/auth/callback`
- [ ] Allowed domains added:
  - `localhost`
- [ ] `.env` file updated:
  ```env
  FACEBOOK_APP_ID="1234567890123456"
  FACEBOOK_APP_SECRET="xxxxxxxxxx"
  ```

**3. Backend Configuration**
- [ ] Dependencies installed: `npm install`
- [ ] Prisma client generated: `npx prisma generate`
- [ ] Database migrated: `npx prisma migrate dev`
- [ ] Backend running: `npm run start:dev`
- [ ] Swagger accessible: http://localhost:3000/api/docs
- [ ] Health check passing: http://localhost:3000/api/v1/health

### Production Environment

**1. Google OAuth Production Setup**
- [ ] Production Google Cloud project created (separate from dev)
- [ ] OAuth consent screen configured for production
- [ ] Production web client ID created
- [ ] Production mobile client IDs created
- [ ] Authorized origins configured:
  - `https://api.mash.com`
  - `https://mash.com`
- [ ] Redirect URIs configured:
  - `https://api.mash.com/api/v1/auth/oauth/google/callback`
- [ ] Production credentials added to Railway/deployment platform

**2. Facebook OAuth Production Setup**
- [ ] Production Facebook App created (or dev app switched to Live mode)
- [ ] Privacy Policy URL added
- [ ] Terms of Service URL added
- [ ] App switched to "Live" mode
- [ ] Valid OAuth Redirect URIs configured:
  - `https://api.mash.com/api/v1/auth/oauth/facebook/callback`
  - `https://mash.com/auth/callback`
- [ ] Allowed domains added:
  - `mash.com`
  - `api.mash.com`
- [ ] Production credentials added to deployment platform

**3. CORS Configuration**
- [ ] Frontend URLs added to CORS whitelist
- [ ] `FRONTEND_URL` environment variable set
- [ ] CORS tested with production URLs

**4. Security Configuration**
- [ ] Rate limiting configured (10 req/5min for OAuth endpoints)
- [ ] JWT secrets rotated for production
- [ ] HTTPS enforced on production domain
- [ ] Secrets stored securely (Railway variables, AWS Secrets Manager, etc.)
- [ ] `.env` file excluded from version control

---

## 🧪 Testing Checklist

### Manual Testing (Development)

**Google Login Flow**
- [ ] Open Swagger UI: http://localhost:3000/api/docs
- [ ] Navigate to `POST /auth/google/login` endpoint
- [ ] Click "Try it out"
- [ ] Get Google ID token:
  - Option 1: Use Google OAuth Playground
  - Option 2: Use mobile app and log the token
- [ ] Paste token in request body:
  ```json
  {
    "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
  }
  ```
- [ ] Click "Execute"
- [ ] Verify response:
  - `200 OK` status
  - `accessToken` present
  - `refreshToken` present
  - `user` object with correct data
  - `isNewUser` flag correct

**Facebook Login Flow**
- [ ] Navigate to `POST /auth/facebook/login` endpoint
- [ ] Get Facebook access token:
  - Option 1: Use Facebook Graph API Explorer
  - Option 2: Use mobile app and log the token
- [ ] Paste token in request body:
  ```json
  {
    "accessToken": "EAABwzLixnjYBO6Df8BNCMl8Qs..."
  }
  ```
- [ ] Verify response (same as Google)

**Account Linking Flow**
- [ ] Login with email/password first
- [ ] Copy JWT access token from response
- [ ] Navigate to `POST /auth/social/link/google`
- [ ] Click lock icon, paste JWT token, click "Authorize"
- [ ] Paste Google ID token in request body
- [ ] Verify `200 OK` and account linked
- [ ] Navigate to `GET /auth/social/status`
- [ ] Verify `linkedProviders` includes "google"

**Account Unlinking Flow**
- [ ] Navigate to `DELETE /auth/social/unlink/:provider`
- [ ] Set `provider` parameter to "google"
- [ ] Verify `200 OK` and account unlinked
- [ ] Test unlinking last auth method (should fail with 400)

**Error Scenarios**
- [ ] Test with expired Google token → 400 error
- [ ] Test with invalid Facebook token → 400 error
- [ ] Test email conflict (same email with different provider) → 409 error
- [ ] Test rate limiting (send 11 requests in 5 minutes) → 429 error
- [ ] Test unlinking with no password set → 400 error

### Unit Tests

```bash
# Run OAuth unit tests
npm test -- oauth.service.spec.ts

# Expected results:
# ✓ Should validate Google ID token
# ✓ Should validate Facebook access token
# ✓ Should handle invalid tokens
# ✓ Should handle network errors
# ✓ Should handle missing email
# ✓ Should handle expired tokens
# Total: 30+ test cases passing
```

### Integration Tests (E2E)

```bash
# Run E2E tests
npm run test:e2e -- auth/google-login.e2e-spec.ts
npm run test:e2e -- auth/facebook-login.e2e-spec.ts
npm run test:e2e -- auth/social-linking.e2e-spec.ts

# Expected coverage: 80%+
```

### Load Testing

```bash
# Test OAuth endpoint performance
npm run test:load

# Targets:
# - Google login: < 500ms p95 latency
# - Facebook login: < 600ms p95 latency
# - 100 concurrent users: no failures
# - Rate limiting: correctly blocks after 10 req/5min
```

---

## 🚀 Deployment Steps

### Step 1: Pre-Deployment Verification

```bash
# 1. Run all tests
npm run test
npm run test:e2e
npm run test:cov

# 2. Build for production
npm run build

# 3. Check for TypeScript errors
npm run type-check

# 4. Lint code
npm run lint

# 5. Verify OAuth endpoints
curl http://localhost:3000/api/v1/health
```

### Step 2: Deploy to Staging

**Railway Deployment**:
```bash
# 1. Push to staging branch
git checkout staging
git merge develop
git push origin staging

# 2. Verify Railway build starts
# Check Railway dashboard: https://railway.app/

# 3. Add production environment variables
# Railway Dashboard → Variables:
GOOGLE_CLIENT_ID=production-client-id
GOOGLE_CLIENT_SECRET=production-secret
FACEBOOK_APP_ID=production-app-id
FACEBOOK_APP_SECRET=production-secret
NODE_ENV=staging

# 4. Wait for deployment
# Railway auto-deploys on git push

# 5. Test staging endpoints
curl https://staging.api.mash.com/api/v1/health
```

### Step 3: Smoke Tests (Staging)

```bash
# Test Google login
curl -X POST https://staging.api.mash.com/api/v1/auth/google/login \
  -H "Content-Type: application/json" \
  -d '{"idToken": "staging-test-token"}'

# Test Facebook login
curl -X POST https://staging.api.mash.com/api/v1/auth/facebook/login \
  -H "Content-Type: application/json" \
  -d '{"accessToken": "staging-test-token"}'

# Test health endpoint
curl https://staging.api.mash.com/api/v1/health

# Expected: All endpoints return 200 OK (or appropriate error for invalid tokens)
```

### Step 4: Deploy to Production

**Railway Production Deployment**:
```bash
# 1. Merge to main branch
git checkout main
git merge staging
git push origin main

# 2. Verify production build
# Railway Dashboard → Production Service

# 3. Update production environment variables
# Railway Dashboard → Production → Variables:
GOOGLE_CLIENT_ID=production-client-id
GOOGLE_CLIENT_SECRET=production-secret
FACEBOOK_APP_ID=production-app-id
FACEBOOK_APP_SECRET=production-secret
NODE_ENV=production
FRONTEND_URL=https://mash.com

# 4. Monitor deployment
# Railway logs: railway logs --follow

# 5. Verify production endpoints
curl https://api.mash.com/api/v1/health
```

### Step 5: Post-Deployment Verification

**Production Health Checks**:
```bash
# 1. Health endpoint
curl https://api.mash.com/api/v1/health
# Expected: {"status":"ok","info":{"database":{"status":"up"},...}}

# 2. Swagger documentation
open https://api.mash.com/api/docs
# Verify all OAuth endpoints visible

# 3. Metrics endpoint
curl https://api.mash.com/metrics
# Verify Prometheus metrics available

# 4. Test Google login (with real production token)
# Use mobile app or web app to generate token

# 5. Test Facebook login (with real production token)
# Use mobile app or web app to generate token
```

---

## 📊 Monitoring & Alerting

### Grafana Dashboards

**OAuth Metrics to Monitor**:
1. **Login Success Rate**
   - Query: `rate(mash_auth_login_total{provider=~"google|facebook",status="success"}[5m])`
   - Target: > 95%
   - Alert: < 90%

2. **OAuth Token Validation Errors**
   - Query: `rate(mash_oauth_token_validation_errors_total[5m])`
   - Target: < 1%
   - Alert: > 5%

3. **Account Linking Failures**
   - Query: `rate(mash_auth_link_account_total{status="error"}[5m])`
   - Target: < 2%
   - Alert: > 10%

4. **OAuth Login Latency**
   - Query: `histogram_quantile(0.95, rate(mash_http_request_duration_seconds_bucket{endpoint="/auth/google/login"}[5m]))`
   - Target: < 2 seconds (p95)
   - Alert: > 5 seconds

5. **Rate Limit Hits**
   - Query: `rate(mash_rate_limit_exceeded_total{endpoint=~"/auth/.*"}[5m])`
   - Target: < 5 req/min
   - Alert: > 20 req/min (possible abuse)

### Alert Configuration

**Prometheus Alert Rules** (`prometheus/alert.rules.yml`):
```yaml
groups:
  - name: oauth_alerts
    interval: 5m
    rules:
      - alert: HighOAuthFailureRate
        expr: rate(mash_auth_login_total{provider=~"google|facebook",status="error"}[5m]) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High OAuth login failure rate"
          description: "{{ $value }}% of OAuth logins are failing"

      - alert: GoogleTokenValidationFailed
        expr: rate(mash_oauth_token_validation_errors_total{provider="google"}[5m]) > 0.2
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Google token validation failures"
          description: "Backend unable to validate Google tokens"

      - alert: OAuthEndpointDown
        expr: up{job="mash-backend", endpoint=~"/auth/(google|facebook)/login"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "OAuth endpoint unreachable"
          description: "OAuth login endpoints are down"
```

---

## 🐛 Troubleshooting

### Common Production Issues

**Issue 1: "Invalid Google ID token" in production**

**Symptoms**:
- Works in development
- Fails in production with 400 error

**Solution**:
```bash
# 1. Verify production Google Client ID
echo $GOOGLE_CLIENT_ID
# Should be different from development

# 2. Check authorized origins in Google Cloud Console
# Must include: https://api.mash.com

# 3. Verify frontend is sending correct client ID
# Mobile app should use production iOS/Android client IDs

# 4. Check token audience claim
# Should match production web client ID
```

**Issue 2: Facebook app in Development Mode**

**Symptoms**:
- Only test users can log in
- Production users see "App Not Setup" error

**Solution**:
```bash
# 1. Go to Facebook App Dashboard
# 2. Click "App Mode" toggle (top bar)
# 3. Switch from "Development" to "Live"
# 4. Ensure Privacy Policy and Terms of Service URLs are set
# 5. Re-test with non-test user
```

**Issue 3: CORS errors in production**

**Symptoms**:
- OAuth works via Swagger
- Fails from frontend with CORS error

**Solution**:
```bash
# 1. Check FRONTEND_URL environment variable
echo $FRONTEND_URL
# Should be: https://mash.com (not http://)

# 2. Verify CORS config in main.ts
# Should include production frontend URL

# 3. Check browser console for exact error
# Look for: "Access-Control-Allow-Origin"

# 4. Update CORS whitelist if needed
```

---

## ✅ Final Verification

### Production Checklist

- [ ] All tests passing (unit + E2E)
- [ ] OAuth credentials configured for production
- [ ] Backend deployed successfully
- [ ] Health check returns OK
- [ ] Swagger UI accessible
- [ ] Google login works with production credentials
- [ ] Facebook login works with production credentials
- [ ] Account linking works
- [ ] Account unlinking works (with validation)
- [ ] Rate limiting active (test with 11 requests)
- [ ] Grafana dashboard showing OAuth metrics
- [ ] Prometheus alerts configured
- [ ] Error logs monitored (no critical errors)
- [ ] Mobile app tested (iOS + Android)
- [ ] Web app tested (Chrome, Safari, Firefox)
- [ ] Documentation updated
- [ ] Team notified of OAuth availability

---

## 📞 Support

### Resources

- **OAuth Setup Guide**: `docs/OAUTH_SETUP_GUIDE.md`
- **Frontend Integration Guide**: `docs/FRONTEND_INTEGRATION_GUIDE.md`
- **Swagger API Docs**: https://api.mash.com/api/docs
- **Grafana Dashboard**: https://grafana.mash.com
- **Railway Dashboard**: https://railway.app/
- **Google Cloud Console**: https://console.cloud.google.com/
- **Facebook Developers**: https://developers.facebook.com/apps/

### Emergency Rollback

If OAuth is causing issues in production:

```bash
# 1. Disable OAuth endpoints temporarily
# Set in Railway environment variables:
OAUTH_ENABLED=false

# 2. Or revert to previous deployment
git revert HEAD
git push origin main

# 3. Monitor error rates
# Check Grafana dashboard

# 4. Fix issue in staging
# Test thoroughly before re-deploying

# 5. Re-enable OAuth
OAUTH_ENABLED=true
```

---

**Document Version**: 1.0  
**Last Updated**: November 12, 2025  
**Status**: ✅ Ready for Deployment  
**Estimated Deployment Time**: 2-4 hours (including testing)
