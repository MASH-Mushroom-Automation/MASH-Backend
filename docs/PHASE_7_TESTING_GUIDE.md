# Phase 7 Testing & Validation Guide

**Purpose:** Comprehensive testing instructions for Phase 7 Monitoring & Analytics  
**Date:** November 13, 2025  
**Status:** Ready for Testing

---

## 🎯 Overview

This guide provides step-by-step instructions to test all Phase 7 features:
1. Checkout integration with OrdersService
2. Prometheus metrics collection
3. Analytics dashboard endpoints
4. Shipping and tax calculations

---

## ⚙️ Prerequisites

### 1. Start Development Server
```bash
npm run start:dev
```

Wait for the server to start. You should see:
```
[Nest] Application successfully started
[Nest] Listening on port 3000
```

### 2. Get JWT Token
You'll need two JWT tokens:
- **User Token**: For regular cart operations
- **Admin Token**: For analytics endpoints

```bash
# Login as regular user
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Save tokens
export USER_TOKEN="eyJhbGc..."
export ADMIN_TOKEN="eyJhbGc..."
```

### 3. Get Product ID
```bash
# Get available products
curl http://localhost:3000/api/v1/products | jq '.data[0].id'

# Save product ID
export PRODUCT_ID="clxxx..."
```

---

## 🧪 Test Suite

### Test 1: Add Item to Cart (Metrics: cart_items_added_total)

**Objective:** Verify cart_items_added_total metric increments

```bash
# 1. Check current metric value
curl http://localhost:3000/metrics | grep mash_cart_items_added_total

# 2. Add item to cart
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PRODUCT_ID\",
    \"quantity\": 2
  }"

# 3. Check metric again - should have incremented
curl http://localhost:3000/metrics | grep mash_cart_items_added_total
```

**Expected Result:**
- Metric counter increases by 1
- Labels show: `{product_id="...",user_type="authenticated"}`

**Success Criteria:** ✅ Metric increments correctly

---

### Test 2: Remove Item from Cart (Metrics: cart_items_removed_total)

**Objective:** Verify cart_items_removed_total metric increments

```bash
# 1. Get cart items
RESPONSE=$(curl -s http://localhost:3000/api/v1/cart \
  -H "Authorization: Bearer $USER_TOKEN")

ITEM_ID=$(echo $RESPONSE | jq -r '.items[0].id')

# 2. Check current metric
curl http://localhost:3000/metrics | grep mash_cart_items_removed_total

# 3. Remove item
curl -X DELETE http://localhost:3000/api/v1/cart/items/$ITEM_ID \
  -H "Authorization: Bearer $USER_TOKEN"

# 4. Check metric again
curl http://localhost:3000/metrics | grep mash_cart_items_removed_total
```

**Expected Result:**
- Metric counter increases by 1
- Labels show: `{product_id="...",user_type="authenticated"}`

**Success Criteria:** ✅ Metric increments correctly

---

### Test 3: Shipping Estimation (Metrics: shipping_calculations_total)

**Objective:** Verify shipping calculation metrics and estimation

```bash
# 1. Check current metric
curl http://localhost:3000/metrics | grep mash_shipping_calculations_total

# 2. Estimate shipping (NCR - Metro Manila)
curl -X POST http://localhost:3000/api/v1/cart/shipping/estimate \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address": {
      "region": "NCR",
      "province": "Metro Manila",
      "city": "Quezon City",
      "barangay": "Commonwealth",
      "postalCode": "1121",
      "addressLine1": "123 Main Street"
    }
  }'

# 3. Check metric again
curl http://localhost:3000/metrics | grep mash_shipping_calculations_total
```

**Expected Response:**
```json
{
  "selectedMethod": "STANDARD",
  "cost": 50.00,
  "estimatedDays": 5,
  "availableOptions": [
    {
      "method": "STANDARD",
      "cost": 50.00,
      "estimatedDays": 5,
      "description": "Standard Shipping (5-7 business days)"
    },
    {
      "method": "EXPRESS",
      "cost": 150.00,
      "estimatedDays": 2,
      "description": "Express Shipping (2-3 business days)"
    },
    {
      "method": "SAME_DAY",
      "cost": 300.00,
      "estimatedDays": 0,
      "description": "Same-Day Delivery (order before 12PM)"
    }
  ]
}
```

