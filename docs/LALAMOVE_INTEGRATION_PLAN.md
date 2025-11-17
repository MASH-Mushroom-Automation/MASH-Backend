# Lalamove API Integration Plan - MASH Backend

**Status**: Planning Phase  
**Target**: NestJS 11 + Swagger API Documentation  
**Market**: Philippines (PH)  
**API Version**: Lalamove API v3  

---

## 📋 Executive Summary

This document outlines the complete implementation plan for integrating Lalamove delivery services into the MASH e-commerce platform. The integration will provide:

- **On-demand delivery** for pharmacy orders
- **Real-time tracking** of deliveries
- **Automated price quotations** based on distance and service type
- **Webhook notifications** for order status updates
- **Full Swagger API documentation**

---

## 🎯 Business Requirements

### Core Features
1. **Quotation Management**: Get instant or scheduled delivery price quotes
2. **Order Management**: Create, track, and cancel delivery orders
3. **Driver Tracking**: Real-time driver location and details
4. **Webhook Integration**: Receive status updates from Lalamove
5. **Multi-service Support**: Motorcycle, sedan, MPV, van delivery options
6. **Priority Fees**: Add tips for faster driver matching

### Use Cases
- **Customer orders medicine** → System creates Lalamove quotation → Customer confirms → Order placed → Driver assigned → Real-time tracking
- **Pharmacy dispatches order** → Manual Lalamove order creation for bulk/special deliveries
- **Order status updates** → Webhook receives updates → Customer notified via push/email/SMS

---

## 🏗️ Architecture Design

### Module Structure

```
src/modules/lalamove/
├── lalamove.module.ts
├── lalamove.controller.ts          # Main API endpoints
├── lalamove.service.ts             # Business logic
├── services/
│   ├── lalamove-api.service.ts     # Lalamove API client (HMAC signature)
│   ├── quotation.service.ts        # Quotation management
│   ├── order.service.ts            # Order management
│   └── webhook.service.ts          # Webhook handler
├── dto/
│   ├── create-quotation.dto.ts
│   ├── quotation-response.dto.ts
│   ├── create-order.dto.ts
│   ├── order-response.dto.ts
│   ├── driver-response.dto.ts
│   ├── webhook-event.dto.ts
│   └── city-info.dto.ts
├── guards/
│   └── webhook-signature.guard.ts   # Verify Lalamove webhook signatures
├── decorators/
│   └── lalamove-webhook.decorator.ts
├── interfaces/
│   ├── lalamove-quotation.interface.ts
│   ├── lalamove-order.interface.ts
│   └── lalamove-webhook.interface.ts
├── constants/
│   └── lalamove.constants.ts        # Service types, weights, categories
└── tests/
    ├── lalamove.service.spec.ts
    ├── lalamove-api.service.spec.ts
    └── lalamove.e2e-spec.ts
```

---

## 📦 Database Schema

### Prisma Models

