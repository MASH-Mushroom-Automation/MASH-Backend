# 🚀 Next Steps Guide: Phase 3 Payment Integration

**Current Status**: ✅ Phase 3.1 Complete (Payment Architecture)  
**Next Up**: Phase 3.2 - PayMongo Integration  
**Timeline**: 2-3 days remaining for complete Phase 3  
**Updated**: November 18, 2025 - 5:55 PM

---

## ✅ What's Been Completed

### Phase 1: Foundation & Architecture (100% ✅)
- ✅ Order State Machine (13 states, 24 transitions)
- ✅ Enhanced Order DTOs (15+ DTOs, 1800+ lines)
- ✅ Database Schema Updates (3 new tables)
- ✅ Order Repository Layer (caching, query builders)

### Phase 2: Core Order Operations (100% ✅)
- ✅ Order Creation Workflow (cart conversion, direct orders)
- ✅ Order Status Updates (state machine integration)
- ✅ Order Cancellation Logic (validation, inventory release)
- ✅ Order Retrieval & Filtering (advanced queries, pagination)
- ✅ Order Tracking System (pricing, delivery estimation)

### Phase 3.1: Payment Service Architecture (100% ✅)
- ✅ **PaymentService** - Factory pattern for provider selection (320 lines)
- ✅ **IPaymentProvider** - Base interface for all providers
- ✅ **BasePaymentProvider** - Abstract class with common functionality
- ✅ **Payment Enums** - Provider (5 types), Method (8 methods), Status (10 states)
- ✅ **Payment DTOs** - Complete DTO set with validation
- ✅ **PaymentController** - 10+ endpoints with Swagger docs
- ✅ **Webhook Infrastructure** - Ready for PayMongo, GCash, Maya
- ✅ **Payment Tracking** - Prometheus metrics integration

**Files Created**:
```
src/modules/payments/
├── payment.service.ts           (320 lines)
├── payment.controller.ts        (220 lines)
├── payment.module.ts            (25 lines)
├── enums/
│   └── payment.enum.ts         (70 lines)
├── interfaces/
│   └── payment-provider.interface.ts (180 lines)
├── providers/
│   └── base-payment.provider.ts (100 lines)
└── dto/
    ├── create-payment-intent.dto.ts (160 lines)
    ├── confirm-payment.dto.ts      (30 lines)
    ├── create-refund.dto.ts        (55 lines)
    ├── payment-response.dto.ts     (200 lines)
    └── index.ts                    (4 lines)
```

---

## 🎯 Phase 3.2: PayMongo Integration (NEXT)

### Overview
PayMongo is the most comprehensive payment gateway in the Philippines, supporting:
- Credit/Debit cards (Visa, Mastercard, AMEX)
- E-wallets (GCash, Maya, GrabPay)
- Online banking (BPI, BDO, UnionBank)
- Installment payments
- Recurring payments

### Implementation Steps

#### Step 1: Setup PayMongo Account & API Keys (1 hour)

