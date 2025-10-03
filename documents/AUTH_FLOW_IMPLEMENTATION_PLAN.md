# MASH Backend Authentication Flow Implementation Plan

## Overview
This document outlines the comprehensive plan to implement a complete authentication flow with email verification for the MASH backend system. The implementation will include Firebase-first authentication, email verification codes, secure token management, and full testing infrastructure.

## Current State Analysis
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL (Neon.tech)
- **ORM**: Prisma
- **Authentication**: Firebase Authentication with Admin SDK
- **Queue System**: BullMQ with Redis
- **Email Service**: SMTP via Gmail
- **Testing**: Jest for unit tests, Newman for API testing

## Environment Variables Configuration
Based on the provided `.env` file, the following variables are configured:

```properties
# Database
DATABASE_URL="postgresql://neondb_owner:npg_B4tIx6OCXiDN@ep-wispy-dream-aduaegct-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Firebase Configuration
FIREBASE_PROJECT_ID="mash-5b627"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-fbsvc@mash-5b627.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="[REDACTED FOR SECURITY]"
FIREBASE_AUTH_EMULATOR_HOST="http://127.0.0.1:9099"

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=MASH.Mushroom.Automation@gmail.com
EMAIL_PASSWORD="[REDACTED FOR SECURITY]"
EMAIL_FROM=MASH Mushroom Automation <MASH.Mushroom.Automation@gmail.com>

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Database Schema Implementation

### Users Table Schema
```sql
-- User and Security Enums
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'hr', 'user');
CREATE TYPE auth_provider AS ENUM ('local', 'google', 'microsoft');

-- USERS TABLE 
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    
    -- Personal Info
    first_name VARCHAR(58) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(58) NOT NULL,
    suffix VARCHAR(10),
    email VARCHAR(255) UNIQUE NOT NULL,
    
    -- Authentication & Security
    password_hash VARCHAR(255),
    password_algorithm VARCHAR(50) DEFAULT 'bcrypt',
    password_salt VARCHAR(255),
    password_iterations INTEGER DEFAULT 10,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    role user_role NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    verification_token_expires TIMESTAMPTZ,
    google_id VARCHAR(255) UNIQUE,
    profile_picture_url VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Password Reset
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMPTZ,
    
    -- Security Logging
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    last_login_ip VARCHAR(45),
    device_info TEXT,

    -- Security constraint on failed login attempts
    CONSTRAINT check_failed_login_attempts CHECK (failed_login_attempts >= 0 AND failed_login_attempts <= 10)
);

-- GROUPS TABLE (if not exists)
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Prisma Schema Updates
Update `prisma/schema.prisma` to include the new fields:

```prisma
model User {
  id                        Int      @id @default(autoincrement())
  groupId                   Int?
  firstName                 String   @db.VarChar(58)
  middleName                String?  @db.VarChar(50)
  lastName                  String   @db.VarChar(58)
  suffix                    String?  @db.VarChar(10)
  email                     String   @unique @db.VarChar(255)
  passwordHash              String?  @db.VarChar(255)
  passwordAlgorithm         String?  @default("bcrypt") @db.VarChar(50)
  passwordSalt              String?  @db.VarChar(255)
  passwordIterations        Int?     @default(10)
  mfaEnabled                Boolean  @default(false)
  mfaSecret                 String?  @db.VarChar(255)
  role                      UserRole @default(USER)
  isActive                  Boolean  @default(true)
  emailVerified             Boolean  @default(false)
  verificationToken         String?  @db.VarChar(255)
  verificationTokenExpires  DateTime? @db.Timestamptz
  googleId                  String?  @unique @db.VarChar(255)
  profilePictureUrl         String?  @db.VarChar(512)
  createdAt                 DateTime @default(now()) @db.Timestamptz
  updatedAt                 DateTime @updatedAt @db.Timestamptz
  resetPasswordToken        String?  @db.VarChar(255)
  resetPasswordExpires      DateTime? @db.Timestamptz
  failedLoginAttempts       Int      @default(0)
  lockedUntil               DateTime? @db.Timestamptz
  lastLogin                 DateTime? @db.Timestamptz
  lastLoginIp               String?  @db.VarChar(45)
  deviceInfo                String?  @db.Text
  group                     Group?   @relation(fields: [groupId], references: [id])

  @@map("users")
}

model Group {
  id          Int      @id @default(autoincrement())
  name        String   @unique @db.VarChar(100)
  description String?  @db.Text
  createdAt   DateTime @default(now()) @db.Timestamptz
  updatedAt   DateTime @updatedAt @db.Timestamptz
  users       User[]

  @@map("groups")
}

enum UserRole {
  ADMIN
  MANAGER
  HR
  USER
}

enum AuthProvider {
  LOCAL
  GOOGLE
  MICROSOFT
}
```