```prisma
// Lalamove Quotation Records
model LalamoveQuotation {
  id                String   @id @default(cuid())
  quotationId       String   @unique  // Lalamove quotation ID
  orderId           String?  @unique  // Link to MASH order
  order             Order?   @relation(fields: [orderId], references: [id])
  
  serviceType       String   // MOTORCYCLE, SEDAN, MPV, VAN
  language          String   @default("en_PH")
  
  // Pricing
  totalPrice        Decimal  @db.Decimal(10, 2)
  currency          String   @default("PHP")
  priceBreakdown    Json     // Full price breakdown
  
  // Route
  distance          Decimal  @db.Decimal(10, 2)
  distanceUnit      String   @default("km")
  stops             Json     // Array of stops with coordinates
  
  // Schedule
  scheduleAt        DateTime?
  expiresAt         DateTime
  
  // Status
  isExpired         Boolean  @default(false)
  isUsed            Boolean  @default(false)  // Converted to order
  
  // Metadata
  metadata          Json?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([orderId])
  @@index([quotationId])
  @@index([expiresAt])
  @@map("lalamove_quotations")
}

// Lalamove Order Records
model LalamoveOrder {
  id                String   @id @default(cuid())
  orderId           String   @unique  // Lalamove order ID
  mashOrderId       String   @unique  // Link to MASH order
  mashOrder         Order    @relation(fields: [mashOrderId], references: [id])
  
  quotationId       String   // Original quotation
  
  // Status tracking
  status            String   // ASSIGNING_DRIVER, ON_GOING, PICKED_UP, COMPLETED, CANCELED
  statusHistory     Json[]   // Array of status changes with timestamps
  
  // Driver info
  driverId          String?
  driverName        String?
  driverPhone       String?
  driverPhoto       String?
  plateNumber       String?
  
  // Tracking
  shareLink         String?  // Public tracking link
  currentLocation   Json?    // Latest driver coordinates
  
  // Stops
  sender            Json     // Pharmacy/sender details
  recipients        Json[]   // Customer/recipient details
  
  // Pricing
  totalPrice        Decimal  @db.Decimal(10, 2)
  priorityFee       Decimal? @db.Decimal(10, 2)
  priceBreakdown    Json
  
  // POD (Proof of Delivery)
  isPODEnabled      Boolean  @default(true)
  podImages         Json[]   // Array of POD image URLs
  
  // Schedule
  scheduleAt        DateTime?
  pickedUpAt        DateTime?
  deliveredAt       DateTime?
  cancelledAt       DateTime?
  
  // Metadata
  metadata          Json?
  webhookEvents     Json[]   // All webhook events received
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([mashOrderId])
  @@index([orderId])
  @@index([status])
  @@index([driverId])
  @@map("lalamove_orders")
}

// Update existing Order model
model Order {
  // ... existing fields ...
  
  lalamoveQuotation LalamoveQuotation?
  lalamoveOrder     LalamoveOrder?
  
  // ... rest of fields ...
}
```

---

## 🔌 API Endpoints Design

### Base Route: `/api/v1/lalamove`

#### 1. City Information
```typescript
GET /api/v1/lalamove/cities
```
**Purpose**: Get available service types, vehicle types, and special requests for PH market  
**Auth**: JWT Required  
**Response**: City info with available services

#### 2. Create Quotation (Immediate)
```typescript
POST /api/v1/lalamove/quotations
```
**Purpose**: Get instant delivery price quote  
**Auth**: JWT Required  
**Body**:
```json
{
  "orderId": "string (optional - link to MASH order)",
  "serviceType": "MOTORCYCLE | SEDAN | MPV | VAN",
  "stops": [
    {
      "coordinates": { "lat": "14.8140", "lng": "121.0452" },
      "address": "San Jose Del Monte, Bulacan"
    },
    {
      "coordinates": { "lat": "14.6760", "lng": "121.0437" },
      "address": "Quezon City, Metro Manila"
    }
  ],
  "item": {
    "quantity": "1",
    "weight": "LESS_THAN_3_KG",
    "categories": ["FOOD_DELIVERY"],
    "handlingInstructions": ["KEEP_UPRIGHT"]
  }
}
```

#### 3. Create Quotation (Scheduled)
```typescript
POST /api/v1/lalamove/quotations/scheduled
```
**Purpose**: Get price quote for future scheduled delivery  
**Auth**: JWT Required  
**Body**: Same as immediate + `scheduleAt: ISO8601 DateTime`

#### 4. Get Quotation Details
```typescript
GET /api/v1/lalamove/quotations/:quotationId
```
**Purpose**: Retrieve quotation details  
**Auth**: JWT Required

#### 5. Place Order
```typescript
POST /api/v1/lalamove/orders
```
**Purpose**: Create Lalamove delivery order from quotation  
**Auth**: JWT Required  
**Body**:
```json
{
  "quotationId": "string",
  "orderId": "string (MASH order ID)",
  "sender": {
    "name": "J5 Pharmacy",
    "phone": "+639123456789"
  },
  "recipients": [
    {
      "name": "Customer Name",
      "phone": "+639987654321",
      "remarks": "Order #12345\nMedicines (3 items)\nHandle with care"
    }
  ],
  "isPODEnabled": true,
  "metadata": {
    "orderId": "12345",
    "branch": "San Jose Del Monte"
  }
}
```

