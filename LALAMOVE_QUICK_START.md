# Lalamove Integration - Quick Start Guide

## 🚀 Quick Start (5 Minutes)

### 1. Environment Setup

Add to `.env`:

```bash
LALAMOVE_BASE_URL=https://rest.sandbox.lalamove.com
LALAMOVE_API_KEY=your_api_key_here
LALAMOVE_SECRET=your_secret_key_here
LALAMOVE_WEBHOOK_URL=https://your-domain.com/api/v1/lalamove/webhook
```

### 2. Start Server

```bash
npm run start:dev
```

### 3. Access Swagger Docs

Open: `http://localhost:3000/api#/lalamove`

---

## 📖 API Endpoints

### 1. Create Quotation

```http
POST /api/v1/lalamove/quotations
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "orderId": "mash-order-123",
  "serviceType": "MOTORCYCLE",
  "stops": [
    {
      "coordinates": {
        "lat": "14.5995",
        "lng": "120.9842"
      },
      "address": "SM Mall of Asia, Pasay City"
    },
    {
      "coordinates": {
        "lat": "14.5547",
        "lng": "121.0244"
      },
      "address": "Bonifacio Global City, Taguig"
    }
  ],
  "item": {
    "quantity": "1",
    "weight": "LESS_THAN_3_KG",
    "categories": ["FOOD_DELIVERY"],
    "handlingInstructions": ["KEEP_UPRIGHT"]
  },
  "scheduleAt": "2024-12-25T14:00:00+08:00"  // Optional: minimum 2 hours from now
}
```

**Response**:
```json
{
  "quotationId": "PH_QT_abc123",
  "serviceType": "MOTORCYCLE",
  "priceBreakdown": {
    "base": "50.00",
    "total": "50.00",
    "currency": "PHP"
  },
  "distance": {
    "value": "5.2",
    "unit": "km"
  },
  "expiresAt": "2024-12-25T09:35:00+08:00",
  "stops": [...]
}
```

---

### 2. Create Order

```http
POST /api/v1/lalamove/orders
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "quotationId": "PH_QT_abc123",
  "orderId": "mash-order-123",
  "sender": {
    "stopId": "stop-1",
    "name": "John Doe",
    "phone": "+639171234567"
  },
  "recipients": [
    {
      "stopId": "stop-2",
      "name": "Jane Smith",
      "phone": "+639179876543",
      "remarks": "Please call upon arrival"
    }
  ],
  "isPODEnabled": true,
  "metadata": {
    "orderNumber": "ORD-2024-001"
  }
}
```

**Response**:
```json
{
  "orderId": "PH_ORD_xyz789",
  "quotationId": "PH_QT_abc123",
  "status": "ASSIGNING_DRIVER",
  "driverId": null,
  "shareLink": "https://www.lalamove.com/track/PH_ORD_xyz789",
  "priceBreakdown": {
    "base": "50.00",
    "total": "50.00",
    "currency": "PHP"
  }
}
```

---

### 3. Get Order Status

```http
GET /api/v1/lalamove/orders/{orderId}
Authorization: Bearer {jwt_token}
```

**Response**:
```json
{
  "orderId": "PH_ORD_xyz789",
  "status": "ON_GOING",
  "driverId": "driver-123",
  "shareLink": "https://www.lalamove.com/track/PH_ORD_xyz789",
  "stops": [
    {
      "stopId": "stop-1",
      "status": "PICKED_UP",
      "name": "John Doe",
      "phone": "+639171234567"
    },
    {
      "stopId": "stop-2",
      "status": "PENDING",
      "name": "Jane Smith",
      "phone": "+639179876543"
    }
  ]
}
```

---

### 4. Get Driver Info

```http
GET /api/v1/lalamove/orders/{orderId}/driver
Authorization: Bearer {jwt_token}
```

**Response**:
```json
{
  "driverId": "driver-123",
  "name": "Pedro Santos",
  "phone": "+639178889999",
  "photo": "https://lalamove.com/photos/driver-123.jpg",
  "plateNumber": "ABC-1234",
  "coordinates": {
    "lat": "14.5750",
    "lng": "121.0000"
  }
}
```

---

### 5. Add Priority Fee (Tip)

```http
POST /api/v1/lalamove/orders/{orderId}/priority-fee
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "priorityFee": "20"
}
```

---

### 6. Cancel Order