**Success Criteria:** 
- ✅ Returns shipping options
- ✅ NCR gets all 3 methods (including SAME_DAY)
- ✅ Metric increments with labels: `{method="STANDARD",region="NCR"}`

---

### Test 4: Province Shipping (No Same-Day)

**Objective:** Verify provinces don't get same-day delivery option

```bash
curl -X POST http://localhost:3000/api/v1/cart/shipping/estimate \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address": {
      "region": "CALABARZON",
      "province": "Laguna",
      "city": "Santa Rosa",
      "barangay": "Balibago",
      "postalCode": "4026",
      "addressLine1": "456 Provincial Road"
    }
  }'
```

**Expected Response:**
- Only STANDARD and EXPRESS options (no SAME_DAY)
- Higher costs due to regional multiplier

**Success Criteria:** ✅ SAME_DAY not available for provinces

---

### Test 5: Complete Checkout Flow (Multiple Metrics)

**Objective:** Test full checkout with all metrics

```bash
# 1. Add items to cart first
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PRODUCT_ID\",
    \"quantity\": 3
  }"

# 2. Check all metrics before checkout
echo "=== Before Checkout ==="
curl http://localhost:3000/metrics | grep -E "mash_cart_checkouts_total|mash_tax_collected|mash_shipping_revenue"

# 3. Complete checkout
curl -X POST http://localhost:3000/api/v1/cart/checkout \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "GCASH",
    "shippingAddress": {
      "region": "NCR",
      "province": "Metro Manila",
      "city": "Quezon City",
      "barangay": "Commonwealth",
      "postalCode": "1121",
      "addressLine1": "123 Main Street"
    },
    "billingAddress": {
      "region": "NCR",
      "province": "Metro Manila",
      "city": "Quezon City",
      "barangay": "Commonwealth",
      "postalCode": "1121",
      "addressLine1": "123 Main Street"
    },
    "shippingMethod": "STANDARD",
    "notes": "Please deliver during business hours"
  }'

# 4. Check metrics after checkout
echo "=== After Checkout ==="
curl http://localhost:3000/metrics | grep -E "mash_cart_checkouts_total|mash_tax_collected|mash_shipping_revenue"
```

**Metrics to Verify:**
- `mash_cart_checkouts_total{payment_method="GCASH"}` +1
- `mash_cart_checkout_value_php` updated with order value
- `mash_tax_collected_php_total{region="NCR"}` +[tax amount]
- `mash_shipping_revenue_php_total{method="STANDARD"}` +50.00

**Expected Response:**
```json
{
  "id": "order_123",
  "orderNumber": "MASH-2025-001234",
  "status": "PENDING",
  "totalAmount": 1234.56,
  "items": [...],
  "shippingAddress": {...},
  "paymentMethod": "GCASH"
}
```

**Success Criteria:** 
- ✅ Order created successfully
- ✅ All 4 metrics increment correctly
- ✅ Cart status changes to COMPLETED

---

### Test 6: Analytics Dashboard - Overall Stats

**Objective:** Verify admin analytics endpoint

```bash
# Get overall cart analytics
curl http://localhost:3000/api/v1/admin/cart/analytics \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

**Expected Response Structure:**
```json
{
  "totalActiveCarts": 125,
  "totalAbandonedCarts": 42,
  "totalCompletedCarts": 180,
  "averageCartValue": 1250.50,
  "totalCartItems": 450,
  "conversionRate": 51.87,
  "abandonmentRate": 12.10,
  "guestCarts": 85,
  "authenticatedCarts": 40,
  "dateRange": {
    "start": "2025-10-13T00:00:00.000Z",
    "end": "2025-11-13T23:59:59.999Z"
  }
}
```

**Success Criteria:** 
- ✅ Returns valid analytics data
- ✅ Conversion and abandonment rates are percentages
- ✅ Date range defaults to last 30 days

---

### Test 7: Analytics - Date Range Filtering

**Objective:** Test date filtering in analytics

```bash
# Get analytics for specific date range
curl "http://localhost:3000/api/v1/admin/cart/analytics?startDate=2025-11-01&endDate=2025-11-13" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