#### 6. Get Order Details
```typescript
GET /api/v1/lalamove/orders/:orderId
```
**Purpose**: Get current order status and tracking info  
**Auth**: JWT Required

#### 7. Get Driver Details
```typescript
GET /api/v1/lalamove/orders/:orderId/driver
```
**Purpose**: Get real-time driver info and location  
**Auth**: JWT Required  
**Note**: Only available 1hr before scheduled time or when driver arrives

#### 8. Add Priority Fee
```typescript
POST /api/v1/lalamove/orders/:orderId/priority-fee
```
**Purpose**: Add tip for faster driver matching  
**Auth**: JWT Required (Admin/Pharmacy staff)  
**Body**: `{ "priorityFee": "20" }`

#### 9. Cancel Order
```typescript
DELETE /api/v1/lalamove/orders/:orderId
```
**Purpose**: Cancel delivery order  
**Auth**: JWT Required (Admin/Pharmacy staff)  
**Constraints**: Only ASSIGNING_DRIVER status or within 5 min of matching

#### 10. Webhook Handler
```typescript
POST /api/v1/lalamove/webhook
```
**Purpose**: Receive real-time status updates from Lalamove  
**Auth**: Webhook signature verification  
**Public**: Yes (but signature-protected)  
**Events**: ORDER_STATUS_CHANGED, DRIVER_ASSIGNED, PICKED_UP, COMPLETED, CANCELED

#### 11. Setup Webhook (Admin)
```typescript
PATCH /api/v1/lalamove/webhook/setup
```
**Purpose**: Configure webhook URL with Lalamove  
**Auth**: JWT Required (Admin only)  
**Body**: `{ "webhookUrl": "https://mash-backend.com/api/v1/lalamove/webhook" }`

---

## 🔐 Authentication & Security

### HMAC Signature Generation

Lalamove uses HMAC SHA-256 signatures for authentication.

```typescript
// services/lalamove-api.service.ts
private generateSignature(
  method: string,
  path: string,
  timestamp: string,
  body: string = ''
): string {
  // Raw signature format with \r\n
  const rawSignature = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;
  
  // Generate HMAC SHA256
  const signature = crypto
    .createHmac('sha256', this.configService.get('LALAMOVE_SECRET'))
    .update(rawSignature)
    .digest('hex');
  
  return signature;
}

private getAuthHeader(
  method: string,
  path: string,
  body?: any
): string {
  const apiKey = this.configService.get('LALAMOVE_API_KEY');
  const timestamp = Date.now().toString();
  const bodyString = body ? JSON.stringify(body) : '';
  
  const signature = this.generateSignature(method, path, timestamp, bodyString);
  
  return `hmac ${apiKey}:${timestamp}:${signature}`;
}
```

### Webhook Signature Verification

```typescript
// guards/webhook-signature.guard.ts
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-lalamove-signature'];
    const timestamp = request.headers['x-lalamove-timestamp'];
    const body = JSON.stringify(request.body);
    
    // Verify timestamp (within 5 minutes)
    const now = Date.now();
    const requestTime = parseInt(timestamp) * 1000;
    if (Math.abs(now - requestTime) > 300000) {
      throw new UnauthorizedException('Webhook timestamp expired');
    }
    
    // Verify signature
    const expectedSignature = this.generateWebhookSignature(timestamp, body);
    
    return signature === expectedSignature;
  }
}
```

---

## 📝 DTO Definitions

