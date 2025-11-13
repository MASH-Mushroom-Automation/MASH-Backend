# Phase 8: Testing Suite - Implementation Plan

**Start Date:** November 14, 2025  
**Duration:** 3-5 days  
**Objective:** Achieve 80%+ test coverage across the cart system  
**Status:** 🚀 IN PROGRESS

---

## 🎯 Overview

Phase 8 focuses on comprehensive testing to ensure the shopping cart system is production-ready with high reliability, performance, and maintainability.

### Testing Goals
- **Unit Test Coverage:** 80%+ for all services
- **Integration Test Coverage:** 100% of API endpoints
- **E2E Test Coverage:** All critical user flows
- **Performance:** <100ms p95 response time under load
- **Reliability:** 99.9% success rate for all operations

---

## 📋 Test Suite Structure

```
test/
├── unit/
│   ├── cart.service.spec.ts          # CartService tests (15+ cases)
│   ├── shipping.service.spec.ts      # ShippingService tests (10+ cases)
│   ├── cart-scheduler.service.spec.ts # Scheduler tests (8+ cases)
│   ├── cart-analytics.controller.spec.ts # Analytics tests (6+ cases)
│   └── cart-cache.service.spec.ts    # Cache service tests
├── integration/
│   ├── cart-api.spec.ts               # REST API tests
│   ├── cart-database.spec.ts          # DB operations
│   ├── cart-cache.spec.ts             # Cache integration
│   └── cart-metrics.spec.ts           # Prometheus metrics
├── e2e/
│   ├── cart-flow.e2e-spec.ts         # Complete cart flows
│   ├── guest-cart-merge.e2e-spec.ts  # Guest → User merge
│   ├── checkout.e2e-spec.ts          # Checkout process
│   └── order-creation.e2e-spec.ts    # Order from cart
└── load/
    ├── cart-load-test.js              # k6 load test script
    └── results/                       # Load test results
```

---

## 📊 Task Breakdown

### **Task 1: Unit Tests** (2-3 days)

#### 1.1 CartService Tests (15+ test cases)
**File:** `src/modules/cart/cart.service.spec.ts`

**Test Cases:**
- ✅ `should be defined`
- ✅ `getOrCreateCart - should create new cart for user`
- ✅ `getOrCreateCart - should return existing cart`
- ✅ `getOrCreateCart - should create cart for guest session`
- ✅ `addItem - should add item to cart successfully`
- ✅ `addItem - should validate stock availability`
- ✅ `addItem - should prevent adding out-of-stock items`
- ✅ `addItem - should respect maxCartQty limit`
- ✅ `addItem - should lock price when adding`
- ✅ `addItem - should record Prometheus metrics`
- ✅ `updateItem - should update quantity successfully`
- ✅ `updateItem - should validate quantity limits`
- ✅ `removeItem - should remove item from cart`
- ✅ `removeItem - should record metrics`
- ✅ `clearCart - should remove all items`
- ✅ `calculateTotals - should calculate subtotal correctly`
- ✅ `calculateTotals - should calculate tax (NCR 12%)`
- ✅ `calculateTotals - should calculate tax (Province 10%)`
- ✅ `calculateTotals - should include shipping costs`
- ✅ `validateCart - should detect price changes`
- ✅ `validateCart - should detect stock issues`
- ✅ `mergeGuestCart - should merge items correctly`
- ✅ `mergeGuestCart - should handle duplicate items`

**Priority:** HIGH  
**Estimated Time:** 6-8 hours

#### 1.2 ShippingService Tests (10+ test cases)
**File:** `src/modules/cart/shipping.service.spec.ts`

**Test Cases:**
- ✅ `should be defined`
- ✅ `calculateShipping - NCR standard shipping (₱50)`
- ✅ `calculateShipping - NCR express shipping (₱150)`
- ✅ `calculateShipping - NCR same-day shipping (₱300)`
- ✅ `calculateShipping - Province rates with multiplier`
- ✅ `calculateShipping - Weight surcharge calculation`
- ✅ `calculateShipping - Record metrics correctly`
- ✅ `getShippingOptions - Return 3 options for NCR`
- ✅ `getShippingOptions - Return 2 options for provinces`
- ✅ `estimateShipping - Return selected method`
- ✅ `determineRegion - Classify NCR correctly`
- ✅ `determineRegion - Classify provinces correctly`
- ✅ `validateAddress - Validate required fields`

