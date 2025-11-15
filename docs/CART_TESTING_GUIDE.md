# 🧪 Cart System Testing Guide

**Last Updated:** November 15, 2025  
**Status:** Ready for Production Testing  
**Server:** http://localhost:3000

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Test Environment Setup](#test-environment-setup)
3. [Test Scenarios](#test-scenarios)
4. [API Endpoint Testing](#api-endpoint-testing)
5. [Performance Testing](#performance-testing)
6. [Security Testing](#security-testing)
7. [Edge Cases & Error Handling](#edge-cases--error-handling)
8. [Automated Testing](#automated-testing)

---

## Prerequisites

### Required Tools
- ✅ Postman or cURL
- ✅ Browser for Swagger UI
- ✅ JWT token for authenticated endpoints
- ✅ Guest session ID for guest cart testing

### Database Seeding
Before testing, ensure the database has products:
```bash
# Run database seed
npx prisma db seed

# Or create test products via API
# POST /api/v1/products
```

### Environment Check
```bash
# Verify server is running
curl http://localhost:3000/api/v1/health

# Check database connection
curl http://localhost:3000/metrics | grep "prisma"

# Verify Redis connection
curl http://localhost:3000/api/v1/cache/health
```

---

## Test Environment Setup

### 1. Get Test Product IDs
```bash
# List available products
curl http://localhost:3000/api/v1/products?page=1&limit=10
```

### 2. Generate Session ID for Guest Testing
```bash
# Use a unique session ID (UUID format recommended)
export GUEST_SESSION="guest-test-$(uuidgen)"
echo "Guest Session ID: $GUEST_SESSION"
```

### 3. Get JWT Token for Authenticated Testing
```bash
# Login to get JWT token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'

# Extract and export token
export JWT_TOKEN="your-jwt-token-here"
```

---

## Test Scenarios

### Scenario 1: Guest Cart Flow

#### Step 1: Create Empty Cart
```bash
curl -X GET http://localhost:3000/api/v1/cart \
  -H "X-Session-Id: $GUEST_SESSION" \
  -H "Content-Type: application/json" \
  -v
```

**Expected Response:**
```json
{
  "id": "clxxx123",
  "userId": null,
  "sessionId": "guest-test-xxx",
  "status": "ACTIVE",
  "itemCount": 0,
  "subtotal": 0,
  "tax": 0,
  "shipping": 0,
  "discount": 0,
  "total": 0,
  "items": []
}
```

#### Step 2: Add Product to Cart
```bash
# Replace PRODUCT_ID with actual product ID
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "X-Session-Id: $GUEST_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PRODUCT_ID_HERE",
    "quantity": 2,
    "customization": {
      "giftMessage": "Happy Birthday!",
      "giftWrap": true
    }
  }' \
  -v
```

**Expected Response:**
- HTTP 201 Created
- Cart with added item
- Price locked at current product price
- Product snapshot stored
- Totals calculated

#### Step 3: Update Item Quantity
```bash
# Replace ITEM_ID with cart item ID from previous response
curl -X PUT http://localhost:3000/api/v1/cart/items/ITEM_ID_HERE \
  -H "X-Session-Id: $GUEST_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 5
  }' \
  -v
```

**Expected Response:**
- HTTP 200 OK
- Updated cart with new quantity
- Recalculated totals

#### Step 4: Get Cart Summary
```bash
curl -X GET http://localhost:3000/api/v1/cart/summary \
  -H "X-Session-Id: $GUEST_SESSION" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "itemCount": 1,
  "total": 149.95,
  "hasUnavailableItems": false
}
```

#### Step 5: Validate Cart
```bash
curl -X POST http://localhost:3000/api/v1/cart/validate \
  -H "X-Session-Id: $GUEST_SESSION" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "valid": true,
  "items": [
    {
      "itemId": "clitem123",
      "productId": "clprod123",
      "isAvailable": true,
      "currentStock": 98,
      "requestedQuantity": 5,
      "priceChanged": false
    }
  ]
}
```

#### Step 6: Estimate Shipping
```bash
curl -X POST http://localhost:3000/api/v1/cart/shipping/estimate \
  -H "X-Session-Id: $GUEST_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "address": {
      "region": "NCR",
      "province": "Metro Manila",
      "city": "Quezon City",
      "barangay": "Commonwealth",
      "addressLine1": "123 Commonwealth Avenue",
      "addressLine2": "Unit 404",
      "postalCode": "1121"
    },
    "method": "STANDARD"
  }'
```

**Expected Response:**
```json
{
  "selectedMethod": "STANDARD",
  "cost": 150.00,
  "estimatedDays": 5,
  "availableOptions": [
    {
      "method": "STANDARD",
      "cost": 150.00,
      "estimatedDays": 5,
      "description": "Standard delivery (5-7 business days)"
    },
    {
      "method": "EXPRESS",
      "cost": 300.00,
      "estimatedDays": 2,
      "description": "Express delivery (2-3 business days)"
    }
  ]
}
```

---

### Scenario 2: Authenticated User Cart Flow

#### Step 1: Login and Get Cart
```bash
# Use JWT token from login
curl -X GET http://localhost:3000/api/v1/cart \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### Step 2: Add Item as Authenticated User
```bash
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PRODUCT_ID_HERE",
    "quantity": 3
  }'
```

#### Step 3: Checkout
```bash
curl -X POST http://localhost:3000/api/v1/cart/checkout \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "GCASH",
    "shippingAddress": {
      "region": "NCR",
      "province": "Metro Manila",
      "city": "Quezon City",
      "barangay": "Commonwealth",
      "addressLine1": "123 Commonwealth Avenue",
      "postalCode": "1121"
    },
    "billingAddress": {
      "region": "NCR",
      "province": "Metro Manila",
      "city": "Quezon City",
      "barangay": "Commonwealth",
      "addressLine1": "123 Commonwealth Avenue",
      "postalCode": "1121"
    },
    "shippingMethod": "STANDARD",
    "notes": "Please call before delivery"
  }'
```

**Expected Response:**
- HTTP 201 Created
- Order created with order number
- Cart marked as COMPLETED
- Inventory deducted
- Payment record created

---

### Scenario 3: Guest-to-User Cart Migration

#### Step 1: Create Guest Cart with Items
```bash
# Add items to guest cart
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "X-Session-Id: guest-migration-test-123" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PRODUCT_ID_1",
    "quantity": 2
  }'

curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "X-Session-Id: guest-migration-test-123" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PRODUCT_ID_2",
    "quantity": 1
  }'
```

#### Step 2: Login (Frontend would do this)
```bash
# User logs in and gets JWT token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

#### Step 3: Merge Guest Cart
```bash
# Merge guest cart into user cart
curl -X POST http://localhost:3000/api/v1/cart/merge \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "X-Session-Id: guest-migration-test-123" \
  -H "Content-Type: application/json"
```

**Expected Response:**
- Guest cart items merged into user cart
- Duplicate items have quantities combined
- Guest cart marked as MERGED
- User cart contains all items from both carts

---

## API Endpoint Testing

### Test All Endpoints with Swagger UI

1. Open http://localhost:3000/api/docs
2. Navigate to **Cart** section
3. Test each endpoint in order:

| Endpoint | Method | Auth Required | Test Status |
|----------|--------|---------------|-------------|
| `/api/v1/cart` | GET | No | ⬜ Not Tested |
| `/api/v1/cart/summary` | GET | No | ⬜ Not Tested |
| `/api/v1/cart/items` | POST | No | ⬜ Not Tested |
| `/api/v1/cart/items/:itemId` | PUT | No | ⬜ Not Tested |
| `/api/v1/cart/items/:itemId` | DELETE | No | ⬜ Not Tested |
| `/api/v1/cart` | DELETE | No | ⬜ Not Tested |
| `/api/v1/cart/validate` | POST | No | ⬜ Not Tested |
| `/api/v1/cart/merge` | POST | Yes (JWT) | ⬜ Not Tested |
| `/api/v1/cart/shipping/estimate` | POST | No | ⬜ Not Tested |
| `/api/v1/cart/checkout` | POST | Yes (JWT) | ⬜ Not Tested |

**Testing Checklist:**
- [ ] All endpoints return correct HTTP status codes
- [ ] Response schemas match Swagger documentation
- [ ] Error responses are user-friendly
- [ ] Guest cart works without authentication
- [ ] User cart requires JWT token
- [ ] Cart merge works correctly
- [ ] Inventory validation prevents overselling
- [ ] Price locking works on item add
- [ ] Tax calculation is accurate (12% NCR, 10% Province)
- [ ] Shipping calculation is reasonable
- [ ] Cart totals are calculated correctly
- [ ] Cache hit rate > 85%

---

## Performance Testing

### Load Testing with k6

Create `cart-load-test.js`:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],  // 95% of requests under 300ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

export default function () {
  // Generate unique session ID per VU
  const sessionId = `load-test-${__VU}-${Date.now()}`;
  
  // Get/Create cart
  let res = http.get(`${BASE_URL}/cart`, {
    headers: { 'X-Session-Id': sessionId },
  });
  check(res, { 'get cart status 200': (r) => r.status === 200 });
  
  sleep(1);
  
  // Add item to cart
  res = http.post(`${BASE_URL}/cart/items`, JSON.stringify({
    productId: 'test-product-id',
    quantity: 2,
  }), {
    headers: {
      'X-Session-Id': sessionId,
      'Content-Type': 'application/json',
    },
  });
  check(res, { 'add item status 201': (r) => r.status === 201 });
  
  sleep(2);
  
  // Get cart summary
  res = http.get(`${BASE_URL}/cart/summary`, {
    headers: { 'X-Session-Id': sessionId },
  });
  check(res, { 'get summary status 200': (r) => r.status === 200 });
}
```

Run load test:
```bash
k6 run cart-load-test.js
```

**Performance Targets:**
- ✅ P95 latency < 300ms
- ✅ P99 latency < 500ms
- ✅ Error rate < 1%
- ✅ Throughput > 500 req/s
- ✅ Cache hit rate > 85%

---

## Security Testing

### 1. Authentication Tests

#### Test JWT Protection
```bash
# Should fail without JWT
curl -X POST http://localhost:3000/api/v1/cart/checkout \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod": "GCASH"}' \
  -v

# Expected: HTTP 401 Unauthorized
```

#### Test Cart Ownership
```bash
# User A cannot access User B's cart
# Get User A's cart
curl -X GET http://localhost:3000/api/v1/cart \
  -H "Authorization: Bearer $USER_A_TOKEN"

# Try to access with User B's token
curl -X GET http://localhost:3000/api/v1/cart \
  -H "Authorization: Bearer $USER_B_TOKEN"

# Expected: Different carts
```

### 2. Input Validation Tests

#### Test Invalid Product ID
```bash
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "X-Session-Id: security-test" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "invalid-id",
    "quantity": 1
  }'

# Expected: HTTP 404 Product not found
```

#### Test Negative Quantity
```bash
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "X-Session-Id: security-test" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "valid-product-id",
    "quantity": -5
  }'