### Create Quotation DTO
```typescript
// dto/create-quotation.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CoordinatesDto {
  @ApiProperty({ example: '14.8140', description: 'Latitude' })
  @IsString()
  lat: string;

  @ApiProperty({ example: '121.0452', description: 'Longitude' })
  @IsString()
  lng: string;
}

export class StopDto {
  @ApiProperty({ type: CoordinatesDto })
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates: CoordinatesDto;

  @ApiProperty({ example: 'San Jose Del Monte, Bulacan' })
  @IsString()
  address: string;
}

export class ItemDto {
  @ApiProperty({ example: '1', description: 'Number of items' })
  @IsString()
  quantity: string;

  @ApiProperty({ 
    enum: ['LESS_THAN_3_KG', '3_TO_5_KG', '5_TO_10_KG', '10_TO_15_KG', '15_TO_20_KG'],
    example: 'LESS_THAN_3_KG'
  })
  @IsEnum(['LESS_THAN_3_KG', '3_TO_5_KG', '5_TO_10_KG', '10_TO_15_KG', '15_TO_20_KG'])
  weight: string;

  @ApiProperty({ 
    example: ['FOOD_DELIVERY'],
    description: 'Item categories',
    isArray: true
  })
  @IsArray()
  @IsString({ each: true })
  categories: string[];

  @ApiProperty({ 
    example: ['KEEP_UPRIGHT'],
    description: 'Handling instructions',
    isArray: true,
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  handlingInstructions?: string[];
}

export class CreateQuotationDto {
  @ApiProperty({ 
    enum: ['MOTORCYCLE', 'SEDAN', 'MPV', 'VAN'],
    example: 'MOTORCYCLE',
    description: 'Vehicle service type'
  })
  @IsEnum(['MOTORCYCLE', 'SEDAN', 'MPV', 'VAN'])
  serviceType: string;

  @ApiProperty({ 
    type: [StopDto],
    description: 'Pickup and delivery stops',
    minItems: 2,
    maxItems: 10
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StopDto)
  stops: StopDto[];

  @ApiProperty({ type: ItemDto })
  @ValidateNested()
  @Type(() => ItemDto)
  item: ItemDto;

  @ApiProperty({ 
    example: 'ORDER-12345',
    description: 'Optional MASH order ID to link quotation',
    required: false
  })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({ 
    example: '2025-11-18T12:00:00.000Z',
    description: 'Schedule time for delivery (ISO 8601 format)',
    required: false
  })
  @IsOptional()
  @IsString()
  scheduleAt?: string;
}
```

### Create Order DTO
```typescript
// dto/create-order.dto.ts
export class SenderDto {
  @ApiProperty({ description: 'Stop ID from quotation' })
  @IsString()
  stopId: string;

  @ApiProperty({ example: 'J5 Pharmacy' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+639123456789' })
  @IsString()
  phone: string;
}

export class RecipientDto {
  @ApiProperty({ description: 'Stop ID from quotation' })
  @IsString()
  stopId: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+639987654321' })
  @IsString()
  phone: string;

  @ApiProperty({ 
    example: 'Order #12345\nMedicines\nHandle with care',
    required: false
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Lalamove quotation ID' })
  @IsString()
  quotationId: string;

  @ApiProperty({ description: 'MASH order ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ type: SenderDto })
  @ValidateNested()
  @Type(() => SenderDto)
  sender: SenderDto;

  @ApiProperty({ type: [RecipientDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients: RecipientDto[];

  @ApiProperty({ 
    example: true,
    description: 'Enable Proof of Delivery',
    default: true
  })
  @IsBoolean()
  @IsOptional()
  isPODEnabled?: boolean;

  @ApiProperty({ 
    example: { orderId: '12345', branch: 'SJDM' },
    description: 'Custom metadata',
    required: false
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
```

### Response DTOs
```typescript
// dto/quotation-response.dto.ts
export class QuotationResponseDto {
  @ApiProperty()
  quotationId: string;

  @ApiProperty()
  serviceType: string;

  @ApiProperty({ type: 'object' })
  priceBreakdown: {
    total: string;
    currency: string;
    base: string;
    surge?: string;
  };

  @ApiProperty({ type: 'object' })
  distance: {
    value: string;
    unit: string;
  };

  @ApiProperty()
  expiresAt: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  stops: Array<{
    stopId: string;
    coordinates: { lat: string; lng: string };
    address: string;
  }>;

  @ApiProperty({ required: false })
  scheduleAt?: string;
}

// dto/order-response.dto.ts
export class OrderResponseDto {
  @ApiProperty()
  orderId: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  driverId?: string;

  @ApiProperty()
  shareLink: string;

  @ApiProperty({ type: 'object' })
  priceBreakdown: {
    total: string;
    currency: string;
    priorityFee?: string;
  };

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  stops: Array<any>;

  @ApiProperty({ required: false })
  scheduleAt?: string;
}
```

---

## 🔧 Service Implementation

### Core Service Methods

