# Cart API Testing Guide

**Base URL:** `http://localhost:3000/api/v1/cart`  
**Date:** November 13, 2025  
**Phase:** 4 - REST API Implementation

---

## 🚀 Quick Test Commands

### 1. Get Cart (Guest User)
```bash
curl -X GET http://localhost:3000/api/v1/cart \
  -H "Content-Type: application/json"
```

### 2. Add Item to Cart (Guest User)
```bash
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "Content-Type: application/json" \
  -d "{\"productId\":\"clxxxx123456789\",\"quantity\":2}"
```

### 3. Get Cart Summary
```bash
curl -X GET http://localhost:3000/api/v1/cart/summary \
  -H "Content-Type: application/json"
```

### 4. Update Cart Item
```bash
curl -X PUT http://localhost:3000/api/v1/cart/items/ITEM_ID \
  -H "Content-Type: application/json" \
  -d "{\"quantity\":5}"
```

### 5. Remove Cart Item
```bash
curl -X DELETE http://localhost:3000/api/v1/cart/items/ITEM_ID
```

### 6. Clear Cart
```bash
curl -X DELETE http://localhost:3000/api/v1/cart
```

### 7. Validate Cart
```bash
curl -X POST http://localhost:3000/api/v1/cart/validate \
  -H "Content-Type: application/json"
```

---

## 🔐 Authenticated User Testing

### Get Cart (With JWT)
```bash
curl -X GET http://localhost:3000/api/v1/cart \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Add Item (With JWT)
```bash
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"productId\":\"clxxxx123456789\",\"quantity\":3,\"customization\":{\"giftMessage\":\"Happy Birthday!\"}}"
```

---

## 📋 Testing Checklist

### Guest User Flow ✅
- [ ] Create new cart automatically
- [ ] Session ID generated and stored in cookie
- [ ] Add multiple items to cart
- [ ] Update item quantities
- [ ] Remove items from cart
- [ ] Validate cart for stock/price issues
- [ ] Clear entire cart
- [ ] Session persists across requests

### Authenticated User Flow ✅
- [ ] Login to get JWT token
- [ ] Access cart with JWT
- [ ] Add items to user cart
- [ ] Update items in user cart
- [ ] Cart persists for user account

### Stock Validation ✅
- [ ] Cannot add more than available stock
- [ ] Cannot exceed maxCartQty limit
- [ ] Error message for insufficient stock
- [ ] Validation endpoint catches stock issues

### Price Locking ✅
- [ ] Price locked when item added
- [ ] Validation detects price changes
- [ ] Original price stored in cart item

### Edge Cases ✅
- [ ] Add non-existent product (should fail)
- [ ] Add inactive product (should fail)
- [ ] Update with invalid quantity (should fail)
- [ ] Remove non-existent item (should fail)
- [ ] Concurrent cart updates

---

## 🔍 Expected Responses

### Success: Get Cart
```json
{
  "id": "clxxx123456789",
  "userId": null,
  "sessionId": "guest_abc123...",
  "status": "ACTIVE",
  "items": [
    {
      "id": "clyyy987654321",
      "productId": "clzzz111222333",
      "quantity": 2,
      "price": 299.99,
      "subtotal": 599.98,
      "total": 599.98,
      "product": {
        "name": "Fresh Oyster Mushrooms",
        "images": ["https://..."]
      }
    }
  ],
  "subtotal": 599.98,
  "tax": 71.99,
  "shipping": 50.00,
  "total": 721.97,
  "itemCount": 2,
  "currency": "PHP"
}
```

### Success: Cart Summary
```json
{
  "itemCount": 3,
  "total": 1049.95,
  "hasUnavailableItems": false
}
```

### Error: Insufficient Stock
```json
{
  "statusCode": 409,
  "message": "Insufficient stock. Available: 5, Requested: 10",
  "error": "Conflict"
}
```

### Error: Product Not Found
```json
{
  "statusCode": 404,
  "message": "Product not found",
  "error": "Not Found"
}
```

---

## 📊 Performance Testing

### Load Test with k6 (Future)
```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  let res = http.get('http://localhost:3000/api/v1/cart');
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

---

## 🛠️ Debugging Tips

### Check Logs
```bash
# The server logs will show:
# - Cart operations (get, add, update, remove)
# - User/Session identification
# - Cache hits/misses
# - Stock validation results
```

### View Swagger Docs
```
http://localhost:3000/api
```

### Check Database
```bash
npx prisma studio
# Then navigate to:
# - carts table (see active carts)
# - cart_items table (see all cart items)
```

### Check Redis Cache
```bash
# If Redis is running, check cached carts:
redis-cli KEYS "cart:*"
redis-cli GET "cart:user:USER_ID"
redis-cli GET "cart:session:SESSION_ID"
```

---

## 🎯 Next Steps After Testing

1. **Test all endpoints** with Postman or cURL
2. **Verify guest sessions** work correctly
3. **Check authenticated user carts** persist
4. **Test stock validation** edge cases
5. **Review Swagger documentation** at `/api`
6. **Move to Phase 5**: Guest cart merging and expiration

---

## 📝 Known Limitations (To Be Implemented)

- ❌ Rate limiting (planned for production)
- ❌ Guest cart merging on login (Phase 5)
- ❌ Cart expiration scheduler (Phase 5)
- ❌ Abandoned cart emails (Phase 5)
- ❌ Prometheus metrics (Phase 7)
- ❌ Comprehensive test suite (Phase 8)

---

**Status:** ✅ Phase 4 Complete - Ready for Testing  
**Next Phase:** Guest Cart Merging & Advanced Features