# Expected: HTTP 400 Validation error
```

#### Test Excessive Quantity
```bash
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "X-Session-Id: security-test" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "valid-product-id",
    "quantity": 9999999
  }'

# Expected: HTTP 400 Quantity exceeds maximum
```

### 3. SQL Injection Tests
```bash
# Test with malicious input
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "X-Session-Id: security-test" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "123; DROP TABLE carts; --",
    "quantity": 1
  }'

# Expected: HTTP 404 or 400 (safe handling)
```

### 4. Rate Limiting Tests
```bash
# Send 100 requests rapidly
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/v1/cart/items \
    -H "X-Session-Id: rate-limit-test" \
    -H "Content-Type: application/json" \
    -d '{"productId":"test","quantity":1}'
done

# Expected: Some requests return HTTP 429 Too Many Requests
```

---

## Edge Cases & Error Handling

### 1. Out of Stock Scenario
```bash
# Add more quantity than available stock
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "X-Session-Id: edge-case-test" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "low-stock-product",
    "quantity": 1000
  }'

# Expected: HTTP 409 Insufficient stock error
```

### 2. Inactive Product
```bash
# Try to add inactive product
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "X-Session-Id: edge-case-test" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "inactive-product-id",
    "quantity": 1
  }'

# Expected: HTTP 400 Product is not available
```

### 3. Price Change Detection
```bash
# 1. Add item to cart (price locked)
# 2. Admin updates product price
# 3. Validate cart to detect price change

