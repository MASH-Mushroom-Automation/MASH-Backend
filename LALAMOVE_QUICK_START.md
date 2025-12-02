# Lalamove Quick Start Guide

Get your Lalamove integration running in 5 minutes!

---

## 🚀 Prerequisites

Before you begin, ensure you have:

- [x] Node.js 18+ installed
- [x] PostgreSQL database running (or Neon connection)
- [x] Redis instance (Upstash or local) **with available quota**
- [x] Lalamove sandbox credentials
- [x] Postman installed (for API testing)

---

## 📋 Step 1: Environment Setup

### 1.1 Update Environment Variables

Open your `.env` file and add/verify these variables:

```bash
# Lalamove Configuration
LALAMOVE_API_KEY=pk_test_8611e4fa8a2f51f6664d26aded0e5d2b
LALAMOVE_API_SECRET=sk_test_your_secret_key_here
LALAMOVE_HOST=https://rest.sandbox.lalamove.com
LALAMOVE_MARKET=PH
LALAMOVE_WEBHOOK_PATH=/api/v1/lalamove/webhook

# Database (already configured)
DATABASE_URL=postgresql://...

# Redis (check quota!)
REDIS_URL=rediss://...
```

### 1.2 Verify Database Connection

```bash
npx prisma db push
npx prisma generate
```

**Expected Output**:
```
✔ Generated Prisma Client (v6.18.0)
```

---

## 🔧 Step 2: Resolve Redis Quota Issue

### Option A: Upgrade Upstash Plan (Recommended for Production)
1. Go to https://console.upstash.com
2. Select your Redis database
3. Click "Upgrade" → Choose paid plan
4. Quota will reset immediately

### Option B: Use Local Redis (Recommended for Development)
```bash
# Install Redis locally
# Windows: https://github.com/microsoftarchive/redis/releases
# Download Redis-x64-3.0.504.msi

# Update .env
REDIS_URL=redis://localhost:6379
```

### Option C: Create New Upstash Instance
1. Go to https://console.upstash.com
2. Create new Redis database
3. Copy new connection URL
4. Update `REDIS_URL` in `.env`

### Option D: Temporarily Disable Redis (Testing Only)
**⚠️ Warning**: Notifications won't be queued

Edit `src/app.module.ts`:
```typescript
// Comment out BullModule.forRoot
/*
BullModule.forRoot({
  redis: process.env.REDIS_URL,
}),
*/
```

---

## 🏃 Step 3: Start the Server

### 3.1 Install Dependencies (if needed)
```bash
npm install --legacy-peer-deps
```

### 3.2 Build and Start
```bash
npm run build
npm run start:dev
```

### 3.3 Verify Server is Running

**Expected Output**:
```
[Nest] 12345  - 11/18/2025, 2:30:00 PM     LOG [NestApplication] Nest application successfully started
[Nest] 12345  - 11/18/2025, 2:30:00 PM     LOG [Bootstrap] 🚀 Server running on http://localhost:3000
[Nest] 12345  - 11/18/2025, 2:30:00 PM     LOG [Bootstrap] 📚 Swagger docs available at http://localhost:3000/api
```

**Check Health Endpoint**:
```bash
curl http://localhost:3000/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "info": { "database": { "status": "up" } }
}
```

---

## 📖 Step 4: Explore Swagger Documentation

1. Open browser: http://localhost:3000/api
2. Find the **Lalamove** section
3. Review 10 available endpoints:
   - `GET /api/v1/lalamove/city-info`
   - `POST /api/v1/lalamove/quotations`
   - `GET /api/v1/lalamove/quotations/{id}`
   - `POST /api/v1/lalamove/orders`
   - `GET /api/v1/lalamove/orders/{id}`
   - `GET /api/v1/lalamove/orders/{orderId}/drivers/{driverId}`
   - `POST /api/v1/lalamove/orders/{id}/priority-fee`
   - `DELETE /api/v1/lalamove/orders/{id}`
   - `POST /api/v1/lalamove/webhook`
   - `POST /api/v1/lalamove/webhook/setup`

---

## 🔐 Step 5: Get Authentication Token

### 5.1 Login or Register