**Success Criteria:** 
- ✅ Returns data for specified date range
- ✅ dateRange in response matches query parameters

---

### Test 8: Shipping Revenue Analytics

**Objective:** Verify shipping revenue breakdown

```bash
curl http://localhost:3000/api/v1/admin/cart/shipping-revenue \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

**Expected Response:**
```json
{
  "totalShippingRevenue": 12500.00,
  "averageShippingCost": 125.00,
  "totalShipments": 100,
  "breakdown": [
    {
      "method": "STANDARD",
      "count": 60,
      "revenue": 3000.00
    },
    {
      "method": "EXPRESS",
      "count": 35,
      "revenue": 5250.00
    },
    {
      "method": "SAME_DAY",
      "count": 5,
      "revenue": 1500.00
    }
  ],
  "dateRange": {...}
}
```

**Success Criteria:** 
- ✅ Shows breakdown by shipping method
- ✅ Revenue totals match breakdown sum
- ✅ Average calculated correctly

---

### Test 9: Tax Collection Analytics

**Objective:** Verify tax collection reports

```bash
curl http://localhost:3000/api/v1/admin/cart/tax-collected \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

**Expected Response:**
```json
{
  "totalTaxCollected": 15000.00,
  "averageTaxPerCart": 150.00,
  "totalTaxableCarts": 100,
  "breakdown": {
    "ncr": {
      "count": 60,
      "taxCollected": 9000.00,
      "taxRate": 0.12
    },
    "province": {
      "count": 40,
      "taxCollected": 6000.00,
      "taxRate": 0.10
    }
  },
  "dateRange": {...}
}
```

**Success Criteria:** 
- ✅ Shows NCR (12% VAT) vs Province (10% VAT) breakdown
- ✅ Tax totals match breakdown sum
- ✅ Tax rates are correct (0.12 and 0.10)

---

### Test 10: Active Cart Metrics

**Objective:** Get real-time active cart data

```bash
curl http://localhost:3000/api/v1/admin/cart/active-carts \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

**Expected Response:**
```json
{
  "totalActiveCarts": 125,
  "guestCarts": 85,
  "authenticatedCarts": 40,
  "totalItems": 450,
  "totalValue": 156250.00,
  "averageCartValue": 1250.00,
  "averageItemsPerCart": 3.6,
  "cartsWithItems": 110,
  "emptyCarts": 15,
  "recentActivity": {
    "last5Minutes": 12,
    "last15Minutes": 28,
    "last1Hour": 65
  }
}
```

**Success Criteria:** 
- ✅ Real-time data (no caching)
- ✅ Activity tracking shows recent 5min/15min/1hr
- ✅ Empty carts counted separately

---

### Test 11: Guest Cart Metrics

**Objective:** Test metrics for guest users

```bash
# 1. Add item as guest (no JWT token)
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "Content-Type: application/json" \
  -H "x-session-id: guest_test_123" \
  -d "{
    \"productId\": \"$PRODUCT_ID\",
    \"quantity\": 1
  }"

# 2. Check metric has guest label
curl http://localhost:3000/metrics | grep 'mash_cart_items_added_total{.*user_type="guest"'
```

**Success Criteria:** 
- ✅ Guest cart works without authentication
- ✅ Metrics show `user_type="guest"` label

---

### Test 12: Security - Non-Admin Access

**Objective:** Verify analytics endpoints are admin-only

```bash
# Try to access analytics with regular user token (should fail)
curl http://localhost:3000/api/v1/admin/cart/analytics \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected Response:**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

**Success Criteria:** ✅ Regular users cannot access admin endpoints

---

### Test 13: Metrics Endpoint Availability

**Objective:** Verify Prometheus metrics are exposed

```bash
# 1. Check metrics endpoint is accessible
curl http://localhost:3000/metrics | head -20

# 2. Verify cart metrics are present
curl http://localhost:3000/metrics | grep -c mash_cart

# 3. Check all 9 cart metrics exist
curl http://localhost:3000/metrics | grep -E "mash_cart_items_added_total|mash_cart_items_removed_total|mash_cart_checkouts_total|mash_cart_checkout_value_php|mash_cart_abandonment_total|mash_cart_active_carts|mash_shipping_calculations_total|mash_tax_collected_php_total|mash_shipping_revenue_php_total"
```