```typescript
// services/lalamove-api.service.ts
@Injectable()
export class LalamoveApiService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly secret: string;
  private readonly market = 'PH';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl = this.configService.get('LALAMOVE_BASE_URL');
    this.apiKey = this.configService.get('LALAMOVE_API_KEY');
    this.secret = this.configService.get('LALAMOVE_SECRET');
  }

  async getCityInfo(): Promise<any> {
    return this.makeRequest('GET', '/v3/cities');
  }

  async createQuotation(data: any): Promise<any> {
    return this.makeRequest('POST', '/v3/quotations', data);
  }

  async getQuotation(quotationId: string): Promise<any> {
    return this.makeRequest('GET', `/v3/quotations/${quotationId}`);
  }

  async createOrder(data: any): Promise<any> {
    return this.makeRequest('POST', '/v3/orders', data);
  }

  async getOrder(orderId: string): Promise<any> {
    return this.makeRequest('GET', `/v3/orders/${orderId}`);
  }

  async getDriver(orderId: string, driverId: string): Promise<any> {
    return this.makeRequest('GET', `/v3/orders/${orderId}/drivers/${driverId}`);
  }

  async addPriorityFee(orderId: string, priorityFee: string): Promise<any> {
    return this.makeRequest('POST', `/v3/orders/${orderId}/priority-fee`, {
      data: { priorityFee }
    });
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.makeRequest('DELETE', `/v3/orders/${orderId}`);
  }

  async setupWebhook(webhookUrl: string): Promise<any> {
    return this.makeRequest('PATCH', '/v3/webhook', {
      data: { url: webhookUrl }
    });
  }

  private async makeRequest(
    method: string,
    path: string,
    body?: any
  ): Promise<any> {
    const timestamp = Date.now().toString();
    const bodyString = body ? JSON.stringify(body) : '';
    
    const signature = this.generateSignature(method, path, timestamp, bodyString);
    const authHeader = `hmac ${this.apiKey}:${timestamp}:${signature}`;

    const headers = {
      'Authorization': authHeader,
      'Market': this.market,
      'Content-Type': 'application/json',
      'Request-ID': uuidv4(),
    };

    try {
      const response = await this.httpService.axiosRef.request({
        method,
        url: `${this.baseUrl}${path}`,
        headers,
        data: body,
      });

      return response.data;
    } catch (error) {
      this.handleApiError(error);
    }
  }

  private generateSignature(
    method: string,
    path: string,
    timestamp: string,
    body: string = ''
  ): string {
    const rawSignature = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;
    return crypto
      .createHmac('sha256', this.secret)
      .update(rawSignature)
      .digest('hex');
  }

  private handleApiError(error: any): never {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    
    switch (status) {
      case 400:
        throw new BadRequestException(`Lalamove: ${message}`);
      case 401:
        throw new UnauthorizedException('Lalamove: Invalid credentials');
      case 403:
        throw new ForbiddenException(`Lalamove: ${message}`);
      case 404:
        throw new NotFoundException(`Lalamove: ${message}`);
      case 409:
        throw new ConflictException(`Lalamove: ${message}`);
      case 422:
        throw new BadRequestException(`Lalamove: ${message}`);
      default:
        throw new InternalServerErrorException(`Lalamove API error: ${message}`);
    }
  }
}
```

---

## 🔔 Webhook Integration

### Webhook Event Handling