**Option A: Use Existing Account**
```bash
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json

{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Option B: Register New Account**
```bash
POST http://localhost:3000/api/v1/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Test123!",
  "name": "Test User"
}
```

### 5.2 Copy Access Token

**Response**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

**Save the `accessToken`** - you'll need it for all Lalamove endpoints!

---

## 🧪 Step 6: Test with Postman

### 6.1 Import Collection

1. Open Postman
2. Click **Import** button
3. Select **File** → Browse to `postman/MASH-Lalamove-PH.postman_collection.json`
4. Click **Import**

### 6.2 Import Environment

1. Click **Environments** in sidebar
2. Click **Import** → Browse to `postman/PH.postman_environment.json`
3. Click **Import**
4. Select **PH** environment from dropdown

### 6.3 Configure Environment Variables

Click the **eye icon** → Edit **PH** environment:

```
baseUrl: http://localhost:3000
api_key: pk_test_8611e4fa8a2f51f6664d26aded0e5d2b
api_secret: sk_test_your_secret_key_here
token: <paste-your-jwt-token-here>
```

### 6.4 Test Endpoints

**Test 1: Get City Info** (No auth required)
```
GET {{baseUrl}}/api/v1/lalamove/city-info
```
**Expected**: 200 OK with Manila city data

**Test 2: Create Immediate Quotation**
```
POST {{baseUrl}}/api/v1/lalamove/quotations
Authorization: Bearer {{token}}
Body: See collection → "Create Immediate Quotation"
```
**Expected**: 201 Created with quotationId

**Test 3: Get Quotation**
```
GET {{baseUrl}}/api/v1/lalamove/quotations/{{quotationId}}
Authorization: Bearer {{token}}
```
**Expected**: 200 OK with price breakdown

**Test 4: Create Order**
```
POST {{baseUrl}}/api/v1/lalamove/orders
Authorization: Bearer {{token}}
Body: {
  "quotationId": "{{quotationId}}",
  "sender": { ... },
  "recipients": [ ... ]
}
```
**Expected**: 201 Created with orderId and shareLink

**Test 5: Get Order**
```
GET {{baseUrl}}/api/v1/lalamove/orders/{{orderId}}
Authorization: Bearer {{token}}
```
**Expected**: 200 OK with order status

---

## 🔔 Step 7: Test Webhook Integration

### 7.1 Setup Webhook URL (Admin Only)

**Get Admin Token** (if you don't have one):
```sql
-- Update user role in database
UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'your-email@example.com';
```

**Setup Webhook**:
```bash
POST http://localhost:3000/api/v1/lalamove/webhook/setup
Authorization: Bearer {{admin-token}}
Content-Type: application/json

{
  "webhookUrl": "https://your-public-url.com/api/v1/lalamove/webhook"
}
```

### 7.2 Test Webhook Locally with ngrok

1. **Install ngrok**: https://ngrok.com/download

2. **Start ngrok tunnel**:
```bash
ngrok http 3000
```

3. **Copy HTTPS URL** (e.g., `https://abc123.ngrok.io`)

4. **Update webhook URL**:
```bash
POST http://localhost:3000/api/v1/lalamove/webhook/setup
Authorization: Bearer {{admin-token}}

{
  "webhookUrl": "https://abc123.ngrok.io/api/v1/lalamove/webhook"
}
```

### 7.3 Simulate Webhook Event

Use Postman collection → "Webhook Events" folder:

```bash
POST http://localhost:3000/api/v1/lalamove/webhook
x-lalamove-signature: <generated-signature>
x-lalamove-timestamp: <current-timestamp>
Content-Type: application/json

{
  "event": "DRIVER_ASSIGNED",
  "orderId": "{{orderId}}",
  "driver": { ... }
}
```

**Check Database**:
```sql
SELECT * FROM lalamove_orders WHERE "orderId" = 'your-order-id';
```

**Check Notifications**:
- Email sent to user
- SMS sent to user phone
- Push notification queued

---

## 📊 Step 8: Monitor & Debug

### 8.1 Check Application Logs

```bash
# Development logs
npm run start:dev
```

**Look for**:
- `[LalamoveService] Creating quotation...`
- `[WebhookService] Processing webhook event: DRIVER_ASSIGNED`
- `[CommunicationHubService] Sending multi-channel notification`

### 8.2 Check Database

```bash
npx prisma studio
```

**Tables to inspect**:
- `lalamove_quotations` - All quotations
- `lalamove_orders` - All orders
- `audit_logs` - Webhook events

### 8.3 Check Redis Queues (if enabled)