## Backend Implementation Plan

### 1. Firebase Admin Service
**File**: `src/auth/firebase-admin.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService {
  private app: admin.app.App;

  constructor() {
    this.app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }

  async verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
    return this.app.auth().verifyIdToken(token);
  }

  async getUser(uid: string): Promise<admin.auth.UserRecord> {
    return this.app.auth().getUser(uid);
  }
}
```

### 2. Auth Service Implementation
**File**: `src/auth/auth.service.ts`

```typescript
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { EmailQueueService } from '../queue/email-queue.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private firebaseAdmin: FirebaseAdminService,
    private emailQueue: EmailQueueService,
  ) {}

  async exchangeIdToken(idToken: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    try {
      const decodedToken = await this.firebaseAdmin.verifyIdToken(idToken);
      const firebaseUser = await this.firebaseAdmin.getUser(decodedToken.uid);

      let user = await this.prisma.user.findUnique({
        where: { email: firebaseUser.email },
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email: firebaseUser.email!,
            firstName: firebaseUser.displayName?.split(' ')[0] || '',
            lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
            googleId: firebaseUser.uid,
            profilePictureUrl: firebaseUser.photoURL,
            emailVerified: firebaseUser.emailVerified,
          },
        });
      }

      // Generate verification code if email not verified
      if (!user.emailVerified) {
        await this.sendVerificationCode(user.id);
      }

      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      return { accessToken, refreshToken, user };
    } catch (error) {
      throw new UnauthorizedException('Invalid Firebase token');
    }
  }

  async sendVerificationCode(userId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const code = randomBytes(3).toString('hex').toUpperCase();
    const hashedCode = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        verificationToken: hashedCode,
        verificationTokenExpires: expiresAt,
      },
    });

    await this.emailQueue.sendVerificationEmail(user.email, code);
  }

  async verifyCode(userId: number, code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.verificationToken || !user.verificationTokenExpires) {
      throw new BadRequestException('No verification code requested');
    }

    if (user.verificationTokenExpires < new Date()) {
      throw new BadRequestException('Verification code expired');
    }

    const isValid = await bcrypt.compare(code, user.verificationToken);
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return { accessToken, refreshToken };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Implement JWT refresh token logic
    // This would involve validating the refresh token and generating new tokens
    throw new Error('Not implemented');
  }

  private generateAccessToken(user: any): string {
    // Implement JWT access token generation
    return 'access_token_placeholder';
  }

  private generateRefreshToken(user: any): string {
    // Implement JWT refresh token generation
    return 'refresh_token_placeholder';
  }
}
```

### 3. Auth Controller Implementation
**File**: `src/auth/auth.controller.ts`

```typescript
import { Controller, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('exchange')
  async exchangeIdToken(@Body('idToken') idToken: string) {
    return this.authService.exchangeIdToken(idToken);
  }

  @Post('send-verification/:userId')
  async sendVerificationCode(@Param('userId', ParseIntPipe) userId: number) {
    await this.authService.sendVerificationCode(userId);
    return { message: 'Verification code sent' };
  }

  @Post('verify-code')
  async verifyCode(@Body() body: { userId: number; code: string }) {
    return this.authService.verifyCode(body.userId, body.code);
  }

  @Post('refresh')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
}
```