**Priority:** HIGH  
**Estimated Time:** 4-5 hours

#### 1.3 CartSchedulerService Tests (8+ test cases)
**File:** `src/modules/cart/cart-scheduler.service.spec.ts`

**Test Cases:**
- ✅ `should be defined`
- ✅ `expireInactiveCarts - Expire guest carts after 7 days`
- ✅ `expireInactiveCarts - Expire user carts after 30 days`
- ✅ `expireInactiveCarts - Leave active carts unchanged`
- ✅ `detectAbandonedCarts - Mark carts abandoned after 3 hours`
- ✅ `detectAbandonedCarts - Record abandonment metrics`
- ✅ `detectAbandonedCarts - Skip already abandoned carts`
- ✅ `getSchedulerStats - Return correct statistics`
- ✅ `manual triggers - Work correctly for testing`

**Priority:** MEDIUM  
**Estimated Time:** 3-4 hours

#### 1.4 CartAnalyticsController Tests (6+ test cases)
**File:** `src/modules/cart/cart-analytics.controller.spec.ts`

**Test Cases:**
- ✅ `should be defined`
- ✅ `getCartAnalytics - Return overall statistics`
- ✅ `getCartAnalytics - Filter by date range`
- ✅ `getShippingRevenue - Return revenue breakdown`
- ✅ `getTaxCollected - Return NCR vs Province breakdown`
- ✅ `getActiveCarts - Return real-time metrics`
- ✅ `All endpoints - Require admin authentication`

**Priority:** MEDIUM  
**Estimated Time:** 3-4 hours

#### 1.5 CartCacheService Tests
**File:** `src/modules/cart/cart-cache.service.spec.ts`

**Test Cases:**
- Cache get/set operations
- Invalidation logic
- TTL handling
- Graceful degradation when Redis unavailable

**Priority:** LOW  
**Estimated Time:** 2-3 hours

---

### **Task 2: Integration Tests** (1-2 days)

#### 2.1 REST API Tests
**File:** `test/integration/cart-api.spec.ts`

**Test Coverage:**
- All 7 cart endpoints (GET, POST, PUT, DELETE)
- 4 analytics endpoints
- Request/response validation
- Error handling
- Authentication/authorization

**Priority:** HIGH  
**Estimated Time:** 4-6 hours

#### 2.2 Database Operations
**File:** `test/integration/cart-database.spec.ts`

**Test Coverage:**
- CRUD operations on Cart and CartItem
- Transaction handling
- Constraint validation
- Index usage verification

**Priority:** MEDIUM  
**Estimated Time:** 3-4 hours

#### 2.3 Cache Integration
**File:** `test/integration/cart-cache.spec.ts`

**Test Coverage:**
- Cache hit/miss scenarios
- Invalidation on updates
- TTL expiration
- Race condition handling

**Priority:** MEDIUM  
**Estimated Time:** 2-3 hours

#### 2.4 Metrics Validation
**File:** `test/integration/cart-metrics.spec.ts`

**Test Coverage:**
- Prometheus metrics increment correctly
- All 9 cart metrics tested
- Label accuracy
- /metrics endpoint accessibility

**Priority:** MEDIUM  
**Estimated Time:** 2-3 hours

---

### **Task 3: E2E Tests** (1 day)

#### 3.1 Complete Cart Flow
**File:** `test/e2e/cart-flow.e2e-spec.ts`

**Test Scenario:**
```
1. Create cart (guest user)
2. Add 3 items to cart
3. Update item quantity
4. Remove one item
5. Validate cart (stock/price check)
6. Get cart summary
7. Clear cart
8. Verify cart is empty
```

