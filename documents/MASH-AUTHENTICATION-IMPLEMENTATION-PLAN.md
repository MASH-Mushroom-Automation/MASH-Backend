# MASH Mushroom Automation - Complete Authentication System Implementation Plan

## 🎯 Project Overview

**Goal**: Implement a complete, production-ready authentication system for MASH Mushroom Automation using NestJS, PostgreSQL, and 6-digit email verification codes.

**Current Status**: 
- ✅ Basic NestJS backend structure
- ✅ PostgreSQL database with Prisma ORM
- ✅ Firebase authentication integration
- ✅ Email queue system with BullMQ
- ✅ Basic user schema
- ⚠️ **NEEDS**: 6-digit verification code system, complete auth flow, enhanced security

---

## 📋 Implementation Phases

### **Phase 1: Database Schema Enhancement** ⏱️ *2-3 days*

#### 1.1 Update User Model for 6-Digit Verification
```prisma
model User {
  // ... existing fields ...
  
  // Email Verification (6-digit code)
  emailVerificationCode     String?   @db.VarChar(6)
  emailVerificationExpires  DateTime? @db.Timestamptz
  emailVerificationAttempts Int       @default(0)
  emailVerificationBlocked  DateTime? @db.Timestamptz
  
  // Enhanced Security
  accountLocked            Boolean   @default(false)
  accountLockedUntil       DateTime? @db.Timestamptz
  twoFactorSecret          String?   @db.VarChar(255)
  twoFactorEnabled         Boolean   @default(false)
  backupCodes              String?   @db.Text // JSON array of backup codes
  
  // Session Management
  refreshTokens            RefreshToken[]
  loginSessions           LoginSession[]
}
```

#### 1.2 Add New Models
```prisma
model RefreshToken {
  id        Int      @id @default(autoincrement())
  userId    Int
  token     String   @unique @db.VarChar(255)
  expiresAt DateTime @db.Timestamptz
  createdAt DateTime @default(now()) @db.Timestamptz
  isRevoked Boolean  @default(false)
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("refresh_tokens")
}

model LoginSession {
  id          Int      @id @default(autoincrement())
  userId      Int
  sessionId   String   @unique @db.VarChar(255)
  ipAddress   String   @db.VarChar(45)
  userAgent   String   @db.Text
  deviceInfo  String?  @db.Text
  isActive    Boolean  @default(true)
  lastActivity DateTime @default(now()) @db.Timestamptz
  createdAt   DateTime @default(now()) @db.Timestamptz
  expiresAt   DateTime @db.Timestamptz
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("login_sessions")
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int?
  action    String   @db.VarChar(100)
  resource  String   @db.VarChar(100)
  details   String?  @db.Text
  ipAddress String   @db.VarChar(45)
  userAgent String   @db.Text
  createdAt DateTime @default(now()) @db.Timestamptz
  
  @@map("audit_logs")
}
```

#### 1.3 Database Migration
```bash
# Create migration
npm run prisma:migrate:dev --name "enhanced_auth_system"

# Generate Prisma client
npm run prisma:generate
```

---

### **Phase 2: Enhanced Authentication Service** ⏱️ *3-4 days*