```http
DELETE /api/v1/lalamove/orders/{orderId}
Authorization: Bearer {jwt_token}
```

**Response**: 204 No Content

---

## 🔔 Webhook Events

Lalamove sends webhook events to: `POST /api/v1/lalamove/webhook`

### Event Types

| Event | Description | Status Update |
|-------|-------------|---------------|
| `ORDER.ASSIGNING_DRIVER` | System is finding a driver | `ASSIGNING_DRIVER` |
| `ORDER.ONGOING` | Driver assigned and on the way | `ON_GOING` |
| `ORDER.PICKED_UP` | Driver picked up the item | `PICKED_UP` |
| `ORDER.COMPLETED` | Delivery completed with POD | `COMPLETED` |
| `ORDER.CANCELED` | Order cancelled | `CANCELED` |
| `ORDER.REJECTED` | Order rejected by system | `REJECTED` |
| `ORDER.EXPIRED` | Order expired (no driver found) | `EXPIRED` |
| `DRIVER.LOCATION` | Real-time driver location update | - |

### Webhook Payload Example

```json
{
  "eventType": "ORDER.ONGOING",
  "orderId": "PH_ORD_xyz789",
  "timestamp": "2024-12-25T09:45:00+08:00",
  "data": {
    "status": "ON_GOING",
    "driver": {
      "id": "driver-123",
      "name": "Pedro Santos",
      "phone": "+639178889999",
      "photo": "https://lalamove.com/photos/driver-123.jpg",
      "plateNumber": "ABC-1234"
    }
  }
}
```

---

## 🔐 Authentication

### HMAC SHA-256 Signature

All API requests to Lalamove require HMAC signature:

**Header**: `Authorization: hmac {apiKey}:{timestamp}:{signature}`

**Signature Generation**:
```
rawSignature = timestamp + '\r\n' + method + '\r\n' + path + '\r\n' + '\r\n' + body
signature = HMAC-SHA256(rawSignature, secret)
```

**Example**:
```
timestamp: 1703491200000
method: POST
path: /v3/quotations
body: {"serviceType":"MOTORCYCLE",...}

rawSignature = "1703491200000\r\nPOST\r\n/v3/quotations\r\n\r\n{...}"
signature = hmac_sha256(rawSignature, secret)
```

**Handled automatically by `LalamoveApiService`**

---

## 📊 Service Types & Pricing

| Service Type | Description | Typical Use Case | Base Price Range |
|--------------|-------------|------------------|------------------|
| `MOTORCYCLE` | Fast, small items | Documents, food, small parcels | ₱50-100 |
| `SEDAN` | Medium items | Groceries, packages | ₱100-200 |
| `MPV` | Large items | Electronics, multiple boxes | ₱200-350 |
| `VAN` | Bulk items | Furniture, large orders | ₱350-500 |

*Prices vary by distance and demand*

---

## 📦 Item Configuration

### Item Weights

```typescript
'LESS_THAN_3_KG'    // < 3kg
'3_TO_5_KG'         // 3-5kg
'5_TO_10_KG'        // 5-10kg
'10_TO_15_KG'       // 10-15kg
'15_TO_20_KG'       // 15-20kg
```

### Item Categories

```typescript
'FOOD_DELIVERY'     // Food & beverages
'DOCUMENT'          // Documents, papers
'PARCEL'            // General parcels
'FLOWERS'           // Flowers, gifts
'CAKE'              // Cakes, pastries
'KEYS'              // Keys, small items
'ELECTRONICS'       // Electronics
'OTHERS'            // Other items
```

### Handling Instructions

```typescript
'KEEP_UPRIGHT'      // Keep package upright
'FRAGILE'           // Handle with care
'FROZEN'            // Keep frozen
'REFRIGERATED'      // Keep cool
```

---

## 🔍 Order Lifecycle

```
1. CREATE QUOTATION
   └─> Get price estimate and distance
       └─> Quotation expires in 5 minutes

2. CREATE ORDER (from quotation)
   └─> Status: ASSIGNING_DRIVER
       └─> System finds available driver

3. DRIVER ASSIGNED
   └─> Status: ON_GOING
       └─> Driver picks up item

4. ITEM PICKED UP
   └─> Status: PICKED_UP
       └─> Driver en route to destination

5. DELIVERY COMPLETED
   └─> Status: COMPLETED
       └─> POD (Proof of Delivery) captured
```