```typescript
// services/webhook.service.ts
@Injectable()
export class LalamoveWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly logger: Logger,
  ) {}

  async handleWebhookEvent(event: WebhookEventDto): Promise<void> {
    const { orderId, status, timestamp, data } = event;

    this.logger.log(`Webhook received: Order ${orderId} → ${status}`);

    // Update database
    await this.updateOrderStatus(orderId, status, data);

    // Trigger notifications based on status
    await this.sendNotifications(orderId, status, data);

    // Update metrics
    this.updateMetrics(status);
  }

  private async updateOrderStatus(
    orderId: string,
    status: string,
    data: any
  ): Promise<void> {
    await this.prisma.lalamoveOrder.update({
      where: { orderId },
      data: {
        status,
        statusHistory: {
          push: {
            status,
            timestamp: new Date(),
            data
          }
        },
        ...(status === 'PICKED_UP' && { pickedUpAt: new Date() }),
        ...(status === 'COMPLETED' && { deliveredAt: new Date() }),
        ...(status === 'CANCELED' && { cancelledAt: new Date() }),
        ...(data.driverId && { driverId: data.driverId }),
        ...(data.driverName && { driverName: data.driverName }),
        ...(data.coordinates && { currentLocation: data.coordinates }),
        webhookEvents: {
          push: {
            status,
            timestamp: new Date(),
            rawData: data
          }
        }
      }
    });
  }

  private async sendNotifications(
    orderId: string,
    status: string,
    data: any
  ): Promise<void> {
    const order = await this.prisma.lalamoveOrder.findUnique({
      where: { orderId },
      include: { mashOrder: { include: { user: true } } }
    });

    if (!order) return;

    const statusMessages = {
      'ASSIGNING_DRIVER': '🔍 Finding a driver for your order',
      'ON_GOING': '🚗 Driver is on the way to pickup',
      'PICKED_UP': '📦 Your order has been picked up!',
      'COMPLETED': '✅ Delivered successfully!',
      'CANCELED': '❌ Delivery cancelled',
    };

    const message = statusMessages[status] || `Order status: ${status}`;
    const user = order.mashOrder.user;

    // Send push notification
    await this.notificationService.sendPushNotification(user.id, {
      title: 'Delivery Update',
      body: message,
      data: {
        orderId: order.mashOrderId,
        lalamoveOrderId: orderId,
        status,
        trackingLink: order.shareLink
      }
    });

    // Send email for important statuses
    if (['PICKED_UP', 'COMPLETED', 'CANCELED'].includes(status)) {
      await this.notificationService.sendEmail(user.email, {
        subject: `Order ${order.mashOrderId} - ${status}`,
        template: 'delivery-status-update',
        context: {
          userName: user.name,
          orderId: order.mashOrderId,
          status: message,
          trackingLink: order.shareLink,
          driverName: order.driverName,
          driverPhone: order.driverPhone,
        }
      });
    }
  }
}
```

### Webhook Controller

```typescript
// lalamove.controller.ts - Webhook endpoint
@Post('webhook')
@UseGuards(WebhookSignatureGuard)
@ApiTags('lalamove-webhooks')
@ApiOperation({ summary: 'Receive Lalamove webhook events' })
@ApiResponse({ status: 200, description: 'Webhook processed' })
async handleWebhook(@Body() event: WebhookEventDto): Promise<void> {
  await this.webhookService.handleWebhookEvent(event);
}
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// tests/lalamove.service.spec.ts
describe('LalamoveService', () => {
  it('should create quotation with correct parameters', async () => {
    const dto: CreateQuotationDto = { /* ... */ };
    const result = await service.createQuotation(dto);
    
    expect(result.quotationId).toBeDefined();
    expect(result.priceBreakdown.currency).toBe('PHP');
  });

  it('should create order from valid quotation', async () => {
    const orderDto: CreateOrderDto = { /* ... */ };
    const result = await service.createOrder(orderDto);
    
    expect(result.orderId).toBeDefined();
    expect(result.status).toBe('ASSIGNING_DRIVER');
  });

  it('should throw error for expired quotation', async () => {
    await expect(service.createOrder(expiredQuotationDto))
      .rejects.toThrow(BadRequestException);
  });
});
```

### E2E Tests

```typescript
// tests/lalamove.e2e-spec.ts
describe('Lalamove E2E', () => {
  it('Complete delivery flow', async () => {
    // 1. Create quotation
    const quotation = await request(app.getHttpServer())
      .post('/api/v1/lalamove/quotations')
      .send(quotationDto)
      .expect(201);

    // 2. Create order
    const order = await request(app.getHttpServer())
      .post('/api/v1/lalamove/orders')
      .send({ quotationId: quotation.body.quotationId, ...orderDto })
      .expect(201);

    // 3. Check order status
    const status = await request(app.getHttpServer())
      .get(`/api/v1/lalamove/orders/${order.body.orderId}`)
      .expect(200);

    expect(status.body.status).toBeDefined();
  });
});
```