curl -X POST http://localhost:3000/api/v1/cart/validate \
  -H "X-Session-Id: price-change-test"

# Expected: priceChanged: true in response
```

### 4. Concurrent Cart Updates
```bash
# Simulate race condition with parallel requests
# Add same product twice simultaneously

curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "X-Session-Id: concurrent-test" \
  -H "Content-Type: application/json" \
  -d '{"productId":"test","quantity":5}' &

curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "X-Session-Id: concurrent-test" \
  -H "Content-Type: application/json" \
  -d '{"productId":"test","quantity":5}' &

wait

# Expected: Quantities merged correctly (10 total)
```

### 5. Cart Expiry
```bash
# Create cart and wait > 30 days (or modify database for testing)
# Verify cart is marked as EXPIRED by scheduler

# Check scheduled task logs for expiry detection
```

---

## Automated Testing

### Unit Tests
```bash
# Run unit tests
npm run test:unit

# Run with coverage
npm run test:cov

# Target: 80%+ code coverage
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Test database interactions
npm run test:e2e
```

### Postman Collection Testing
```bash
# Import Postman collection
# Run automated tests
newman run postman/Cart-API.postman_collection.json \
  -e postman/MASH-backend.postman_environment.json \
  --reporters cli,json \
  --reporter-json-export results.json