### 4. Email Queue Service
**File**: `src/queue/email-queue.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    await this.emailQueue.add('send-verification', { email, code });
  }
}
```

### 5. Email Processor
**File**: `src/queue/email.processor.ts`

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';

@Injectable()
@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    super();
    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async process(job: Job<{ email: string; code: string }>): Promise<void> {
    const { email, code } = job.data;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>MASH Email Verification</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 24px; font-weight: bold; color: #007bff; padding: 10px; border: 1px solid #007bff; display: inline-block;">
          ${code}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
      </div>
    `;

    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'MASH Email Verification Code',
      html,
    });

    this.logger.log(`Verification email sent to ${email}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${err.message}`);
  }
}
```

### 6. Module Configuration
**File**: `src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { FirebaseAdminService } from './firebase-admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [AuthController],
  providers: [AuthService, FirebaseAdminService],
  exports: [AuthService, FirebaseAdminService],
})
export class AuthModule {}
```

**File**: `src/queue/queue.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmailQueueService } from './email-queue.service';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  providers: [EmailQueueService, EmailProcessor],
  exports: [EmailQueueService],
})
export class QueueModule {}
```

## Postman Collection Implementation

### Collection Structure
Create `postman/MASH-backend-auth.postman_collection.json`:

```json
{
  "info": {
    "name": "MASH Backend Auth",
    "description": "Authentication flow with email verification",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000",
      "type": "string"
    },
    {
      "key": "firebaseIdToken",
      "value": "",
      "type": "string"
    },
    {
      "key": "accessToken",
      "value": "",
      "type": "string"
    },
    {
      "key": "refreshToken",
      "value": "",
      "type": "string"
    },
    {
      "key": "userId",
      "value": "",
      "type": "string"
    }
  ],
  "item": [
    {
      "name": "Exchange Firebase ID Token",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"idToken\": \"{{firebaseIdToken}}\"}"
        },
        "url": {
          "raw": "{{baseUrl}}/auth/exchange",
          "host": ["{{baseUrl}}"],
          "path": ["auth", "exchange"]
        }
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test(\"Status code is 200\", function () {",
              "    pm.response.to.have.status(200);",
              "});",
              "",
              "pm.test(\"Response has access token\", function () {",
              "    var jsonData = pm.response.json();",
              "    pm.expect(jsonData).to.have.property('accessToken');",
              "    pm.expect(jsonData).to.have.property('refreshToken');",
              "    pm.expect(jsonData).to.have.property('user');",
              "    ",
              "    pm.collectionVariables.set('accessToken', jsonData.accessToken);",
              "    pm.collectionVariables.set('refreshToken', jsonData.refreshToken);",
              "    pm.collectionVariables.set('userId', jsonData.user.id);",
              "});"
            ],
            "type": "text/javascript"
          }
        }
      ]
    },
    {
      "name": "Send Verification Code",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{accessToken}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/auth/send-verification/{{userId}}",
          "host": ["{{baseUrl}}"],
          "path": ["auth", "send-verification", "{{userId}}"]
        }
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test(\"Status code is 200\", function () {",
              "    pm.response.to.have.status(200);",
              "});"
            ],
            "type": "text/javascript"
          }
        }
      ]
    },
    {
      "name": "Verify Email Code",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"userId\": \"{{userId}}\", \"code\": \"123456\"}"
        },
        "url": {
          "raw": "{{baseUrl}}/auth/verify-code",
          "host": ["{{baseUrl}}"],
          "path": ["auth", "verify-code"]
        }
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test(\"Status code is 200\", function () {",
              "    pm.response.to.have.status(200);",
              "});",
              "",
              "pm.test(\"Response has new tokens\", function () {",
              "    var jsonData = pm.response.json();",
              "    pm.expect(jsonData).to.have.property('accessToken');",
              "    pm.expect(jsonData).to.have.property('refreshToken');",
              "});"
            ],
            "type": "text/javascript"
          }
        }
      ]
    }
  ]
}
```

## Automated Testing Implementation

### Unit Tests
**File**: `src/auth/auth.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { EmailQueueService } from '../queue/email-queue.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: FirebaseAdminService,
          useValue: {
            verifyIdToken: jest.fn(),
            getUser: jest.fn(),
          },
        },
        {
          provide: EmailQueueService,
          useValue: {
            sendVerificationEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### E2E Tests
**File**: `test/auth.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/auth/exchange (POST)', () => {
    return request(app.getHttpServer())
      .post('/auth/exchange')
      .send({ idToken: 'valid-firebase-token' })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body).toHaveProperty('refreshToken');
        expect(res.body).toHaveProperty('user');
      });
  });
});
```

## CI/CD Pipeline Setup

### GitHub Actions Workflow
**File**: `.github/workflows/test.yml`

```yaml
name: Test and Deploy

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:6-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run Prisma migrations
      run: npx prisma migrate deploy
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
    
    - name: Run tests
      run: npm run test:e2e
    
    - name: Run Postman tests
      run: |
        npm install -g newman
        newman run postman/MASH-backend-auth.postman_collection.json \
          --environment postman/MASH-backend.postman_environment.json \
          --reporters cli,json \
          --reporter-json-export newman-results.json
