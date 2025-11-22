# Railway Environment Variables - New Deployment (mash-space)

**Service**: web  
**URL**: https://mash-space.up.railway.app  
**Date**: November 23, 2025

---

## 🔴 CRITICAL - Must Configure First

### Redis Configuration (Use Railway Service Reference)
```env
# Option 1: Railway Service Reference (RECOMMENDED)
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_HOST=${{Redis.REDISHOST}}
REDIS_PORT=${{Redis.REDISPORT}}
REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
REDISUSER=${{Redis.REDISUSER}}

# Option 2: Actual Values (for reference)
# REDIS_URL=redis://default:lNicVMNJFUNLjGotxGqSkDPjsMAcpKYc@redis.railway.internal:6379
# REDIS_HOST=redis.railway.internal
# REDIS_PORT=6379
# REDIS_PASSWORD=lNicVMNJFUNLjGotxGqSkDPjsMAcpKYc
# REDISUSER=default
```

### Application URLs (Updated for New Deployment)
```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
BACKEND_URL=https://mash-space.up.railway.app
APP_URL=https://mash-space.up.railway.app
BASE_URL=https://mash-space.up.railway.app
FRONTEND_URL=https://mash-space.up.railway.app
```

### Database (No Change - Same Neon PostgreSQL)
```env
DATABASE_URL=postgresql://neondb_owner:npg_B4tIx6OCXiDN@ep-wispy-dream-aduaegct-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&connection_limit=3&pool_timeout=20
DIRECT_URL=postgresql://neondb_owner:npg_B4tIx6OCXiDN@ep-wispy-dream-aduaegct.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```

---

## 🟡 IMPORTANT - Required for Full Functionality

### Firebase Authentication
```env
FIREBASE_PROJECT_ID=mash-5b627
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@mash-5b627.iam.gserviceaccount.com
FIREBASE_API_KEY=
FIREBASE_DATABASE_URL=https://mash-5b627-default-rtdb.firebaseio.com
FIREBASE_AUTH_EMULATOR_HOST=http://127.0.0.1:9099
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCp2E7BnyVgvfOH\nKlZxsGbBZC2totVWwZog4+oNIAcap6C/nmqGsJnN8qrI/9JqB+afp/8xAmZIxdEH\nM/p6xJXrRe8jVltErEwBM71X6Hl/3hHPGBY6TKQqp8aMx7Zm59NrCazDT2+RHehU\nNo5ezfRSrgR7WI824U5pIiXVf74SdLq/90diTji0XHzVjwTuKYs5gIKmNNEjmsSV\nk3jT4iVcgbJfQu75pC3vPDFcUo97fJZKDdQ57x4zkbJ/fqIOf+HVROzCJ1tG3CQG\nPBKLCE48uXMLQOKZNYuRWQuJsKp3/MZ03DXZwMp7ZOtQQNSVjLoBM/1oklrNSU+P\nLKo7DQFHAgMBAAECggEAT/n3O91AsIlBf0hEZEx4VmBh0f13D98iQJKRx5RpQ/fj\nDdf+uWW3Ru8Z1IQCBMOrqUpmNCG5IFNl1kp3jA+9uIe5z53+ZBvtvjMq2ZYygC+F\nm0rwTIuCUkOmjuwLy/El8KUhoOZq1p6Ko/z8lU/N2JDws1REO8dkMMVPo3T/f5iL\nGP4tc6/BuJ8qCxSysrl27O8EJqbn1PgbOPegE/7mO4FdbBnY+1HwFHi38jIe/W2/\ncsJR8CPz+FHYd7R4erqOmgJuoKYJ1A2eItSIf+7lrCakjmPtVsovmLQteWJK42X7\nSGx5Lf/DNiln885fuqZvWklm2WjV/LcZcyFE2nrlIQKBgQDcc+281FNBlRu70eaS\npL1p/zMObW7xdVwlR80oPTebsbYutOxv1D98ChCye9jxUpHCnO7W2DwDioIZi6CX\nyVYJs1d4Lu44qSA+lbISUxHpvtB4gbYSRuls8Ju5AfccVjaVWITMyG26v2OdKvxr\n1HhZqwU7jhEwAXpJJG9W/rZizQKBgQDFO1YJ9V2jIpBV8z5IN3gxxAaAa0AyEqd5\n5g6TpxmL79EuRpC46AxvelEe49et5FLg8eSVXlUhqNjGKr4mjEfc8HHHxTCeu6s4\nfZ+1H6UdwWZeNTB2CyipTh4yMqXXv788CnVTz4Q6MQiFe7hzbiw3tzvrzjrTeyrJ\n8M5QhE/8YwKBgGNJ/2BVzO2zx5rvLccMVZdA7nDoDtjHf+n2jcs6zynbf29H41l2\noeUu71hD+XCvPKEHZ3bySw1ZO8FfpsPWVV7nHFUv5fE1EyW87EfejCnX3DL6UNOo\nhoefUrOf0/k6Rzk6dg15lBpRCv+FlczHFDFmmmO5V7pkX/xDYbYv4FtdAoGBAL2t\nkdIj8bh4/hxawPQMvIAHyETqYCOHwx69PBmN40isCx0Y6geZypPPK4Kslfh7E6WX\nnEB2JyMm0crKwnIqCNaXOqVno5mUXFcIoXY8B7x1CXDicEel9aXVJb8a7Flv44bn\ne+xtLvoTu+E7makRNF8kzfC6NeK6mez5tEDE7nOHAoGBAMhi/yAuTuNINycdWr8b\nd8Nb+Tp/5l3N//A4jd0caWnP6fxe1/DU29Yrw+U4/I/s3dYtCSLQ3U+uOMZvALZt\n8aUq03dyshZoUDNG7CLxmYkbZ+vvbypWv+xsqOdEAeWMSmWXRnwKBEj4IowwyVaw\nkFL66r593Fvwen4bedU5RkQr\n-----END PRIVATE KEY-----
```