#### 2.1 Update AuthService with 6-Digit Verification
```typescript
// src/auth/auth.service.ts
@Injectable()
export class AuthService {
  // ... existing methods ...

  /**
   * Generate 6-digit verification code
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send 6-digit verification code via email
   */
  async sendVerificationCode(userId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if user is blocked from verification attempts
    if (user.emailVerificationBlocked && user.emailVerificationBlocked > new Date()) {
      throw new BadRequestException('Too many verification attempts. Please try again later.');
    }

    // Generate 6-digit code
    const verificationCode = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with verification code
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationCode: verificationCode,
        emailVerificationExpires: expiresAt,
        emailVerificationAttempts: 0,
      }
    });

    // Send email via queue
    await this.emailQueue.sendVerificationEmail({
      to: user.email,
      firstName: user.firstName,
      verificationCode: verificationCode,
      expiresIn: 10 // minutes
    });

    // Log the action
    await this.auditLogService.log({
      userId: user.id,
      action: 'SEND_VERIFICATION_CODE',
      resource: 'USER',
      details: 'Verification code sent via email',
      ipAddress: 'system',
      userAgent: 'system'
    });
  }

  /**
   * Verify 6-digit code
   */
  async verifyCode(userId: number, code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: any;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if code exists and hasn't expired
    if (!user.emailVerificationCode || !user.emailVerificationExpires) {
      throw new BadRequestException('No verification code found');
    }

    if (user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Verification code has expired');
    }

    // Check verification attempts
    if (user.emailVerificationAttempts >= 3) {
      // Block user for 15 minutes
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          emailVerificationBlocked: new Date(Date.now() + 15 * 60 * 1000)
        }
      });
      throw new BadRequestException('Too many verification attempts. Please try again in 15 minutes.');
    }

    // Verify code
    if (user.emailVerificationCode !== code) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          emailVerificationAttempts: user.emailVerificationAttempts + 1
        }
      });
      throw new BadRequestException('Invalid verification code');
    }

    // Code is valid - mark email as verified
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null,
        emailVerificationAttempts: 0,
        emailVerificationBlocked: null,
      }
    });

    // Generate new tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    // Log successful verification
    await this.auditLogService.log({
      userId: user.id,
      action: 'EMAIL_VERIFIED',
      resource: 'USER',
      details: 'Email verification successful',
      ipAddress: 'system',
      userAgent: 'system'
    });

    return {
      accessToken,
      refreshToken,
      user: { ...user, emailVerified: true }
    };
  }

  /**
   * Resend verification code (with rate limiting)
   */
  async resendVerificationCode(userId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if already verified
    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Check rate limiting (max 3 resends per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentResends = await this.auditLogService.count({
      userId: user.id,
      action: 'SEND_VERIFICATION_CODE',
      since: oneHourAgo
    });

    if (recentResends >= 3) {
      throw new BadRequestException('Too many resend attempts. Please try again in an hour.');
    }

    await this.sendVerificationCode(userId);
  }
}
```

#### 2.2 Enhanced Token Management
```typescript
/**
 * Generate refresh token and store in database
 */
private async generateRefreshToken(user: any): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await this.prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: token,
      expiresAt: expiresAt
    }
  });

  return token;
}

/**
 * Refresh access token
 */
async refreshToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  user: any;
}> {
  const tokenRecord = await this.prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true }
  });

  if (!tokenRecord || tokenRecord.isRevoked || tokenRecord.expiresAt < new Date()) {
    throw new UnauthorizedException('Invalid refresh token');
  }

  // Generate new tokens
  const newAccessToken = this.generateAccessToken(tokenRecord.user);
  const newRefreshToken = await this.generateRefreshToken(tokenRecord.user);

  // Revoke old refresh token
  await this.prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { isRevoked: true }
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: tokenRecord.user
  };
}
```

---

### **Phase 3: Enhanced Controllers & DTOs** ⏱️ *2 days*

#### 3.1 Updated AuthController
```typescript
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService
  ) {}

  @Post('exchange')
  @UsePipes(new ValidationPipe({ transform: true }))
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async exchangeIdToken(
    @Body() exchangeTokenDto: ExchangeTokenDto,
    @Req() req: Request
  ) {
    const result = await this.authService.exchangeIdToken(exchangeTokenDto.idToken);
    
    // Log authentication attempt
    await this.auditLogService.log({
      userId: result.user.id,
      action: 'FIREBASE_TOKEN_EXCHANGE',
      resource: 'AUTH',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    return result;
  }

  @Post('send-verification/:userId')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  async sendVerificationCode(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: Request
  ) {
    await this.authService.sendVerificationCode(userId);
    
    await this.auditLogService.log({
      userId: userId,
      action: 'SEND_VERIFICATION_CODE',
      resource: 'AUTH',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    return { message: 'Verification code sent' };
  }

  @Post('resend-verification/:userId')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  async resendVerificationCode(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: Request
  ) {
    await this.authService.resendVerificationCode(userId);
    
    await this.auditLogService.log({
      userId: userId,
      action: 'RESEND_VERIFICATION_CODE',
      resource: 'AUTH',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    return { message: 'Verification code resent' };
  }

  @Post('verify-code')
  @UsePipes(new ValidationPipe({ transform: true }))
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async verifyCode(
    @Body() verifyCodeDto: VerifyCodeDto,
    @Req() req: Request
  ) {
    const result = await this.authService.verifyCode(
      verifyCodeDto.userId,
      verifyCodeDto.code
    );

    await this.auditLogService.log({
      userId: verifyCodeDto.userId,
      action: 'VERIFY_CODE',
      resource: 'AUTH',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    return result;
  }

  @Post('refresh')
  @UsePipes(new ValidationPipe({ transform: true }))
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request
  ) {
    const result = await this.authService.refreshToken(refreshTokenDto.refreshToken);
    
    await this.auditLogService.log({
      userId: result.user.id,
      action: 'REFRESH_TOKEN',
      resource: 'AUTH',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    return result;
  }

  @Post('logout')
  @UseGuards(FirebaseAuthGuard)
  async logout(
    @Body() logoutDto: LogoutDto,
    @Req() req: any
  ) {
    await this.authService.logout(req.currentUser.id, logoutDto.refreshToken);
    
    await this.auditLogService.log({
      userId: req.currentUser.id,
      action: 'LOGOUT',
      resource: 'AUTH',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    return { message: 'Logged out successfully' };
  }
}
```

