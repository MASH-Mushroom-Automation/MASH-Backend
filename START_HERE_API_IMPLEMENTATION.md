# 🎯 START HERE: Complete API Implementation Guide
## 100+ Endpoints Implementation - Step-by-Step Instructions

**Date**: October 3, 2025  
**Current Status**: Phase 1 Complete ✅ | Ready to implement APIs  
**Your Mission**: Implement 130+ production-ready API endpoints  

---

## 📊 **Current Progress Dashboard**

### Phase Status
| Phase | Component | Status | Completion |
|-------|-----------|--------|------------|
| **Phase 1** | Foundation | ✅ COMPLETE | 100% |
| **Phase 2** | API Implementation | ⏳ STARTING NOW | 0% → 100% |
| **Phase 3** | Testing & QA | ⏳ Pending | 0% |

### Endpoint Implementation Progress
| Module | Endpoints | Status | Files Created |
|--------|-----------|--------|---------------|
| **Auth** | 8 | 🟡 30% (scaffolded) | 4/10 files |
| **Users** | 15 | ⏳ 0% | 0/9 files |
| **Devices** | 22 | ⏳ 0% | 0/12 files |
| **Sensors** | 18 | ⏳ 0% | 0/10 files |
| **Products** | 16 | ⏳ 0% | 0/9 files |
| **Orders** | 14 | ⏳ 0% | 0/8 files |
| **Categories** | 8 | ⏳ 0% | 0/6 files |
| **Analytics** | 10 | ⏳ 0% | 0/7 files |
| **Notifications** | 7 | ⏳ 0% | 0/6 files |
| **Admin** | 12 | ⏳ 0% | 0/8 files |
| **TOTAL** | **130** | **2%** | **4/95 files** |

---

## 🚀 **IMMEDIATE NEXT STEPS - START HERE!**

### **Step 1: Complete Authentication Module (TODAY - Oct 3-4)**

You need to create **6 new files** to complete the authentication module:

#### ✅ Already Completed Files:
1. ✅ `src/modules/auth/auth.controller.ts` - Partially done (30%)
2. ✅ `src/modules/auth/auth.service.ts` - Partially done (30%)
3. ✅ `src/modules/auth/dto/clerk-webhook.dto.ts` - Complete
4. ✅ `src/modules/auth/guards/jwt-auth.guard.ts` - Complete

#### 🔥 **FILES TO CREATE NOW:**

### **File 1: Firebase Strategy** (CRITICAL - DO THIS FIRST)

Create: `src/modules/auth/strategies/firebase.strategy.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  constructor(private configService: ConfigService) {
    super();
    
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      const privateKey = this.configService.get('FIREBASE_PRIVATE_KEY')
        ?.replace(/\\n/g, '\n');
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.configService.get('FIREBASE_PROJECT_ID'),
          clientEmail: this.configService.get('FIREBASE_CLIENT_EMAIL'),
          privateKey: privateKey,
        }),
        databaseURL: this.configService.get('FIREBASE_DATABASE_URL'),
      });
    }
  }

  async validate(req: any): Promise<any> {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        firebaseUser: decodedToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }
  }
}
```

**Save this file**, then move to File 2.

---

### **File 2: JWT Strategy** (CRITICAL)

Create: `src/modules/auth/strategies/jwt.strategy.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Verify user still exists in database
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return user; // This gets attached to req.user
  }
}
```

**Save this file**, then move to File 3.

---

### **File 3: Refresh Token DTO**

Create: `src/modules/auth/dto/refresh-token.dto.ts`

```typescript
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token to generate new access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
```

---

### **File 4: JWT Payload Interface**

Create: `src/modules/auth/interfaces/jwt-payload.interface.ts`

```typescript
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionInfo {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastActivity: Date;
}
```

---

### **File 5: Firebase Auth Guard**

Create: `src/modules/auth/guards/firebase-auth.guard.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class FirebaseAuthGuard extends AuthGuard('firebase') {}
```

---

### **File 6: Updated Auth Module**

Update: `src/modules/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { FirebaseStrategy } from './strategies/firebase.strategy';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION', '1d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, FirebaseStrategy, PrismaService],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
```

---

## 📝 **Complete Auth Controller Implementation**

Now update `src/modules/auth/auth.controller.ts` with ALL 8 endpoints:

```typescript
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { ClerkWebhookDto } from './dto/clerk-webhook.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 1. Clerk Webhook
  @Post('webhook')
  @ApiOperation({ summary: 'Handle Clerk webhook events for user sync' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  async handleClerkWebhook(@Body() payload: ClerkWebhookDto) {
    return this.authService.handleClerkWebhook(payload);
  }

  // 2. Get Current User
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired token' })
  async getCurrentUser(@Request() req) {
    return this.authService.getCurrentUser(req.user.id);
  }

  // 3. Refresh Token
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh JWT access token using refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ 
    status: 200, 
    description: 'New access token generated successfully',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 86400
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  // 4. Logout
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user and invalidate session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Request() req) {
    return this.authService.logout(req.user.id);
  }

  // 5. Get Session Info
  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current session information and permissions' })
  @ApiResponse({ 
    status: 200, 
    description: 'Session information returned',
    schema: {
      example: {
        userId: 'cuid123...',
        email: 'user@example.com',
        role: 'USER',
        permissions: ['read:profile', 'update:profile'],
        isActive: true,
        lastActivity: '2025-10-03T21:00:00.000Z'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSessionInfo(@Request() req) {
    return this.authService.getSessionInfo(req.user.id);
  }

  // 6. Verify Token
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify if a JWT token is valid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token is valid',
    schema: {
      example: {
        valid: true,
        userId: 'cuid123...',
        email: 'user@example.com',
        role: 'USER',
        expiresAt: '2025-10-04T21:00:00.000Z'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyToken(@Body() body: { token: string }) {
    if (!body.token) {
      throw new BadRequestException('Token is required');
    }
    return this.authService.verifyToken(body.token);
  }

  // 7. Get User Permissions
  @Get('permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user permissions based on role (RBAC)' })
  @ApiResponse({ 
    status: 200, 
    description: 'User permissions returned',
    schema: {
      example: {
        userId: 'cuid123...',
        role: 'GROWER',
        permissions: [
          'read:profile',
          'update:profile',
          'manage:devices',
          'view:sensors',
          'create:orders'
        ]
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserPermissions(@Request() req) {
    return this.authService.getUserPermissions(req.user.id);
  }

  // 8. Admin Impersonate User
  @Post('impersonate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Admin can impersonate another user (Admin/Super Admin only)',
    description: 'Generates a JWT token for the target user, allowing admin to access the system as that user'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        targetUserId: {
          type: 'string',
          example: 'cuid456...',
          description: 'User ID to impersonate'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Impersonation token generated successfully',
    schema: {
      example: {
        impersonationToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        targetUser: {
          id: 'cuid456...',
          email: 'target@example.com',
          role: 'USER'
        },
        adminId: 'cuid123...',
        expiresIn: 3600
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Not an admin' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Target user not found' })
  async impersonateUser(
    @Request() req,
    @Body() body: { targetUserId: string },
  ) {
    if (!body.targetUserId) {
      throw new BadRequestException('targetUserId is required');
    }
    return this.authService.impersonateUser(req.user.id, body.targetUserId);
  }
}
```

---

## ✅ **After Creating All Files**

### Test the Build:
```bash
npm run build
```

### Start Development Server:
```bash
npm run start:dev
```

### Check Swagger Documentation:
Open: http://localhost:3000/api/docs

You should see **ALL 8 Authentication endpoints** documented!

---

## 📈 **What Happens Next**

Once Auth module is complete (8 endpoints), you'll move to:
1. **Users Module** (15 endpoints) - Days 4-6
2. **Devices Module** (22 endpoints) - Days 7-10
3. **Sensors Module** (18 endpoints) - Days 11-13
4. And so on...

---

## 📚 **Key Documents for Reference**

1. **API_IMPLEMENTATION_ROADMAP.md** - Full 130-endpoint breakdown
2. **NEXT_STEPS.md** - Week-by-week development guide
3. **IMPLEMENTATION_CHECKLIST.md** - Granular progress tracker
4. **API_Endpoints_Structure.md** - Endpoint specifications

---

## 🎯 **Your Mission Summary**

**TODAY (October 3-4):**
- ✅ Create 6 new files listed above
- ✅ Update auth.controller.ts with all 8 endpoints
- ✅ Update auth.service.ts with all 8 method implementations
- ✅ Test all endpoints in Swagger
- ✅ Update Postman collection

**TOMORROW (October 5-6):**
- Start Users Module (15 endpoints)

**THIS WEEK:**
- Complete Auth + Users modules (23 endpoints total)

**THIS MONTH:**
- Complete all 130 endpoints across 10 modules

---

## 🚨 **CRITICAL NOTES**

1. **Firebase is already installed** ✅ (`firebase-admin` package added)
2. **Firebase credentials are in `.env`** ✅ (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, etc.)
3. **JWT_SECRET is configured** ✅ (in `.env`)
4. **Prisma Client is generated** ✅ (`npm run db:generate` completed)
5. **Build is successful** ✅ (`npm run build` passed)
6. **Server is running** ✅ (`npm run start:dev` active on port 3000)

---

## 🎉 **You're Ready to Go!**

**Start by creating the 6 files listed in "FILES TO CREATE NOW" section above.**

Each file has complete, production-ready code that you can copy-paste directly.

Good luck! 🚀

---

**Created**: October 3, 2025  
**Status**: Ready for Implementation  
**Next Update**: After Auth Module Completion