### Firebase Cloud Messaging
```env
FCM_SENDER_ID=1001664140460
FCM_SERVICE_ACCOUNT_EMAIL=firebase-adminsdk-fbsvc@mash-5b627.iam.gserviceaccount.com
FCM_PRIVATE_KEY_ID=BDOqECmDGGMgF0ChROxvLnu30Q_nSTFmy-GEsoibJZ5B9K2fhDhceUrO9Dp_zMgGtfUvpGCKRJAsv8lzl2MQv9k
FCM_PRIVATE_KEY=VysE-G8uCyUT9kCYvBPUNA_nYrvmk9T9BSTpWLXtyjI
```

### Email Configuration (SMTP Relay)
```env
SMTP_RELAY_ENABLED=true
SMTP_RELAY_URL=<YOUR_NGROK_HTTPS_URL>
SMTP_RELAY_ENDPOINT=/send-email
SMTP_RELAY_API_KEY=
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=MASH.Mushroom.Automation@gmail.com
EMAIL_PASSWORD=rtaeavlpvqaovgix
EMAIL_FROM=MASH Mushroom Automation <MASH.Mushroom.Automation@gmail.com>
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=MASH.Mushroom.Automation@gmail.com
```

### SMS (Twilio)
```env
TWILIO_ACCOUNT_SID=AC744605d60394ee6fdb7bb45369a3bb7d
TWILIO_AUTH_TOKEN=5ac370820906d4c666d30ed94f7ddbd0
TWILIO_PHONE_NUMBER=09272533969
```

---

## 🟢 OPTIONAL - Nice to Have

### Cache Settings
```env
CACHE_ENABLED=true
CACHE_TTL_DEFAULT=300
CACHE_TTL_PRODUCTS=600
CACHE_TTL_CATEGORIES=1800
CACHE_TTL_USERS=600
CACHE_TTL_ANALYTICS=1800
```

### Rate Limiting
```env
THROTTLE_TTL=60
THROTTLE_LIMIT=100
THROTTLE_LIMIT_SUPER_ADMIN=10000
THROTTLE_LIMIT_ADMIN=1000
THROTTLE_LIMIT_GROWER=200
THROTTLE_LIMIT_BUYER=150
THROTTLE_LIMIT_USER=100
THROTTLE_LIMIT_GUEST=20
THROTTLE_LIMIT_EXPENSIVE=10
THROTTLE_LIMIT_STANDARD=100
THROTTLE_LIMIT_CHEAP=1000
QUOTA_ENABLED=true
QUOTA_DAILY_DEFAULT=10000
QUOTA_MONTHLY_DEFAULT=300000
```

### Alert System
```env
ALERT_QUEUE_CONCURRENCY=10
ALERT_MAX_RETRIES=3
ALERT_COOLDOWN_MINUTES=15
ALERT_DEDUPLICATION_WINDOW_MINUTES=60
```

### Monitoring & Observability
```env
METRICS_ENABLED=true
METRICS_PATH=/metrics
OTEL_ENABLED=false
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTEL_SERVICE_NAME=mash-backend
OTEL_SERVICE_VERSION=1.0.0
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin123
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=MASH.Mushroom.Automation@gmail.com
SMTP_PASSWORD=rtaeavlpvqaovgix
SMTP_FROM=MASH.Mushroom.Automation@gmail.com
ALERT_EMAIL_ONCALL=MASH.Mushroom.Automation@gmail.com
ALERT_EMAIL_DEVOPS=MASH.Mushroom.Automation@gmail.com
ALERT_EMAIL_DATABASE_TEAM=MASH.Mushroom.Automation@gmail.com
ALERT_EMAIL_PERFORMANCE_TEAM=MASH.Mushroom.Automation@gmail.com
SLACK_WEBHOOK_URL=
```