---

## 🧪 Testing with Postman

### Import Collection

1. Open Postman
2. Import `postman/MASH-Lalamove-PH.postman_collection.json`
3. Import `postman/PH.postman_environment.json`
4. Set environment variables:
   - `BASE_URL`: `http://localhost:3000`
   - `LALAMOVE_BASE_URL`: `https://rest.sandbox.lalamove.com`
   - `LALAMOVE_API_KEY`: Your sandbox API key
   - `LALAMOVE_SECRET`: Your sandbox secret
   - `JWT_TOKEN`: Your JWT token

### Test Sequence

1. **Get City Info** - Verify API connectivity
2. **Create Immediate Quotation** - Get instant price
3. **Create Scheduled Quotation** - Schedule for later
4. **Get Quotation** - Retrieve quotation details
5. **Create Order** - Create delivery from quotation
6. **Get Order** - Check order status
7. **Get Driver** - Get driver info (after assignment)
8. **Add Priority Fee** - Add tip to order
9. **Cancel Order** - Cancel delivery
10. **Webhook Test** - Simulate webhook event

---

## 🚨 Error Handling

### Common Errors

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | `Quotation expired` | Quotation > 5 min old | Create new quotation |
| 400 | `Quotation already used` | Order already created | Create new quotation |
| 400 | `Invalid scheduled time` | < 2 hours from now | Schedule later |
| 401 | `Invalid signature` | Wrong HMAC signature | Check API key & secret |
| 404 | `Order not found` | Invalid order ID | Check order ID |
| 404 | `Driver not assigned` | Driver not yet assigned | Wait for assignment |

---

## 💡 Best Practices

### 1. Quotation Management
- ✅ Create quotation immediately before order
- ✅ Check `expiresAt` before creating order
- ✅ Handle expired quotations gracefully
- ❌ Don't reuse old quotations

### 2. Order Creation
- ✅ Validate MASH order exists first
- ✅ Use E.164 phone format (+639171234567)
- ✅ Enable POD for proof of delivery
- ✅ Add meaningful metadata
- ❌ Don't create orders without quotations

### 3. Scheduled Deliveries
- ✅ Schedule minimum 2 hours ahead
- ✅ Use ISO 8601 format with timezone
- ✅ Account for peak hours
- ❌ Don't schedule same-day during rush hour

### 4. Webhooks
- ✅ Verify webhook signatures
- ✅ Handle duplicate events (idempotency)
- ✅ Respond quickly (< 5 seconds)
- ✅ Process async (queue for background)
- ❌ Don't block webhook response

### 5. Error Handling
- ✅ Retry failed requests (exponential backoff)
- ✅ Log all API interactions
- ✅ Notify users of order issues
- ✅ Handle network timeouts gracefully

---

## 🔧 Troubleshooting

### Issue: "Invalid HMAC signature"
**Cause**: Wrong API key or secret  
**Fix**: Check `.env` file for correct credentials

### Issue: "Quotation expired"
**Cause**: Quotation > 5 minutes old  
**Fix**: Create new quotation before order

### Issue: "Driver not assigned"
**Cause**: Requesting driver info too early  
**Fix**: Wait for `ORDER.ONGOING` webhook before fetching driver

### Issue: "Webhook signature invalid"
**Cause**: Wrong secret or timestamp expired  
**Fix**: Check `LALAMOVE_SECRET` and ensure webhook sent within 5 minutes

### Issue: "Cannot find module @prisma/client"
**Cause**: Prisma client not generated  
**Fix**: Run `npx prisma generate`

---

## 📚 Additional Resources

- **Full Plan**: `LALAMOVE_INTEGRATION_PLAN.md`
- **Implementation Status**: `LALAMOVE_IMPLEMENTATION_STATUS.md`
- **Postman Collection**: `postman/MASH-Lalamove-PH.postman_collection.json`
- **Lalamove API Docs**: [https://developers.lalamove.com](https://developers.lalamove.com)
- **Swagger UI**: `http://localhost:3000/api#/lalamove`

---

## 📞 Support

For issues or questions:
1. Check Swagger documentation: `http://localhost:3000/api`
2. Review logs: `logs/combined.log`
3. Test with Postman collection
4. Check Lalamove dashboard: [https://www.lalamove.com/ph/en/business](https://www.lalamove.com/ph/en/business)

---

**Happy Delivering! 🚚📦**