**Prerequisites**:
1. Register at [PayMongo Dashboard](https://dashboard.paymongo.com/signup)
2. Complete KYC verification
3. Get API keys:
   - **Sandbox**: For testing (no real money)
   - **Production**: For live transactions

**Add to `.env`**:
```env
# PayMongo API Keys
PAYMONGO_SECRET_KEY_SANDBOX=sk_test_xxxxxxxxxxxx
PAYMONGO_PUBLIC_KEY_SANDBOX=pk_test_xxxxxxxxxxxx
PAYMONGO_SECRET_KEY_PROD=sk_live_xxxxxxxxxxxx
PAYMONGO_PUBLIC_KEY_PROD=pk_live_xxxxxxxxxxxx
PAYMONGO_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
PAYMONGO_MODE=sandbox  # or 'production'
```

**Add to `config/configuration.ts`**:
```typescript
paymongo: {
  secretKey: process.env.PAYMONGO_MODE === 'production'
    ? process.env.PAYMONGO_SECRET_KEY_PROD
    : process.env.PAYMONGO_SECRET_KEY_SANDBOX,
  publicKey: process.env.PAYMONGO_MODE === 'production'
    ? process.env.PAYMONGO_PUBLIC_KEY_PROD
    : process.env.PAYMONGO_PUBLIC_KEY_SANDBOX,
  webhookSecret: process.env.PAYMONGO_WEBHOOK_SECRET,
  mode: process.env.PAYMONGO_MODE || 'sandbox',
  apiUrl: 'https://api.paymongo.com/v1',
},
```

#### Step 2: Install PayMongo SDK (15 minutes)

```bash
npm install axios
# PayMongo doesn't have official Node SDK, use HTTP client
```

#### Step 3: Create PayMongoProvider (2 hours)

**File**: `src/modules/payments/providers/paymongo.provider.ts`

**Key Methods to Implement**:
1. `createPaymentIntent()` - Create payment intent
   - Card: Create PaymentIntent → Attach PaymentMethod → Confirm
   - E-wallet: Create Source → Redirect user → Capture on webhook
2. `confirmPayment()` - Confirm card payment
3. `getPaymentStatus()` - Retrieve payment status
4. `cancelPayment()` - Cancel pending payment
5. `createRefund()` - Process refund
6. `verifyWebhookSignature()` - Verify webhook authenticity
7. `processWebhook()` - Handle payment events

**PayMongo API Endpoints**:
```
POST /v1/payment_intents        # Create payment intent
POST /v1/payment_intents/:id/attach   # Attach payment method
GET  /v1/payment_intents/:id    # Get payment intent
POST /v1/sources                # Create e-wallet source
POST /v1/refunds                # Create refund
GET  /v1/refunds/:id            # Get refund status
```

**Example Structure**:
```typescript
@Injectable()
export class PayMongoProvider extends BasePaymentProvider {
  private readonly apiUrl: string;
  private readonly secretKey: string;
  
  constructor(private readonly config: ConfigService) {
    super('PAYMONGO');
    this.apiUrl = config.get('paymongo.apiUrl');
    this.secretKey = config.get('paymongo.secretKey');
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest) {
    // Card payment: Create PaymentIntent
    if (request.paymentMethod === PaymentMethod.CREDIT_CARD) {
      return this.createCardPaymentIntent(request);
    }
    
    // E-wallet: Create Source
    if (request.paymentMethod === PaymentMethod.GCASH) {
      return this.createEWalletSource(request, 'gcash');
    }
  }

  private async createCardPaymentIntent(request) {
    const response = await axios.post(
      `${this.apiUrl}/payment_intents`,
      {
        data: {
          attributes: {
            amount: request.amount,
            currency: request.currency.toLowerCase(),
            description: request.description,
            statement_descriptor: 'MASH Order',
            metadata: request.metadata,
          },
        },
      },
      {
        auth: {
          username: this.secretKey,
          password: '',
        },
      },
    );
    
    return {
      id: response.data.data.id,
      status: this.mapStatus(response.data.data.attributes.status),
      amount: response.data.data.attributes.amount,
      currency: request.currency,
      paymentMethod: request.paymentMethod,
      clientSecret: response.data.data.attributes.client_key,
    };
  }
}
```

#### Step 4: Register Provider in Module (15 minutes)

**Update**: `src/modules/payments/payment.module.ts`

```typescript
import { PayMongoProvider } from './providers/paymongo.provider';

@Module({
  imports: [],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PayMongoProvider,
    {
      provide: 'PAYMENT_PROVIDERS',
      useFactory: (paymentService: PaymentService, paymongoProvider: PayMongoProvider) => {
        // Register providers on module init
        paymentService.registerProvider(PaymentProvider.PAYMONGO, paymongoProvider);
        return [paymongoProvider];
      },
      inject: [PaymentService, PayMongoProvider],
    },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
```

#### Step 5: Setup Webhooks (1 hour)

**Local Testing with ngrok**:
```bash
# Install ngrok
choco install ngrok  # Windows
# or download from https://ngrok.com/download

# Start your dev server
npm run start:dev

# In another terminal, expose port 3000
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Configure in PayMongo Dashboard:
# Webhook URL: https://abc123.ngrok.io/api/v1/payments/webhooks/paymongo
```

**Webhook Events to Handle**:
- `payment.paid` - Payment successful
- `payment.failed` - Payment failed
- `source.chargeable` - E-wallet ready to capture
- `refund.updated` - Refund status changed

**Implementation**:
```typescript
async processWebhook(payload: WebhookPayload): Promise<void> {
  switch (payload.type) {
    case 'payment.paid':
      await this.handlePaymentPaid(payload.data);
      break;
    case 'payment.failed':
      await this.handlePaymentFailed(payload.data);
      break;
    case 'source.chargeable':
      await this.handleSourceChargeable(payload.data);
      break;
    default:
      this.logger.warn(`Unhandled webhook event: ${payload.type}`);
  }
}
```

#### Step 6: Integration Testing (1 hour)

**Test Card Numbers** (Sandbox):
```
Success: 4343434343434345
Decline: 4571736000000075
Insufficient Funds: 4571736000000083
```

**Test Flow**:
1. Create payment intent
2. Simulate card payment
3. Verify webhook received
4. Check payment status
5. Test refund

**Postman Collection**:
- Add PayMongo endpoints to `postman/09-Payment-Gateway-API.postman_collection.json`
- Test all payment methods
- Document response structures

---

## 🎯 Phase 3.3: GCash Direct Integration (2-3 hours)

### Overview
Direct GCash integration for:
- QR code payments
- Deep linking to GCash app
- Real-time payment confirmation

### Implementation Steps

1. **Register GCash Merchant Account**
   - Apply at [GCash for Business](https://www.gcash.com/businesses/)
   - Get API credentials

2. **Create GCashProvider**
   - File: `src/modules/payments/providers/gcash.provider.ts`
   - Implement QR code generation
   - Handle deep linking URLs
   - Process webhooks

3. **QR Code Generation**
   ```typescript
   async generateQRCode(amount: number, orderId: string): Promise<string> {
     // GCash QR API call
     // Returns QR code image URL or data
   }
   ```

4. **Register Provider**
   ```typescript
   paymentService.registerProvider(PaymentProvider.GCASH, gcashProvider);
   ```

---

## 🎯 Phase 3.4: Maya Integration (2-3 hours)

### Overview
Maya (formerly PayMaya) wallet integration:
- One-time payments
- Installment options
- Checkout URL redirect

### Implementation Steps

1. **Register Maya Merchant Account**
   - Apply at [Maya Checkout](https://www.maya.ph/business)
   - Get API keys

2. **Create MayaProvider**
   - File: `src/modules/payments/providers/maya.provider.ts`
   - Implement checkout URL generation
   - Handle payment callbacks
   - Process webhooks

3. **Payment Flow**
   ```typescript
   async createCheckoutUrl(request: CreatePaymentIntentRequest) {
     // Maya API: Create checkout session
     // Returns redirect URL
   }
   ```

4. **Register Provider**
   ```typescript
   paymentService.registerProvider(PaymentProvider.MAYA, mayaProvider);
   ```

---

## 📋 Quick Command Reference

### Development
```bash
# Build project
npm run build

# Start dev server
npm run start:dev

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Check for errors
npm run lint
```

### Database
```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name add_payment_tables

# Open Prisma Studio
npx prisma studio
```

### Testing Payments
```bash
# Start ngrok for webhook testing
ngrok http 3000

# Test PayMongo sandbox
curl -X POST http://localhost:3000/api/v1/payments/intents \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID",
    "amount": 150000,
    "currency": "PHP",
    "paymentMethod": "GCASH"
  }'
```

---

## 🔧 Troubleshooting

### Issue: PayMongo API returns 401 Unauthorized
**Solution**: 
- Verify API key is correct
- Ensure using Base64 encoding: `Buffer.from(secretKey).toString('base64')`
- Check if in correct mode (sandbox/production)

### Issue: Webhook not received
**Solution**:
- Verify ngrok is running
- Check webhook URL in PayMongo dashboard
- Ensure endpoint is accessible publicly
- Check firewall settings

### Issue: Payment status not updating
**Solution**:
- Check webhook signature verification
- Verify database transaction
- Check Prometheus metrics for failures
- Review application logs

---

## 📊 Progress Tracking

### Phase 3 Checklist

- [x] **3.1 Payment Service Architecture** ✅
  - [x] PaymentService with factory pattern
  - [x] IPaymentProvider interface
  - [x] BasePaymentProvider abstract class
  - [x] Payment enums & DTOs
  - [x] PaymentController
  - [x] Webhook infrastructure

- [ ] **3.2 PayMongo Integration** 🚧
  - [ ] Setup account & API keys
  - [ ] Install dependencies
  - [ ] Create PayMongoProvider
  - [ ] Implement card payments
  - [ ] Implement e-wallet payments
  - [ ] Setup webhooks with ngrok
  - [ ] Integration testing
  - [ ] Update Postman collection

- [ ] **3.3 GCash Integration**
  - [ ] Setup merchant account
  - [ ] Create GCashProvider
  - [ ] Implement QR code generation
  - [ ] Handle deep linking
  - [ ] Process webhooks
  - [ ] Testing

- [ ] **3.4 Maya Integration**
  - [ ] Setup merchant account
  - [ ] Create MayaProvider
  - [ ] Implement checkout URL
  - [ ] Handle callbacks
  - [ ] Process webhooks
  - [ ] Testing

---

## 🎓 Learning Resources

### PayMongo Documentation
- [API Reference](https://developers.paymongo.com/reference)
- [Payment Intents Guide](https://developers.paymongo.com/docs/accepting-payments)
- [Sources Guide](https://developers.paymongo.com/docs/accepting-gcash-and-grab-pay-payments)
- [Webhooks Guide](https://developers.paymongo.com/docs/webhooks)

### GCash Documentation
- [GCash API Docs](https://developer.gcash.com/)
- [QR Payment Guide](https://developer.gcash.com/qr-payments)

### Maya Documentation
- [Maya Checkout API](https://developers.maya.ph/reference/checkout-1)
- [Webhooks](https://developers.maya.ph/reference/webhook-1)

---

## 💡 Best Practices

### Security
- ✅ Never commit API keys to git
- ✅ Use environment variables
- ✅ Verify webhook signatures
- ✅ Implement rate limiting on webhook endpoints
- ✅ Log all payment operations for audit
- ✅ Encrypt sensitive payment data

### Error Handling
- ✅ Implement retry logic for API failures
- ✅ Handle network timeouts gracefully
- ✅ Provide clear error messages to users
- ✅ Log errors with correlation IDs
- ✅ Monitor failed payments with Prometheus

### Testing
- ✅ Test all payment methods in sandbox
- ✅ Test webhook delivery and retry
- ✅ Test refund flows
- ✅ Test edge cases (insufficient funds, expired cards)
- ✅ Load test payment endpoints

### Monitoring
- ✅ Track payment metrics (success rate, duration)
- ✅ Alert on high failure rates
- ✅ Monitor webhook delivery
- ✅ Track refund volume
- ✅ Dashboard for payment analytics

---

## 🚀 Success Criteria

### Phase 3 Complete When:
- [ ] All 4 tasks completed
- [ ] Build passes with 0 errors
- [ ] All tests passing
- [ ] Postman collection updated with examples
- [ ] Documentation updated
- [ ] Successfully process test payment via PayMongo
- [ ] Webhooks working in local environment
- [ ] Payment metrics visible in Prometheus
- [ ] Ready for Phase 4 (Shipping Integration)

---

## 📞 Need Help?

### Common Questions
- **Q**: Which payment provider should I start with?
  - **A**: Start with PayMongo - it's the most comprehensive and well-documented

- **Q**: Do I need production accounts to test?
  - **A**: No, use sandbox accounts for all testing

- **Q**: How do I test webhooks locally?
  - **A**: Use ngrok to expose localhost to internet

- **Q**: What's the minimum refund amount?
  - **A**: Same as payment minimum: ₱1.00 (100 centavos)

---

**Good luck with Phase 3.2! 🚀**

---

## 📝 Notes
- Estimated time for Phase 3.2: 4-6 hours
- Estimated time for Phase 3.3: 2-3 hours
- Estimated time for Phase 3.4: 2-3 hours
- **Total Phase 3 time**: 8-12 hours (1-2 days)

Start with PayMongo as it's the foundation for all payment processing in the Philippines. Once PayMongo is working, GCash and Maya will be much faster to implement since they share similar patterns.