#### 3.2 Enhanced DTOs
```typescript
// src/auth/dto/verify-code.dto.ts
export class VerifyCodeDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  userId: number;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 digits' })
  code: string;
}

// src/auth/dto/logout.dto.ts
export class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

// src/auth/dto/change-password.dto.ts
export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  })
  newPassword: string;

  @IsNotEmpty()
  @IsString()
  @Validate(ConfirmPasswordValidator)
  confirmPassword: string;
}
```

---

### **Phase 4: Email Templates & Queue Enhancement** ⏱️ *2 days*

#### 4.1 Email Templates
```typescript
// src/queue/email-templates/verification-code.hbs
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>MASH - Email Verification</title>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background: #2E8B57; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .code { background: #2E8B57; color: white; font-size: 24px; font-weight: bold; 
                padding: 15px 30px; text-align: center; margin: 20px 0; border-radius: 5px; }
        .footer { background: #333; color: white; padding: 20px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍄 MASH Mushroom Automation</h1>
            <h2>Email Verification</h2>
        </div>
        <div class="content">
            <p>Hello {{firstName}},</p>
            <p>Welcome to MASH Mushroom Automation! Please use the following code to verify your email address:</p>
            
            <div class="code">{{verificationCode}}</div>
            
            <p><strong>This code will expire in {{expiresIn}} minutes.</strong></p>
            
            <p>If you didn't request this verification code, please ignore this email.</p>
            
            <p>Best regards,<br>MASH Team</p>
        </div>
        <div class="footer">
            <p>© 2024 MASH Mushroom Automation. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
```

#### 4.2 Enhanced Email Queue Service
```typescript
// src/queue/email.queue.ts
@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    private readonly emailProcessor: EmailProcessor
  ) {}

  async sendVerificationEmail(data: {
    to: string;
    firstName: string;
    verificationCode: string;
    expiresIn: number;
  }): Promise<void> {
    try {
      await this.emailQueue.add('send-verification-email', {
        to: data.to,
        subject: 'MASH - Email Verification Code',
        template: 'verification-code',
        data: {
          firstName: data.firstName,
          verificationCode: data.verificationCode,
          expiresIn: data.expiresIn
        }
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      this.logger.log(`Verification email queued for ${data.to}`);
    } catch (error) {
      this.logger.error(`Failed to queue verification email for ${data.to}:`, error);
      throw error;
    }
  }

  async sendWelcomeEmail(data: {
    to: string;
    firstName: string;
  }): Promise<void> {
    await this.emailQueue.add('send-welcome-email', {
      to: data.to,
      subject: 'Welcome to MASH Mushroom Automation!',
      template: 'welcome',
      data: {
        firstName: data.firstName
      }
    });
  }
}
```

---

### **Phase 5: Security Enhancements** ⏱️ *3-4 days*