### CORS Configuration (Updated)
```env
CORS_ORIGINS=https://mash-space.up.railway.app,http://localhost:4200,http://localhost:5173,http://localhost:3000
CORS_CREDENTIALS=true
CLERK_AFTER_SIGN_IN_URL=/dashboard
CLERK_AFTER_SIGN_UP_URL=/onboarding
```

### JWT Authentication
```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=1d
SESSION_DURATION=7d
REFRESH_TOKEN_DURATION=30d
MAX_SESSIONS_PER_USER=5
```

### Clerk SSO
```env
CLERK_ENABLED=true
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YW11c2VkLWxhZHliaXJkLTI2LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_RygR2hOh8zf6ZD17eiFQ1gFJdQxVmYtfSAGfv05VcO
CLERK_WEBHOOK_SECRET=whsec_JtOiAs0zFyPNFKPKL9QCyJJjK1H/timm
CLERK_JWT_KEY=clerk_jwt_disabled_for_testing
```

### AI/ML (OpenAI)
```env
OPENAI_API_KEY=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
```

### AWS S3
```env
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=mash-analytics-exports
```

### WebSocket Configuration
```env
WS_PORT=3000
WS_NAMESPACE=/ws
WS_CORS_ORIGIN=https://mash-space.up.railway.app,http://localhost:3000,http://localhost:4200,http://localhost:5173
WS_PING_TIMEOUT=60000
WS_PING_INTERVAL=25000
WS_MAX_CONNECTIONS=10000
WS_REDIS_ADAPTER_ENABLED=false
WS_COMPRESSION_ENABLED=true
WS_TRANSPORTS=websocket,polling
```

### MQTT (IoT)
```env
MQTT_ENABLED=false
MQTT_BROKER_URL=mqtt://localhost:1883
```

### Import/Export
```env
UPLOAD_DIR=./uploads/import-export
MAX_FILE_SIZE=52428800
MAX_CONCURRENT_JOBS=10
FILE_RETENTION_DAYS=30
```

### Elasticsearch
```env
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=
ELASTICSEARCH_MAX_RETRIES=3
ELASTICSEARCH_REQUEST_TIMEOUT=30000
ELASTICSEARCH_LOG_LEVEL=info
```

---

## 📋 How to Add Variables to Railway

### Method 1: Railway Dashboard (GUI)

1. Go to https://railway.app
2. Select your project
3. Click **web** service
4. Click **Variables** tab
5. Click **+ New Variable**
6. Paste name and value
7. Click **Add**
8. Repeat for all variables

### Method 2: Railway CLI (Bulk Import)

```bash
# Create a file: railway-vars.txt
# Format: KEY=VALUE (one per line)

# Import all variables
railway variables --set $(cat railway-vars.txt)
```

### Method 3: Use Service References (Recommended for Redis)

For Redis, use Railway's service reference syntax:
```env
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}
```

This automatically uses the Redis service's credentials.

---

## ✅ Verification After Adding Variables

### Test Health Endpoint
```bash
curl https://mash-space.up.railway.app/api/v1/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

### Check Logs
```bash
railway logs --service web --follow
```

**Look For**:
- ✅ `Redis connected successfully`
- ✅ `Database connected`
- ✅ `SMTP Relay provider enabled` (if using email)
- ❌ No `ECONNREFUSED` or missing variable errors

---

## 🚨 Common Mistakes to Avoid

### ❌ Don't Do This
```env
# Using old Redis URL
REDIS_URL=redis://default:ihXphGaXyKSAovZzLdozZFtvAyfiFSVr@caboose.proxy.rlwy.net:6379
REDIS_HOST=caboose.proxy.rlwy.net

# Using old backend URL
BACKEND_URL=https://mash-backend-api-production.up.railway.app

# Forgetting to update CORS
CORS_ORIGINS=https://old-url.up.railway.app
```

### ✅ Do This Instead
```env
# Use NEW internal Railway Redis with service references
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_HOST=${{Redis.REDISHOST}}
REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
# Actual: redis://default:lNicVMNJFUNLjGotxGqSkDPjsMAcpKYc@redis.railway.internal:6379

# Use new backend URL
BACKEND_URL=https://mash-space.up.railway.app

# Update CORS with new URL
CORS_ORIGINS=https://mash-space.up.railway.app,http://localhost:3000
```

---

## 📚 Related Documentation

- **Complete Migration Guide**: `RAILWAY_MIGRATION_GUIDE.md`
- **Quick Start**: `RAILWAY_MIGRATION_QUICKSTART.md`
- **SMTP Relay Setup**: `docs/NGROK_SMTP_SETUP_GUIDE.md`
- **Redis Configuration**: `REDIS_MIGRATION_CLI_GUIDE.md`

---

**Total Variables**: 100+  
**Critical Variables**: 15  
**Setup Time**: 30-45 minutes  
**Last Updated**: November 23, 2025
