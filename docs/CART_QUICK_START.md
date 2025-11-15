# 🚀 Cart System - Quick Start Card

**Date:** November 15, 2025  
**Status:** ✅ Ready to Test  
**Time Needed:** 15 minutes

---

## ⚡ Super Quick Test (5 Minutes)

### 1. Open Swagger UI
```
http://localhost:3000/api/docs
```

### 2. Generate Session ID
**PowerShell:**
```powershell
[guid]::NewGuid().ToString()
```
**Copy the output** (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### 3. Test Cart Operations

#### ① Create Cart
- Endpoint: **GET /api/v1/cart**
- Click "Try it out"
- Add header: `X-Session-Id: <your-session-id>`
- Click "Execute"
- ✅ Should return 200 with empty cart

#### ② Add Item
- Endpoint: **POST /api/v1/cart/items**
- Same session ID header
- Body:
  ```json
  {
    "productId": "GET_FROM_PRODUCTS_API",
    "quantity": 2
  }
  ```
- ✅ Should return 201 with cart + item

#### ③ Get Updated Cart
- Endpoint: **GET /api/v1/cart**
- Same session ID
- ✅ Should show item with correct totals

---

## 📝 Test Checklist

### Guest Cart Flow
- [ ] Create empty cart
- [ ] Add 2-3 products
- [ ] Update quantity of one item
- [ ] Remove one item
- [ ] Clear entire cart
- [ ] Validate cart

### Authenticated Flow
- [ ] Login to get JWT token
- [ ] Create guest cart first
- [ ] Login with user
- [ ] Merge guest cart (POST /cart/merge)
- [ ] Verify all items merged

### Checkout Flow
- [ ] Add items to cart
- [ ] Estimate shipping (POST /cart/shipping/estimate)
- [ ] Validate cart (POST /cart/validate)
- [ ] Checkout (POST /cart/checkout)
- [ ] Verify order created

---

## 🎯 Key Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/cart` | GET | Public | Get/create cart |
| `/cart/items` | POST | Public | Add item |
| `/cart/items/:id` | PUT | Public | Update item |
| `/cart/items/:id` | DELETE | Public | Remove item |
| `/cart` | DELETE | Public | Clear cart |
| `/cart/validate` | POST | Public | Validate cart |
| `/cart/merge` | POST | JWT | Merge guest cart |
| `/cart/shipping/estimate` | POST | Public | Get shipping cost |
| `/cart/checkout` | POST | JWT | Create order |

---

## 🔧 Quick Commands

### Get Product IDs for Testing
```powershell
curl http://localhost:3000/api/v1/products?page=1&limit=5
```

### Seed Database
```powershell
npm run db:seed
```

### Check Server Health
```powershell
curl http://localhost:3000/api/v1/health
```

### View Database
```powershell
npx prisma studio
```

### Run Postman Tests
```powershell
npm run postman:test
```

---

## 💡 Pro Tips

1. **Session ID:** Keep the same session ID across requests to track the same cart
2. **JWT Token:** Get from login response, valid for 24 hours
3. **Product IDs:** Use real product IDs from your database
4. **Testing:** Test error cases too (out of stock, invalid product)
5. **Caching:** Second request should be faster (cached)

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Cannot find product | Check product exists: `npx prisma studio` |
| Insufficient stock | Update product stock in database |
| Unauthorized | Get fresh JWT from login endpoint |
| Cart not found | Use consistent X-Session-Id header |

---

## 📚 Full Documentation

- **Implementation Plan:** `docs/CART_SYSTEM_IMPLEMENTATION_PLAN.md`
- **Testing Guide:** `docs/CART_TESTING_GUIDE.md`
- **Next Steps:** `docs/CART_NEXT_STEPS.md`
- **Swagger UI:** http://localhost:3000/api/docs

---

## ✅ Success Indicators

- ✅ Can create cart with session ID
- ✅ Can add items and see totals
- ✅ Can update quantities
- ✅ Can remove items
- ✅ Guest cart merges on login
- ✅ Checkout creates order
- ✅ All responses < 200ms

---

**Ready? Go to:** http://localhost:3000/api/docs

**Start with:** GET /api/v1/cart 🚀