#### 5.1 Rate Limiting & Security Guards
```typescript
// src/auth/guards/verification-throttle.guard.ts
@Injectable()
export class VerificationThrottleGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.params.userId;
    const ipAddress = request.ip;

    // Check IP-based rate limiting
    const ipKey = `verification_ip:${ipAddress}`;
    const ipAttempts = await this.redis.get(ipKey);
    
    if (ipAttempts && parseInt(ipAttempts) >= 10) {
      throw new TooManyRequestsException('Too many verification requests from this IP');
    }

    // Check user-based rate limiting
    const userKey = `verification_user:${userId}`;
    const userAttempts = await this.redis.get(userKey);
    
    if (userAttempts && parseInt(userAttempts) >= 5) {
      throw new TooManyRequestsException('Too many verification attempts for this user');
    }

    return true;
  }
}

// src/auth/guards/account-status.guard.ts
@Injectable()
export class AccountStatusGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.currentUser;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if account is locked
    if (user.accountLocked && user.accountLockedUntil > new Date()) {
      throw new ForbiddenException('Account is temporarily locked');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new ForbiddenException('Account is inactive');
    }

    return true;
  }
}
```

#### 5.2 Audit Logging Service
```typescript
// src/auth/services/audit-log.service.ts
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(data: {
    userId?: number;
    action: string;
    resource: string;
    details?: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      }
    });
  }

  async getLogs(filters: {
    userId?: number;
    action?: string;
    since?: Date;
    limit?: number;
  }): Promise<any[]> {
    return this.prisma.auditLog.findMany({
      where: {
        userId: filters.userId,
        action: filters.action,
        createdAt: filters.since ? { gte: filters.since } : undefined
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100
    });
  }

  async count(filters: {
    userId?: number;
    action?: string;
    since?: Date;
  }): Promise<number> {
    return this.prisma.auditLog.count({
      where: {
        userId: filters.userId,
        action: filters.action,
        createdAt: filters.since ? { gte: filters.since } : undefined
      }
    });
  }
}
```

#### 5.3 Session Management
```typescript
// src/auth/services/session.service.ts
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: Redis
  ) {}

  async createSession(userId: number, ipAddress: string, userAgent: string): Promise<string> {
    const sessionId = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.prisma.loginSession.create({
      data: {
        userId,
        sessionId,
        ipAddress,
        userAgent,
        expiresAt
      }
    });

    // Store session in Redis for fast access
    await this.redis.setex(
      `session:${sessionId}`,
      30 * 24 * 60 * 60, // 30 days
      JSON.stringify({ userId, ipAddress, userAgent })
    );

    return sessionId;
  }

  async validateSession(sessionId: string, ipAddress: string): Promise<any> {
    // Check Redis first
    const cachedSession = await this.redis.get(`session:${sessionId}`);
    if (cachedSession) {
      const session = JSON.parse(cachedSession);
      if (session.ipAddress === ipAddress) {
        return session;
      }
    }

    // Check database
    const session = await this.prisma.loginSession.findUnique({
      where: { sessionId },
      include: { user: true }
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid session');
    }

    if (session.ipAddress !== ipAddress) {
      throw new UnauthorizedException('Session IP mismatch');
    }

    // Update last activity
    await this.prisma.loginSession.update({
      where: { id: session.id },
      data: { lastActivity: new Date() }
    });

    return session;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.loginSession.update({
      where: { sessionId },
      data: { isActive: false }
    });

    await this.redis.del(`session:${sessionId}`);
  }

  async revokeAllUserSessions(userId: number): Promise<void> {
    await this.prisma.loginSession.updateMany({
      where: { userId },
      data: { isActive: false }
    });

    // Clear all user sessions from Redis
    const keys = await this.redis.keys(`session:*`);
    for (const key of keys) {
      const session = await this.redis.get(key);
      if (session) {
        const sessionData = JSON.parse(session);
        if (sessionData.userId === userId) {
          await this.redis.del(key);
        }
      }
    }
  }
}
```

---

### **Phase 6: Enhanced User Management** ⏱️ *2-3 days*