```

## Environment Setup Instructions

### Local Development Setup

1. **Install Dependencies**:
   ```bash
   npm install @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/config \
              @prisma/client prisma @nestjs/bull bull nodemailer bcrypt @types/bcrypt \
              firebase-admin @nestjs/jwt @nestjs/passport passport passport-jwt \
              @types/passport-jwt class-validator class-transformer
   ```

2. **Database Setup**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Redis Setup**:
   - Ensure Redis is running on localhost:6379
   - For Windows: Use the provided Redis binaries in the `redis/` folder

4. **Firebase Setup**:
   - Ensure Firebase project is configured
   - Set up Firebase Authentication
   - Configure service account credentials in `.env`

5. **Email Setup**:
   - Configure Gmail SMTP settings
   - Enable less secure app access or use app passwords

### Production Environment Setup

1. **Environment Variables**:
   - Set all production values in `.env`
   - Use secure secret management (AWS Secrets Manager, etc.)

2. **Database**:
   - Use Neon.tech PostgreSQL instance
   - Run migrations: `npx prisma migrate deploy`

3. **Redis**:
   - Use managed Redis service (Redis Labs, AWS ElastiCache, etc.)

4. **Firebase**:
   - Use production Firebase project
   - Configure proper security rules

## Implementation Timeline

### Week 1: Core Infrastructure (Days 1-2)
- [ ] **Day 1: Database Schema Setup**
  - Update `prisma/schema.prisma` with new User and Group models
  - Run `npx prisma generate` to update client
  - Run `npx prisma db push` to apply schema changes
  - Verify database tables are created correctly

- [ ] **Day 2: Firebase Integration**
  - Create `src/auth/firebase-admin.service.ts`
  - Install firebase-admin package: `npm install firebase-admin`
  - Test Firebase service account connection
  - Add Firebase module to app.module.ts

### Week 2: Authentication Flow (Days 3-5)
- [ ] **Day 3: Auth Service Foundation**
  - Create `src/auth/auth.service.ts` with basic structure
  - Implement `exchangeIdToken` method
  - Add error handling for invalid tokens
  - Create unit tests for auth service

- [ ] **Day 4: Email Verification Logic**
  - Implement `sendVerificationCode` method
  - Add bcrypt for code hashing
  - Implement `verifyCode` method with expiration checks
  - Add rate limiting for verification attempts

- [ ] **Day 5: Auth Controller & JWT**
  - Create `src/auth/auth.controller.ts`
  - Install @nestjs/jwt and configure JWT module
  - Implement `generateAccessToken` and `generateRefreshToken` methods
  - Add proper error responses and validation

### Week 3: Email & Queue System (Days 6-7)
- [ ] **Day 6: Queue Infrastructure**
  - Install @nestjs/bull and bull packages
  - Create `src/queue/queue.module.ts` and `src/queue/email-queue.service.ts`
  - Set up Redis connection and test queue functionality
  - Create `src/queue/email.processor.ts` with basic structure

- [ ] **Day 7: Email Processing**
  - Install nodemailer and configure SMTP
  - Implement email template for verification codes
  - Add error handling and retry logic for email sending
  - Test email delivery with mock data

### Week 4: Testing & Deployment (Days 8-10)
- [ ] **Day 8: Postman Collection**
  - Create `postman/MASH-backend-auth.postman_collection.json`
  - Add environment variables and test scripts
  - Test collection with local server
  - Document collection usage and setup

- [ ] **Day 9: Automated Testing**
  - Write comprehensive unit tests for all services
  - Create E2E tests for auth endpoints
  - Set up Jest configuration for coverage reporting
  - Test email queue processing

- [ ] **Day 10: CI/CD & Deployment**
  - Create `.github/workflows/test.yml`
  - Configure Newman for Postman collection testing
  - Test complete CI/CD pipeline
  - Deploy to staging environment and verify functionality

## Prerequisites Checklist

### Environment Setup
- [ ] Node.js 18+ installed
- [ ] PostgreSQL database (Neon.tech) configured
- [ ] Redis server running locally
- [ ] Firebase project created with Authentication enabled
- [ ] Gmail account configured for SMTP
- [ ] Service account key downloaded from Firebase

### Dependencies Installation
```bash
npm install @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/config \
           @prisma/client prisma @nestjs/bull bull nodemailer bcrypt @types/bcrypt \
           firebase-admin @nestjs/jwt @nestjs/passport passport passport-jwt \
           @types/passport-jwt class-validator class-transformer jest @types/jest \
           supertest @types/supertest