**Priority:** HIGH  
**Estimated Time:** 2-3 hours

#### 3.2 Guest Cart Merge
**File:** `test/e2e/guest-cart-merge.e2e-spec.ts`

**Test Scenario:**
```
1. Add items as guest (no authentication)
2. Login/register user
3. Trigger cart merge
4. Verify guest items in user cart
5. Verify guest cart marked as MERGED
6. Verify cache invalidation
```

**Priority:** HIGH  
**Estimated Time:** 2-3 hours

#### 3.3 Checkout Process
**File:** `test/e2e/checkout.e2e-spec.ts`

**Test Scenario:**
```
1. Add items to cart
2. Estimate shipping (NCR)
3. Calculate totals with tax
4. Checkout with GCASH payment
5. Verify order created
6. Verify cart marked COMPLETED
7. Verify metrics recorded
```

**Priority:** HIGH  
**Estimated Time:** 2-3 hours

#### 3.4 Order Creation
**File:** `test/e2e/order-creation.e2e-spec.ts`

**Test Scenario:**
```
1. Create cart with multiple items
2. Complete checkout
3. Verify order details match cart
4. Verify stock deduction
5. Verify order status is PENDING
```

**Priority:** MEDIUM  
**Estimated Time:** 1-2 hours

---

### **Task 4: Load Testing** (1 day)

#### 4.1 Setup k6 Load Testing
**File:** `test/load/cart-load-test.js`

**Install k6:**
```bash
# Windows (Chocolatey)
choco install k6

# Or download from: https://k6.io/docs/getting-started/installation/
```

#### 4.2 Load Test Scenarios

**Scenario 1: Normal Load**
- 100 virtual users
- 60 second duration
- Target: <100ms p95 response time

**Scenario 2: Peak Load**
- 1000 virtual users
- 5 minute ramp-up
- 10 minute sustained
- Target: <200ms p95, <1% error rate

**Scenario 3: Stress Test**
- Gradually increase from 100 to 2000 users
- Find breaking point
- Monitor resource usage

**Scenario 4: Stock Race Conditions**
- 100 users simultaneously buying last item
- Verify stock consistency
- No over-selling

**Priority:** MEDIUM  
**Estimated Time:** 4-6 hours

---

## 🧪 Testing Commands

### Run Unit Tests
```bash
# Run all unit tests
npm test

# Run cart service tests only
npm test cart.service

# Run with coverage
npm run test:cov

# Watch mode
npm test -- --watch
```

### Run Integration Tests
```bash
# Run all integration tests
npm run test:integration

# Run specific integration test
npm run test:integration cart-api
```

### Run E2E Tests
```bash
# Start test database
npm run test:e2e:setup

# Run E2E tests
npm run test:e2e

# Run specific E2E test
npm run test:e2e cart-flow
```

### Run Load Tests
```bash
# Run normal load test
k6 run test/load/cart-load-test.js

# Run with custom VUs
k6 run --vus 500 --duration 5m test/load/cart-load-test.js

# Generate HTML report
k6 run --out json=test/load/results/results.json test/load/cart-load-test.js
```

### View Coverage Reports
```bash
# Generate coverage report
npm run test:cov

# Open coverage in browser
start coverage/lcov-report/index.html
```

---

## 📈 Success Criteria

### Code Coverage
- [ ] **Unit Tests:** 80%+ coverage across all services
- [ ] **CartService:** 85%+ coverage (critical service)
- [ ] **Integration Tests:** 100% of API endpoints covered
- [ ] **E2E Tests:** All critical user flows tested

### Performance
- [ ] **p95 Response Time:** <100ms for all cart operations
- [ ] **Cache Hit Rate:** >90% for repeated cart reads
- [ ] **Concurrent Users:** Handle 1000+ users simultaneously
- [ ] **Stock Consistency:** 100% accurate under high load

### Reliability
- [ ] **API Error Rate:** <0.1% under normal load
- [ ] **Test Pass Rate:** 100% (all tests passing)
- [ ] **No Flaky Tests:** All tests deterministic
- [ ] **CI/CD Integration:** Tests run on every commit