---

## 🚀 Deployment Checklist

### Environment Variables

```bash
# .env
LALAMOVE_BASE_URL=https://rest.sandbox.lalamove.com  # or production URL
LALAMOVE_API_KEY=pk_test_8611e4fa8a2f51f6664d26aded0e5d2b
LALAMOVE_SECRET=sk_test_KeCmtaJPeTEUwiP1N+upaT/2IH1Ckqqmd23db8+hVJnaysSpQVkRdbzIm2LlDztq
LALAMOVE_MARKET=PH
LALAMOVE_WEBHOOK_URL=https://mash-backend.herokuapp.com/api/v1/lalamove/webhook
```

### Prisma Migration

```bash
# Generate migration
npx prisma migrate dev --name add_lalamove_tables

# Generate Prisma client
npx prisma generate
```

### Webhook Setup

```bash
# After deployment, configure webhook
curl -X PATCH https://mash-backend.herokuapp.com/api/v1/lalamove/webhook/setup \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -d '{"webhookUrl": "https://mash-backend.herokuapp.com/api/v1/lalamove/webhook"}'
```

---

## 📊 Monitoring & Metrics

### Prometheus Metrics

```typescript
// Metrics to track
- lalamove_quotations_created_total
- lalamove_orders_created_total
- lalamove_orders_completed_total
- lalamove_orders_cancelled_total
- lalamove_api_requests_total
- lalamove_api_errors_total
- lalamove_webhook_events_total
- lalamove_average_delivery_time
```

### Logging

```typescript
// Log important events
- Quotation created/expired
- Order placed/cancelled
- Driver assigned
- Delivery completed
- Webhook events received
- API errors
```

---

## 📈 Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create module structure
- [ ] Implement HMAC signature generation
- [ ] Create LalamoveApiService
- [ ] Add Prisma models
- [ ] Generate migrations

### Phase 2: Quotation Management (Week 1)
- [ ] Implement quotation endpoints
- [ ] Add DTOs with validation
- [ ] Add Swagger documentation
- [ ] Write unit tests
- [ ] Test with Postman

### Phase 3: Order Management (Week 2)
- [ ] Implement order creation
- [ ] Add order tracking
- [ ] Implement driver details
- [ ] Add priority fee feature
- [ ] Add cancellation logic

### Phase 4: Webhook Integration (Week 2)
- [ ] Implement webhook handler
- [ ] Add signature verification
- [ ] Integrate with notification system
- [ ] Test webhook events

### Phase 5: Testing & Documentation (Week 3)
- [ ] Complete E2E tests
- [ ] Load testing
- [ ] Update API documentation
- [ ] Create user guide
- [ ] Deploy to staging

### Phase 6: Production Launch (Week 3)
- [ ] Production credentials
- [ ] Setup monitoring
- [ ] Configure webhooks
- [ ] Go live
- [ ] Monitor and optimize

---

## 🎓 Reference Documentation

- **Lalamove API Docs**: https://developers.lalamove.com/
- **Postman Collection**: `/postman/MASH-Lalamove-PH.postman_collection.json`
- **Environment**: `/postman/PH.postman_environment.json`
- **MASH Backend**: `README.md`, `copilot-instructions.md`

---

## ⚠️ Important Notes

1. **Quotation Expiry**: Quotations expire in 5 minutes - must create order within this timeframe
2. **Driver Info**: Only available 1 hour before scheduled time or when driver arrives
3. **Cancellation Window**: Orders can only be cancelled in ASSIGNING_DRIVER status or within 5 minutes of matching
4. **Webhook Signature**: Always verify webhook signatures to prevent fraud
5. **Sandbox vs Production**: Test thoroughly in sandbox before production
6. **Rate Limits**: Monitor API rate limits and implement backoff strategies
7. **Coordinates**: Must use accurate lat/lng for pricing accuracy
8. **Phone Numbers**: Must be in E.164 format (+639XXXXXXXXX)

---

**Next Steps**: Review this plan → Approve → Begin Phase 1 implementation

**Estimated Timeline**: 3 weeks  
**Developer Resources**: 1-2 developers  
**Priority**: High (enables core delivery functionality)