```

### Database Preparation
- [ ] Run database migrations
- [ ] Verify user and group tables exist
- [ ] Test database connectivity from application

### External Services
- [ ] Firebase Authentication configured
- [ ] SMTP email service tested
- [ ] Redis queue system operational

## Detailed Implementation Steps

### Step 1: Update Prisma Schema
1. Open `prisma/schema.prisma`
2. Replace the existing User model with the new schema
3. Add the Group model
4. Add UserRole and AuthProvider enums
5. Run `npx prisma generate`
6. Run `npx prisma db push`

### Step 2: Implement Firebase Admin Service
1. Create `src/auth/firebase-admin.service.ts`
2. Copy the implementation from the plan
3. Add proper error handling
4. Test with Firebase emulator if available

### Step 3: Create Auth Service
1. Create `src/auth/auth.service.ts`
2. Implement all methods with proper error handling
3. Add input validation using class-validator
4. Write unit tests for each method

### Step 4: Set Up Email Queue
1. Install BullMQ dependencies
2. Create queue module and services
3. Configure Redis connection
4. Test queue operations

### Step 5: Implement Email Processing
1. Configure Nodemailer with Gmail SMTP
2. Create HTML email template
3. Add retry logic and error handling
4. Test email sending functionality

### Step 6: Create Auth Controller
1. Create `src/auth/auth.controller.ts`
2. Add all endpoints with proper decorators
3. Implement request/response DTOs
4. Add authentication guards if needed

### Step 7: JWT Token Implementation
1. Configure @nestjs/jwt module
2. Implement token generation and validation
3. Add refresh token logic
4. Secure token storage and transmission

### Step 8: Postman Collection Creation
1. Create collection JSON file
2. Add all auth endpoints
3. Configure test scripts for validation
4. Add environment variables

### Step 9: Testing Implementation
1. Write unit tests for all services
2. Create E2E tests for API endpoints
3. Test email queue processing
4. Run Postman collection via Newman

### Step 10: CI/CD Setup
1. Create GitHub Actions workflow
2. Configure PostgreSQL and Redis services
3. Add Newman for API testing
4. Set up deployment to staging

## Risk Mitigation

### Technical Risks
- **Firebase Token Validation**: Implement proper error handling for expired/invalid tokens
- **Email Delivery**: Add fallback email providers and monitoring
- **Database Connection**: Implement connection pooling and retry logic
- **Redis Queue**: Add queue monitoring and dead letter queues

### Security Risks
- **Token Exposure**: Use HTTPS only, implement token rotation
- **Rate Limiting**: Add rate limiting to prevent abuse
- **Data Validation**: Validate all inputs to prevent injection attacks
- **Secret Management**: Use environment variables and secure key storage

### Operational Risks
- **Email Service Downtime**: Implement email queue persistence and retry
- **Database Performance**: Monitor query performance and add indexes
- **Memory Usage**: Monitor Redis memory usage and queue sizes
- **API Rate Limits**: Implement proper rate limiting and backoff strategies

## Success Criteria

### Functional Requirements
- [ ] User can authenticate via Firebase ID token
- [ ] Email verification codes are sent successfully
- [ ] Users can verify their email addresses
- [ ] JWT tokens are generated and validated correctly
- [ ] Refresh token functionality works
- [ ] All endpoints return proper HTTP status codes

### Testing Requirements
- [ ] Unit test coverage > 80%
- [ ] All E2E tests pass
- [ ] Postman collection runs successfully
- [ ] CI/CD pipeline passes all tests
- [ ] Manual testing confirms functionality

### Performance Requirements
- [ ] Authentication response time < 2 seconds
- [ ] Email sending completes within 5 seconds
- [ ] Database queries execute within acceptable time limits
- [ ] Queue processing handles load without backlog

### Security Requirements
- [ ] All sensitive data is properly hashed
- [ ] JWT tokens have appropriate expiration times
- [ ] Rate limiting prevents abuse
- [ ] HTTPS is enforced in production
- [ ] No sensitive data logged

## Next Steps

1. **Immediate Actions** (Start Today):
   - Update Prisma schema with new fields
   - Install required dependencies
   - Set up Firebase service account credentials
   - Test database connectivity

2. **This Week's Focus**:
   - Implement Firebase Admin Service
   - Create basic Auth Service structure
   - Set up email queue infrastructure
   - Begin writing unit tests

3. **Testing Strategy**:
   - Unit test each service method as it's implemented
   - Integration test full auth flow weekly
   - E2E test with Postman collection at end of each week
   - Performance test before deployment

4. **Deployment Checklist**:
   - Environment variables configured for all environments
   - Database migrations applied to production
   - Redis service configured and tested
   - Firebase credentials set securely
   - Email service configured and tested
   - SSL certificates installed
   - Monitoring and logging configured
   - Backup procedures documented

This updated plan provides a detailed, actionable roadmap with specific daily tasks, prerequisites, and risk mitigation strategies to ensure successful implementation of the complete authentication flow.

## Security Considerations

1. **Token Security**:
   - Use strong JWT secrets
   - Implement token expiration
   - Add refresh token rotation

2. **Rate Limiting**:
   - Implement rate limiting on auth endpoints
   - Add CAPTCHA for suspicious activity

3. **Data Protection**:
   - Hash sensitive data (passwords, tokens)
   - Use HTTPS in production
   - Implement proper CORS policies

4. **Audit Logging**:
   - Log authentication attempts
   - Track user activity
   - Implement security event monitoring

## Monitoring & Maintenance

1. **Health Checks**:
   - Database connectivity
   - Redis queue status
   - Email service availability

2. **Metrics**:
   - Authentication success/failure rates
   - Email delivery statistics
   - Queue processing metrics

3. **Alerts**:
   - Failed login attempt thresholds
   - Email delivery failures
   - Queue backlog warnings

## Next Steps

1. **Immediate Actions**:
   - Review and update Prisma schema
   - Implement Firebase Admin Service
   - Create basic Auth Service structure

2. **Testing Strategy**:
   - Unit test each service method
   - Integration test full auth flow
   - E2E test with Postman collection

3. **Deployment Checklist**:
   - Environment variables configured
   - Database migrations applied
   - Redis service running
   - Firebase credentials set
   - Email service configured

This plan provides a comprehensive roadmap for implementing a secure, scalable authentication system with email verification for the MASH backend.