#### 6.1 User Profile Management
```typescript
// src/users/users.controller.ts
@Controller('users')
@UseGuards(FirebaseAuthGuard, AccountStatusGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService
  ) {}

  @Get('profile')
  async getProfile(@Req() req: any) {
    const user = await this.usersService.getUserProfile(req.currentUser.id);
    return { user };
  }

  @Put('profile')
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @Req() req: any
  ) {
    const user = await this.usersService.updateProfile(
      req.currentUser.id,
      updateProfileDto
    );

    await this.auditLogService.log({
      userId: req.currentUser.id,
      action: 'UPDATE_PROFILE',
      resource: 'USER',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    return { user };
  }

  @Post('change-password')
  @UsePipes(new ValidationPipe({ transform: true }))
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: any
  ) {
    await this.authService.changePassword(
      req.currentUser.id,
      changePasswordDto
    );

    await this.auditLogService.log({
      userId: req.currentUser.id,
      action: 'CHANGE_PASSWORD',
      resource: 'USER',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    return { message: 'Password changed successfully' };
  }

  @Get('sessions')
  async getUserSessions(@Req() req: any) {
    const sessions = await this.usersService.getUserSessions(req.currentUser.id);
    return { sessions };
  }

  @Delete('sessions/:sessionId')
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Req() req: any
  ) {
    await this.usersService.revokeSession(req.currentUser.id, sessionId);

    await this.auditLogService.log({
      userId: req.currentUser.id,
      action: 'REVOKE_SESSION',
      resource: 'USER',
      details: `Session ${sessionId} revoked`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    return { message: 'Session revoked successfully' };
  }

  @Post('sessions/revoke-all')
  async revokeAllSessions(@Req() req: any) {
    await this.usersService.revokeAllSessions(req.currentUser.id);

    await this.auditLogService.log({
      userId: req.currentUser.id,
      action: 'REVOKE_ALL_SESSIONS',
      resource: 'USER',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    return { message: 'All sessions revoked successfully' };
  }
}
```

#### 6.2 User Service
```typescript
// src/users/users.service.ts
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService
  ) {}

  async getUserProfile(userId: number): Promise<any> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        email: true,
        emailVerified: true,
        profilePictureUrl: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true
      }
    });
  }

  async updateProfile(userId: number, data: UpdateProfileDto): Promise<any> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        suffix: data.suffix,
        profilePictureUrl: data.profilePictureUrl
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        email: true,
        profilePictureUrl: true,
        updatedAt: true
      }
    });
  }

  async getUserSessions(userId: number): Promise<any[]> {
    return this.prisma.loginSession.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      select: {
        id: true,
        sessionId: true,
        ipAddress: true,
        userAgent: true,
        deviceInfo: true,
        lastActivity: true,
        createdAt: true,
        expiresAt: true
      },
      orderBy: { lastActivity: 'desc' }
    });
  }

  async revokeSession(userId: number, sessionId: string): Promise<void> {
    const session = await this.prisma.loginSession.findFirst({
      where: {
        sessionId,
        userId,
        isActive: true
      }
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionService.revokeSession(sessionId);
  }

  async revokeAllSessions(userId: number): Promise<void> {
    await this.sessionService.revokeAllUserSessions(userId);
  }
}
```

---

### **Phase 7: Admin & Monitoring Endpoints** ⏱️ *2-3 days*

#### 7.1 Admin Controller
```typescript
// src/admin/admin.controller.ts
@Controller('admin')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditLogService: AuditLogService
  ) {}

  @Get('users')
  async getUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: boolean
  ) {
    return this.adminService.getUsers({
      page,
      limit,
      search,
      role,
      isActive
    });
  }

  @Get('users/:userId')
  async getUserDetails(@Param('userId', ParseIntPipe) userId: number) {
    return this.adminService.getUserDetails(userId);
  }

  @Put('users/:userId/status')
  async updateUserStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() updateStatusDto: UpdateUserStatusDto,
    @Req() req: any
  ) {
    const result = await this.adminService.updateUserStatus(userId, updateStatusDto);

    await this.auditLogService.log({
      userId: req.currentUser.id,
      action: 'UPDATE_USER_STATUS',
      resource: 'ADMIN',
      details: `User ${userId} status updated to ${updateStatusDto.isActive}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    return result;
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('userId') userId?: number,
    @Query('action') action?: string,
    @Query('since') since?: string
  ) {
    return this.adminService.getAuditLogs({
      page,
      limit,
      userId,
      action,
      since: since ? new Date(since) : undefined
    });
  }

  @Get('system-stats')
  async getSystemStats() {
    return this.adminService.getSystemStats();
  }
}
```

#### 7.2 System Health & Monitoring
```typescript
// src/health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  async getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('detailed')
  async getDetailedHealth() {
    return this.healthService.getDetailedHealth();
  }

  @Get('database')
  async getDatabaseHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get('email-queue')
  async getEmailQueueHealth() {
    return this.healthService.getEmailQueueHealth();
  }
}
```

---

### **Phase 8: Testing & Documentation** ⏱️ *3-4 days*

#### 8.1 Comprehensive Test Suite
```typescript
// test/auth/auth.service.spec.ts - Enhanced tests
describe('AuthService - 6-Digit Verification', () => {
  describe('sendVerificationCode', () => {
    it('should generate 6-digit code and send email', async () => {
      // Test implementation
    });

    it('should block user after 3 failed attempts', async () => {
      // Test implementation
    });

    it('should respect rate limiting', async () => {
      // Test implementation
    });
  });

  describe('verifyCode', () => {
    it('should verify valid 6-digit code', async () => {
      // Test implementation
    });

    it('should reject expired code', async () => {
      // Test implementation
    });

    it('should increment attempts on wrong code', async () => {
      // Test implementation
    });
  });

  describe('resendVerificationCode', () => {
    it('should respect hourly rate limit', async () => {
      // Test implementation
    });
  });
});
```

#### 8.2 Updated Postman Collections
- ✅ Update all collections for 6-digit verification
- ✅ Add rate limiting tests
- ✅ Add security test scenarios
- ✅ Add admin endpoint tests
- ✅ Add comprehensive error handling tests

---

### **Phase 9: Production Readiness** ⏱️ *2-3 days*

#### 9.1 Environment Configuration
```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-super-secure-jwt-secret
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="MASH Mushroom Automation <your-email@gmail.com>"