```

---

## Test Results Template

### Session: [Date]
**Tester:** [Name]  
**Environment:** [Development/Staging/Production]  
**Duration:** [Time]

| Test Category | Tests Run | Passed | Failed | Notes |
|---------------|-----------|--------|--------|-------|
| Guest Cart Flow | 10 | 10 | 0 | All passed |
| User Cart Flow | 8 | 8 | 0 | All passed |
| Cart Merge | 5 | 5 | 0 | All passed |
| Validation | 12 | 11 | 1 | See notes |
| Security | 15 | 15 | 0 | All passed |
| Performance | 6 | 6 | 0 | P95 < 200ms |
| Edge Cases | 20 | 19 | 1 | See notes |

**Issues Found:**
1. [Issue description]
2. [Issue description]

**Performance Metrics:**
- Average response time: XXXms
- P95 response time: XXXms
- P99 response time: XXXms
- Cache hit rate: XX%
- Error rate: X.XX%

**Recommendations:**
- [Recommendation 1]
- [Recommendation 2]

---

## Troubleshooting

### Cart Not Creating
- Check database connection
- Verify Prisma schema is up-to-date
- Check migration status: `npx prisma migrate status`

### Redis Cache Issues
- Verify Redis connection: `redis-cli ping`
- Check cache health: `curl http://localhost:3000/api/v1/cache/health`
- Clear cache if needed: `curl -X POST http://localhost:3000/api/v1/cache/reset`

### Session Not Persisting
- Check cookie configuration in CORS settings
- Verify `X-Session-Id` header is being sent
- Check Redis session storage

### Checkout Fails
- Verify user is authenticated (JWT token)
- Check inventory availability
- Validate address format
- Check payment method is supported

---

## Next Steps

1. ✅ Complete all test scenarios above
2. ✅ Document any bugs or issues found
3. ✅ Run performance tests and record metrics
4. ✅ Execute security tests
5. ✅ Create Postman collection for regression testing
6. ✅ Set up CI/CD pipeline tests
7. ✅ Schedule load testing sessions
8. ✅ Monitor production metrics after deployment

---

**Last Test Run:** [Date]  
**Test Status:** ⬜ Not Started | 🟡 In Progress | ✅ Completed  
**Production Ready:** ⬜ No | ✅ Yes