---

## 🚀 Implementation Schedule

### Day 1 (November 14, 2025)
- [x] Create testing plan and structure
- [ ] Implement CartService unit tests (8+ cases)
- [ ] Implement ShippingService unit tests (6+ cases)
- [ ] Fix any failing unit tests

### Day 2 (November 15, 2025)
- [ ] Complete CartService tests (15+ cases)
- [ ] Complete ShippingService tests (10+ cases)
- [ ] Implement CartSchedulerService tests (8+ cases)
- [ ] Implement CartAnalyticsController tests (6+ cases)
- [ ] Run all unit tests, verify 80%+ coverage

### Day 3 (November 16, 2025)
- [ ] Create integration test setup
- [ ] Implement REST API integration tests
- [ ] Implement database integration tests
- [ ] Implement cache integration tests
- [ ] Implement metrics validation tests

### Day 4 (November 17, 2025)
- [ ] Create E2E test setup
- [ ] Implement complete cart flow E2E test
- [ ] Implement guest cart merge E2E test
- [ ] Implement checkout process E2E test
- [ ] Implement order creation E2E test

### Day 5 (November 18, 2025)
- [ ] Setup k6 load testing
- [ ] Implement load test scenarios
- [ ] Run load tests and analyze results
- [ ] Optimize any performance bottlenecks
- [ ] Create Phase 8 summary documentation

---

## 📊 Tracking Progress

### Unit Tests Progress
- CartService: 0/15 tests (0%)
- ShippingService: 0/10 tests (0%)
- CartSchedulerService: 0/8 tests (0%)
- CartAnalyticsController: 0/6 tests (0%)
- CartCacheService: 0/5 tests (0%)

**Total: 0/44 unit tests (0%)**

### Integration Tests Progress
- REST API: 0/7 endpoints (0%)
- Database: 0/4 test suites (0%)
- Cache: 0/4 test suites (0%)
- Metrics: 0/9 metrics (0%)

**Total: 0/24 integration tests (0%)**

### E2E Tests Progress
- Cart Flow: Not started
- Guest Merge: Not started
- Checkout: Not started
- Order Creation: Not started

**Total: 0/4 E2E flows (0%)**

### Load Tests Progress
- Normal Load: Not started
- Peak Load: Not started
- Stress Test: Not started
- Race Conditions: Not started

**Total: 0/4 load scenarios (0%)**

---

## 🛠️ Tools & Dependencies

### Testing Frameworks
- **Jest:** Unit and integration testing
- **Supertest:** HTTP endpoint testing
- **k6:** Load and performance testing

### Test Utilities
- **@nestjs/testing:** NestJS test module
- **ts-jest:** TypeScript Jest transformer
- **jest-mock-extended:** Enhanced mocking

### Coverage Tools
- **Istanbul (built into Jest):** Code coverage
- **Codecov:** Coverage reporting (optional)

---

## 📝 Documentation Deliverables

1. **PHASE_8_SUMMARY.md** - Complete testing summary
2. **TESTING_GUIDE.md** - How to run tests
3. **LOAD_TESTING_REPORT.md** - Performance results
4. **COVERAGE_REPORT.md** - Coverage analysis
5. Update **SHOPPING_CART_IMPLEMENTATION_PLAN.md**

---

## 🎯 Definition of Done

Phase 8 is complete when:
- ✅ 80%+ unit test coverage achieved
- ✅ 100% of API endpoints have integration tests
- ✅ All 4 critical E2E flows tested
- ✅ Load tests pass at 1000 concurrent users
- ✅ All tests pass in CI/CD pipeline
- ✅ Performance benchmarks met (<100ms p95)
- ✅ Documentation complete and reviewed
- ✅ Code review approved

---

**Phase 8 Status:** 🚀 **IN PROGRESS**  
**Next Milestone:** Complete CartService unit tests  
**Overall Cart System:** 87.5% complete (7/8 phases done, Phase 8 started)