```bash
# Install Bull Board (optional)
npm install @bull-board/express @bull-board/api

# Access at http://localhost:3000/admin/queues
```

---

## 🎯 Common Use Cases

### Use Case 1: Order Same-Day Delivery

```bash
# Step 1: Create quotation (immediate)
POST /api/v1/lalamove/quotations
{
  "serviceType": "MOTORCYCLE",
  "stops": [
    {
      "location": { "lat": "14.5995", "lng": "120.9842" },
      "addresses": { "en_PH": { "displayString": "Manila" } }
    },
    {
      "location": { "lat": "14.6042", "lng": "121.0224" },
      "addresses": { "en_PH": { "displayString": "Makati" } }
    }
  ]
}

# Step 2: Create order
POST /api/v1/lalamove/orders
{
  "quotationId": "<from-step-1>",
  "sender": { "name": "John", "phone": "+639123456789" },
  "recipients": [{ "name": "Jane", "phone": "+639987654321" }]
}

# Step 3: Track order
GET /api/v1/lalamove/orders/{{orderId}}
```

### Use Case 2: Schedule Future Delivery

```bash
# Create quotation with scheduleAt (2+ hours ahead)
POST /api/v1/lalamove/quotations
{
  "serviceType": "SEDAN",
  "scheduleAt": "2025-11-19T10:00:00+08:00",
  "stops": [ ... ]
}
```

### Use Case 3: Add Priority Fee

```bash
# After creating order, add priority fee
POST /api/v1/lalamove/orders/{{orderId}}/priority-fee
{
  "priorityFee": 50
}
```

### Use Case 4: Cancel Order

```bash
# Cancel within 5-minute cancellation window
DELETE /api/v1/lalamove/orders/{{orderId}}
```

---

## ⚠️ Troubleshooting

### Issue 1: Server Won't Start (Redis Quota)

**Error**: `ReplyError: ERR max requests limit exceeded`

**Solution**: See [Step 2: Resolve Redis Quota Issue](#-step-2-resolve-redis-quota-issue)

### Issue 2: Unauthorized (401)

**Error**: `"message": "Unauthorized"`

**Solution**: 
1. Get fresh JWT token from `/api/v1/auth/login`
2. Add `Authorization: Bearer <token>` header
3. Check token hasn't expired (24h default)

### Issue 3: Quotation Expired

**Error**: `"message": "Quotation has expired"`

**Solution**: Quotations expire after 5 minutes. Create new quotation.

### Issue 4: Invalid Signature (Webhook)

**Error**: `"message": "Invalid webhook signature"`

**Solution**:
1. Check `LALAMOVE_API_SECRET` in `.env`
2. Verify timestamp is within 5 minutes
3. Use correct HMAC SHA-256 algorithm

### Issue 5: Database Not Synced

**Error**: `Unknown field: lalamove_quotations`

**Solution**:
```bash
npx prisma generate
npx prisma db push
```

---

## 📚 Additional Resources

### API Documentation
- **Swagger UI**: http://localhost:3000/api
- **Lalamove Docs**: https://developers.lalamove.com/
- **Postman Collection**: `postman/MASH-Lalamove-PH.postman_collection.json`

### Project Documentation
- **Integration Plan**: `LALAMOVE_INTEGRATION_PLAN.md`
- **Implementation Status**: `LALAMOVE_IMPLEMENTATION_STATUS.md`
- **Database Schema**: `prisma/schema.prisma`

### Source Code
- **Module**: `src/modules/lalamove/`
- **Services**: `src/modules/lalamove/services/`
- **DTOs**: `src/modules/lalamove/dto/`
- **Interfaces**: `src/modules/lalamove/interfaces/`

---

## 🎉 Success Checklist

- [ ] Server starts without errors
- [ ] Swagger docs accessible at `/api`
- [ ] Login returns JWT token
- [ ] GET /city-info returns Manila data
- [ ] POST /quotations creates quotation
- [ ] POST /orders creates order
- [ ] Webhook events update database
- [ ] Notifications sent via email/SMS/push
- [ ] Database persists data correctly
- [ ] All Postman tests pass

---

## 💬 Need Help?

**GitHub Issues**: https://github.com/MASH-Mushroom-Automation/MASH-Backend/issues  
**Developer**: Kenneth  
**Sprint**: Issue #131

---

**🚀 Ready to go? Start with Step 1!**