**Success Criteria:** 
- ✅ /metrics endpoint returns Prometheus format
- ✅ All 9 cart metrics are defined
- ✅ Metrics include HELP and TYPE comments

---

## 📊 Validation Checklist

After running all tests, verify:

### Metrics Validation
- [ ] `mash_cart_items_added_total` increments on add item
- [ ] `mash_cart_items_removed_total` increments on remove item
- [ ] `mash_cart_checkouts_total` increments on checkout
- [ ] `mash_cart_checkout_value_php` tracks order values
- [ ] `mash_shipping_calculations_total` increments on shipping estimate
- [ ] `mash_tax_collected_php_total` tracks tax revenue
- [ ] `mash_shipping_revenue_php_total` tracks shipping revenue
- [ ] Metrics have correct labels (product_id, user_type, method, region)

### Analytics Dashboard Validation
- [ ] GET /admin/cart/analytics returns valid data
- [ ] Date range filtering works correctly
- [ ] GET /admin/cart/shipping-revenue shows method breakdown
- [ ] GET /admin/cart/tax-collected shows NCR vs Province breakdown
- [ ] GET /admin/cart/active-carts shows real-time metrics
- [ ] All endpoints require admin authentication

### Functional Validation
- [ ] Checkout creates actual orders (not placeholders)
- [ ] Shipping estimation works for NCR and provinces
- [ ] SAME_DAY only available in NCR
- [ ] Tax rates correct (NCR: 12%, Province: 10%)
- [ ] Guest carts track with user_type="guest" label

---

## 🐛 Troubleshooting

### Metrics Not Incrementing
```bash
# Check if PrometheusService is initialized
curl http://localhost:3000/metrics | grep -i help

# Restart server
npm run start:dev
```

### 403 Forbidden on Analytics
```bash
# Verify user has ADMIN or SUPER_ADMIN role
# Check JWT token is valid
# Ensure RolesGuard is not disabled
```

### Checkout Returns Error
```bash
# Check OrdersService is injected
# Verify cart has items
# Ensure payment method is valid enum
```

### Server Not Starting
```bash
# Clean build
npm run build

# Check for TypeScript errors
npx tsc --noEmit

# Check logs for errors
```

---

## 📝 Test Results Template

```markdown
## Phase 7 Test Results

**Date:** [Date]
**Tester:** [Name]

### Metrics Tests
- Test 1 (Add Item): ✅ PASS / ❌ FAIL
- Test 2 (Remove Item): ✅ PASS / ❌ FAIL
- Test 3 (Shipping): ✅ PASS / ❌ FAIL
- Test 5 (Checkout): ✅ PASS / ❌ FAIL
- Test 11 (Guest): ✅ PASS / ❌ FAIL
- Test 13 (Metrics Endpoint): ✅ PASS / ❌ FAIL

### Analytics Tests
- Test 6 (Overall Analytics): ✅ PASS / ❌ FAIL
- Test 7 (Date Filtering): ✅ PASS / ❌ FAIL
- Test 8 (Shipping Revenue): ✅ PASS / ❌ FAIL
- Test 9 (Tax Collection): ✅ PASS / ❌ FAIL
- Test 10 (Active Carts): ✅ PASS / ❌ FAIL
- Test 12 (Security): ✅ PASS / ❌ FAIL

### Overall Status
**Phase 7: ✅ READY FOR PRODUCTION / ⚠️ NEEDS FIXES**

**Issues Found:**
1. [Issue description]
2. [Issue description]

**Notes:**
[Additional observations]
```

---

## 🎉 Success Criteria

Phase 7 is **COMPLETE** when:
- ✅ All 13 tests pass
- ✅ All 9 metrics increment correctly
- ✅ All 4 analytics endpoints return valid data
- ✅ Checkout creates actual orders
- ✅ Security (admin-only) works correctly
- ✅ No TypeScript/build errors
- ✅ Server starts without errors

---

**Ready to proceed to Phase 8: Testing Suite**