# Rate Limiting
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Security
BCRYPT_ROUNDS=12
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
VERIFICATION_CODE_EXPIRES_IN=10m
```

#### 9.2 Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
```

#### 9.3 Production Deployment Checklist
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Redis server running
- [ ] Email service configured and tested
- [ ] Firebase project configured
- [ ] SSL certificates installed
- [ ] Rate limiting configured
- [ ] Monitoring and logging set up
- [ ] Backup strategy implemented
- [ ] Security headers configured

---

## 🎯 Success Criteria

### **Functional Requirements**
- ✅ 6-digit email verification codes
- ✅ Firebase authentication integration
- ✅ Secure JWT token management
- ✅ Session management with Redis
- ✅ Rate limiting and security measures
- ✅ Comprehensive audit logging
- ✅ User profile management
- ✅ Admin panel functionality

### **Non-Functional Requirements**
- ✅ Response time < 500ms for auth endpoints
- ✅ 99.9% uptime target
- ✅ Support for 1000+ concurrent users
- ✅ Comprehensive error handling
- ✅ Security best practices
- ✅ Complete test coverage (>80%)
- ✅ Production-ready deployment

### **Security Requirements**
- ✅ Rate limiting on all auth endpoints
- ✅ Account lockout after failed attempts
- ✅ Secure password policies
- ✅ Session management
- ✅ Audit logging for all actions
- ✅ Input validation and sanitization
- ✅ CORS and security headers

---

## 📊 Timeline Summary

| Phase | Duration | Dependencies | Deliverables |
|-------|----------|--------------|--------------|
| 1. Database Schema | 2-3 days | - | Enhanced schema, migrations |
| 2. Auth Service | 3-4 days | Phase 1 | 6-digit verification system |
| 3. Controllers & DTOs | 2 days | Phase 2 | Enhanced API endpoints |
| 4. Email System | 2 days | Phase 2 | Email templates, queue |
| 5. Security | 3-4 days | Phase 3 | Guards, rate limiting, audit |
| 6. User Management | 2-3 days | Phase 5 | Profile, sessions, admin |
| 7. Admin & Monitoring | 2-3 days | Phase 6 | Admin panel, health checks |
| 8. Testing | 3-4 days | All phases | Test suite, documentation |
| 9. Production | 2-3 days | Phase 8 | Deployment, monitoring |

**Total Estimated Time: 21-30 days**

---

## 🚀 Getting Started

1. **Review and approve this plan**
2. **Set up development environment**
3. **Begin with Phase 1: Database Schema Enhancement**
4. **Follow the phases sequentially**
5. **Test thoroughly at each phase**
6. **Document any deviations or issues**

This comprehensive plan will deliver a production-ready, secure, and scalable authentication system for your MASH Mushroom Automation platform! 🍄

