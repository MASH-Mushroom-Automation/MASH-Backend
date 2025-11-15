# 🔐 Google SSO Authentication with Clerk - Implementation Plan

**Project:** MASH Backend - Google Single Sign-On Integration  
**Status:** 🚧 In Progress - Phase 1 Complete (Backend), Phase 2 Next (Environment Setup)  
**Created:** November 15, 2025  
**Last Updated:** November 15, 2025  
**Target Completion:** 2-3 days  
**Complexity:** Medium

---

## 🎯 Current Progress

### ✅ Phase 1: Backend Implementation (COMPLETE)
- ✅ Created Google Link/Unlink DTOs
- ✅ Added Controller Endpoints (POST /auth/social/link/google, DELETE /auth/social/unlink)
- ✅ Implemented Service Methods (linkGoogleAccount, unlinkSocialAccount)
- ✅ Enhanced Clerk Webhook Handlers (createUser, updateUser)
- ✅ Fixed all TypeScript compilation errors
- ✅ Build successful

### ✅ Phase 2: Environment Setup (COMPLETE)
- ✅ Got Clerk credentials from dashboard.clerk.com
- ✅ Enabled Google OAuth in Clerk dashboard
- ✅ Configured Clerk webhook endpoint
- ✅ Updated .env file with credentials
- ✅ Set CLERK_ENABLED=true
- ✅ Webhook secret configured: whsec_JtOiAs0zFyPNFKPKL9QCyJJjK1H/timm

### 🚧 Phase 3: Frontend Integration (NEXT - 3-4 hours)
**YOU ARE HERE** 👈
- ⏳ Install Clerk SDK (@clerk/nextjs or @clerk/clerk-react)
- ⏳ Configure Clerk Provider in app
- ⏳ Create Sign-In page with Google button
- ⏳ Create Sign-Up page with Google button
- ⏳ Add protected route middleware
- ⏳ Create Dashboard with user info
- ⏳ Create Account Settings with link/unlink buttons

### ⏳ Phase 4: Testing (Pending - 1 hour)
- Waiting for frontend integration completion

---

## 🎯 QUICK START - YOUR NEXT ACTION

**👉 Open and follow this guide:**
📄 **[GOOGLE_SSO_STEP_BY_STEP_GUIDE.md](./GOOGLE_SSO_STEP_BY_STEP_GUIDE.md)**

**What to do right now:**
1. Visit https://dashboard.clerk.com
2. Get your Clerk credentials (Publishable Key & Secret Key)
3. Enable Google OAuth in Clerk dashboard
4. Update your `.env` file with credentials
5. Set `CLERK_ENABLED=true`

**Time needed:** 10 minutes for environment setup

---

## 📊 Implementation Progress

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: BACKEND IMPLEMENTATION                      ✅ 100% │
├─────────────────────────────────────────────────────────────┤
│ ✅ DTOs created                                             │
│ ✅ Controller endpoints added                               │
│ ✅ Service methods implemented                              │
│ ✅ Webhook handlers enhanced                                │
│ ✅ Build successful                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: ENVIRONMENT SETUP                  👉 IN PROGRESS  │
├─────────────────────────────────────────────────────────────┤
│ ⏳ Get Clerk credentials                                    │
│ ⏳ Enable Google OAuth in Clerk                             │
│ ⏳ Setup Google Cloud Console (optional)                    │
│ ⏳ Update .env file                                         │
│ ⏳ Configure Clerk webhook                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: FRONTEND INTEGRATION                     ⏳ PENDING │
├─────────────────────────────────────────────────────────────┤
│ ⏳ Install Clerk SDK                                        │
│ ⏳ Configure Clerk Provider                                 │
│ ⏳ Create Sign-In page                                      │
│ ⏳ Create Sign-Up page                                      │
│ ⏳ Add protected route middleware                           │
│ ⏳ Create Dashboard                                         │
│ ⏳ Create Account Settings                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: TESTING                                  ⏳ PENDING │
├─────────────────────────────────────────────────────────────┤
│ ⏳ Test new user sign-up with Google                        │
│ ⏳ Test existing user sign-in with Google                   │
│ ⏳ Test link Google to email/password account               │
│ ⏳ Test unlink Google account                               │
│ ⏳ Test error cases                                         │
└─────────────────────────────────────────────────────────────┘

Overall Progress: ████████░░░░░░░░░░░░░░ 33% (1 of 4 phases complete)
```

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [Architecture Design](#architecture-design)
4. [Prerequisites](#prerequisites)
5. [Implementation Steps](#implementation-steps)
6. [Testing Strategy](#testing-strategy)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Success Metrics](#success-metrics)

---

## 🎯 Overview

### What We're Building

Complete Google SSO authentication integration using Clerk as the authentication provider, allowing users to:
- Sign up with Google accounts
- Log in with existing Google accounts
- Link Google accounts to existing email/password accounts
- Maintain unified user profiles across authentication methods

### Why Clerk + Google SSO?

**Benefits:**
- ✅ **Simplified Auth Flow**: Clerk handles OAuth complexity
- ✅ **Enterprise-Ready**: Built-in security, MFA, session management
- ✅ **Better UX**: One-click sign-in, no password management
- ✅ **Unified Identity**: Single user record across auth methods
- ✅ **Compliance**: GDPR, SOC 2 compliant out of the box

**Use Cases:**
1. **New Users**: "Sign up with Google" → instant account creation
2. **Existing Users**: "Log in with Google" → seamless authentication
3. **Account Linking**: Add Google to existing email/password account
4. **Mobile Apps**: Native Google Sign-In integration

---

## 🔍 Current State Analysis

### ✅ What We Already Have

**1. Clerk Integration (Partial)**
- ✅ Clerk service (`src/modules/auth/services/clerk.service.ts`)
- ✅ Clerk webhook handling (`auth.controller.ts`)
- ✅ Clerk configuration setup
- ✅ User synchronization logic

**2. OAuth Infrastructure**
- ✅ OAuth service (`src/modules/oauth/oauth.service.ts`)
- ✅ Google OAuth2 client configured
- ✅ Google token validation
- ✅ OAuth DTOs and interfaces

**3. Database Schema**
- ✅ User model with `googleId` field
- ✅ `clerkId` field for Clerk user mapping
- ✅ Email verification tracking
- ✅ User roles and permissions

**4. Environment Variables**
```env
# Already configured
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
```

### ❌ What We Need to Build

1. **Clerk Dashboard Configuration**
   - Enable Google OAuth provider in Clerk
   - Configure OAuth redirect URIs
   - Set up webhook endpoints

2. **Backend Endpoints**
   - Google SSO login endpoint
   - Google account linking endpoint
   - Google account unlinking endpoint
   - OAuth callback handler

3. **Frontend Integration**
   - Clerk React/JavaScript SDK setup
   - "Sign in with Google" button
   - Account settings UI for linking
   - Error handling and loading states

4. **User Flow Logic**
   - Auto-create user on first Google sign-in
   - Link Google to existing email account
   - Handle email conflicts
   - Merge user data

5. **Testing & Documentation**
   - Integration tests for OAuth flow
   - Postman collection for Google SSO
   - User documentation
   - Developer setup guide

---

## 🏗️ Architecture Design

### Authentication Flow Diagram

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │
       │ 1. Click "Sign in with Google"
       ↓
┌──────────────────┐
│   Clerk SDK      │  ← Clerk handles OAuth redirect
│ (ClerkProvider)  │
└──────┬───────────┘
       │
       │ 2. Redirect to Google OAuth
       ↓
┌─────────────────┐
│ Google OAuth    │
│ Consent Screen  │
└──────┬──────────┘
       │
       │ 3. User grants permission
       ↓
┌──────────────────┐
│   Clerk OAuth    │  ← Clerk receives OAuth token
│   Callback       │     Validates with Google
└──────┬───────────┘     Creates/updates Clerk user
       │
       │ 4. Webhook: user.created/user.updated
       ↓
┌──────────────────────┐
│  MASH Backend        │
│  /auth/clerk-webhook │  ← Sync user to database
└──────┬───────────────┘     Create JWT token
       │
       │ 5. Return JWT token + user data
       ↓
┌─────────────┐
│   Browser   │  ← User authenticated!
│  (Frontend) │     Store JWT in cookie/localStorage
└─────────────┘
```

### Database Schema Updates

**No changes needed!** Existing schema already supports Google SSO:

```prisma
model User {
  id             String   @id @default(cuid())
  clerkId        String?  @unique  // ✅ Clerk user ID
  googleId       String?  @unique  // ✅ Google OAuth ID
  facebookId     String?  @unique
  email          String   @unique
  emailVerified  Boolean  @default(false)
  firstName      String?
  lastName       String?
  imageUrl       String?
  // ... other fields
}
```

### API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/auth/clerk-webhook` | POST | Webhook | Clerk user sync (already exists) |
| `/auth/google/link` | POST | JWT | Link Google to account (new) |
| `/auth/google/unlink` | DELETE | JWT | Unlink Google account (new) |
| `/auth/me` | GET | JWT | Get current user (already exists) |

---

## 📦 Prerequisites

### 1. Clerk Account Setup

**Create Clerk Application:**
1. Go to https://clerk.com
2. Sign up / Log in
3. Create new application: "MASH Backend"
4. Note down:
   - Publishable Key: `pk_test_...`
   - Secret Key: `sk_test_...`

**Enable Google OAuth:**
1. In Clerk Dashboard → **User & Authentication** → **Social Connections**
2. Click **"Add social connection"**
3. Select **"Google"**
4. Configure:
   - Enable for sign-up: ✅
   - Enable for sign-in: ✅
   - Require email verification: ✅

### 2. Google Cloud Console Setup

**Create OAuth 2.0 Credentials:**
1. Go to https://console.cloud.google.com
2. Create new project: "MASH Authentication"
3. Enable Google+ API
4. Navigate to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen:
   - User Type: External
   - App Name: "MASH Mushroom Automation"
   - Support Email: `MASH.Mushroom.Automation@gmail.com`
   - Scopes: `email`, `profile`, `openid`
6. Create OAuth Client:
   - Application Type: Web application
   - Name: "MASH Backend Production"
   - Authorized JavaScript origins:
     - `http://localhost:3000` (development)
     - `https://mash-backend-api-production.up.railway.app` (production)
     - `https://yourdomain.com` (your frontend domain)
   - Authorized redirect URIs:
     - **Clerk's OAuth callback URL** (get from Clerk dashboard)
     - Example: `https://your-clerk-instance.clerk.accounts.dev/v1/oauth_callback`

**Copy credentials:**
- Client ID: `YOUR_GOOGLE_CLIENT_ID`
- Client Secret: `YOUR_GOOGLE_CLIENT_SECRET`

### 3. Configure Clerk with Google Credentials

**In Clerk Dashboard:**
1. Go to **Google** social connection settings
2. Paste Google Client ID
3. Paste Google Client Secret
4. Copy the **OAuth redirect URI** from Clerk
5. Add this URI to Google Cloud Console (step 2.6 above)
6. Save

### 4. Update Environment Variables

**`.env` file:**
```env
# Clerk Configuration
CLERK_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
CLERK_SECRET_KEY=sk_test_YOUR_SECRET_KEY
CLERK_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Google OAuth (used by Clerk)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

# Frontend URL (for CORS and redirects)
FRONTEND_URL=http://localhost:3001
```

**Railway Environment Variables:**
Same as above, but with production values:
```env
FRONTEND_URL=https://yourdomain.com
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

---

## 🚀 Implementation Steps

### Phase 1: Backend Setup (2 hours)

#### Step 1.1: Update Environment Variables ✅ (5 minutes)

Add to `.env`:
```env
# Clerk Configuration (get from https://dashboard.clerk.com)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Google OAuth (already configured)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Verify in Railway dashboard: **Settings → Variables**

---

#### Step 1.2: Add Google Account Linking Endpoints (30 minutes)

**Create DTO:**
`src/modules/auth/dto/google-link.dto.ts`

```typescript
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkGoogleAccountDto {
  @ApiProperty({
    description: 'Google ID token from Google Sign-In',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class GoogleLinkResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Google account linked successfully' })
  message: string;

  @ApiProperty({
    example: {
      googleId: '1234567890',
      email: 'user@gmail.com',
      linkedAt: '2025-11-15T10:30:00Z',
    },
  })
  data: {
    googleId: string;
    email: string;
    linkedAt: Date;
  };
}
```

**Add to `auth.controller.ts`:**

```typescript
/**
 * 🔗 Link Google Account
 * =====================
 * Links a Google account to the current authenticated user.
 * 
 * Process:
 * 1. Validates Google ID token
 * 2. Checks if Google account already linked to another user
 * 3. Updates user record with googleId
 * 4. Returns success confirmation
 * 
 * Requirements:
 * - User must be authenticated (JWT token)
 * - Google ID token must be valid
 * - Google account must not be linked to another user
 */
@Post('google/link')
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.OK)
@ApiBearerAuth()
@ApiOperation({
  summary: '🔗 Link Google account to current user',
  description: `
**Link your Google account for easier sign-in**

Allows users to add Google Sign-In to their existing account.

**Requirements:**
- Must be logged in
- Valid Google ID token
- Google account not already linked to another user

**Benefits:**
- Sign in with Google in the future
- One-click authentication
- No need to remember password
  `,
})
@ApiResponse({
  status: 200,
  description: 'Google account linked successfully',
  type: GoogleLinkResponseDto,
})
@ApiResponse({
  status: 400,
  description: 'Invalid Google token or account already linked',
})
@ApiResponse({
  status: 401,
  description: 'Unauthorized - JWT token required',
})
async linkGoogleAccount(
  @Request() req: AuthenticatedRequest,
  @Body() linkDto: LinkGoogleAccountDto,
) {
  const userId = req.user.userId;
  return this.authService.linkGoogleAccount(userId, linkDto.idToken);
}

/**
 * 🔓 Unlink Google Account
 * =======================
 * Removes Google account link from current user.
 * 
 * Process:
 * 1. Verifies user has password set (can't remove only auth method)
 * 2. Removes googleId from user record
 * 3. Returns success confirmation
 * 
 * Security:
 * - User must have alternative login method (email/password)
 * - Cannot unlink if it's the only authentication method
 */
@Delete('google/unlink')
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.OK)
@ApiBearerAuth()
@ApiOperation({
  summary: '🔓 Unlink Google account from current user',
  description: `
**Remove Google Sign-In from your account**

Removes the link between your account and Google OAuth.

**Requirements:**
- Must be logged in
- Must have email/password set (can't remove only auth method)

**After unlinking:**
- Can no longer sign in with Google
- Must use email/password to log in
- Can link Google account again later
  `,
})
@ApiResponse({
  status: 200,
  description: 'Google account unlinked successfully',
})
@ApiResponse({
  status: 400,
  description: 'Cannot unlink - no alternative authentication method',
})
@ApiResponse({
  status: 401,
  description: 'Unauthorized - JWT token required',
})
async unlinkGoogleAccount(@Request() req: AuthenticatedRequest) {
  const userId = req.user.userId;
  return this.authService.unlinkGoogleAccount(userId);
}
```

---

#### Step 1.3: Add Service Methods (45 minutes)

**Add to `auth.service.ts`:**

```typescript
/**
 * Link Google Account
 * Connects a Google OAuth account to existing user
 */
async linkGoogleAccount(userId: string, googleIdToken: string) {
  this.logger.log(`Linking Google account for user ${userId}`);

  try {
    // 1. Validate Google ID token
    const googleUser = await this.oauthService.validateGoogleToken(googleIdToken);

    // 2. Check if Google account already linked to another user
    const existingUser = await this.prisma.user.findUnique({
      where: { googleId: googleUser.id },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException(
        'This Google account is already linked to another user',
      );
    }

    // 3. Check if user already has Google linked
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (currentUser?.googleId) {
      throw new ConflictException(
        'Your account already has a Google account linked',
      );
    }

    // 4. Update user with Google ID
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleId: googleUser.id,
        // Optionally update email if not verified
        email: currentUser?.emailVerified ? currentUser.email : googleUser.email,
        emailVerified: true, // Google emails are verified
        imageUrl: currentUser?.imageUrl || googleUser.imageUrl, // Use Google avatar if none set
      },
    });

    this.logger.log(`Google account linked successfully for user ${userId}`);

    // 5. Track metric
    this.prometheusService.incrementCounter('auth_google_link_success');

    return {
      success: true,
      message: 'Google account linked successfully',
      data: {
        googleId: googleUser.id,
        email: googleUser.email,
        linkedAt: new Date(),
      },
    };
  } catch (error) {
    this.logger.error(`Failed to link Google account: ${error.message}`);
    this.prometheusService.incrementCounter('auth_google_link_failed');

    if (error instanceof ConflictException) {
      throw error;
    }

    throw new BadRequestException('Failed to link Google account');
  }
}

/**
 * Unlink Google Account
 * Removes Google OAuth connection from user
 */
async unlinkGoogleAccount(userId: string) {
  this.logger.log(`Unlinking Google account for user ${userId}`);

  try {
    // 1. Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Check if Google is linked
    if (!user.googleId) {
      throw new BadRequestException('No Google account linked');
    }

    // 3. Check if user has password set (can't remove only auth method)
    if (!user.password) {
      throw new BadRequestException(
        'Cannot unlink Google account. Please set a password first.',
      );
    }

    // 4. Remove Google ID
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleId: null,
      },
    });

    this.logger.log(`Google account unlinked successfully for user ${userId}`);

    // 5. Track metric
    this.prometheusService.incrementCounter('auth_google_unlink_success');

    return {
      success: true,
      message: 'Google account unlinked successfully',
    };
  } catch (error) {
    this.logger.error(`Failed to unlink Google account: ${error.message}`);
    this.prometheusService.incrementCounter('auth_google_unlink_failed');

    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException
    ) {
      throw error;
    }

    throw new BadRequestException('Failed to unlink Google account');
  }
}
```

---

#### Step 1.4: Update Clerk Webhook Handler (15 minutes)

**Enhance `handleClerkWebhook` in `auth.service.ts`:**

```typescript
async handleClerkWebhook(payload: ClerkWebhookDto) {
  const { type, data } = payload;

  this.logger.log(`Received Clerk webhook: ${type}`);

  try {
    switch (type) {
      case 'user.created':
        return await this.handleUserCreated(data);

      case 'user.updated':
        return await this.handleUserUpdated(data);

      case 'user.deleted':
        return await this.handleUserDeleted(data);

      default:
        this.logger.warn(`Unhandled webhook type: ${type}`);
        return { message: 'Webhook received but not processed' };
    }
  } catch (error) {
    this.logger.error(`Webhook processing failed: ${error.message}`);
    throw error;
  }
}

/**
 * Handle user.created webhook from Clerk
 * Creates new user in database when user signs up with Google
 */
private async handleUserCreated(data: any) {
  const clerkUser = data;
  
  // Extract Google OAuth data if present
  const googleAccount = clerkUser.external_accounts?.find(
    (acc: any) => acc.provider === 'google',
  );

  const userData = {
    clerkId: clerkUser.id,
    email: clerkUser.email_addresses[0]?.email_address,
    emailVerified: clerkUser.email_addresses[0]?.verification?.status === 'verified',
    firstName: clerkUser.first_name,
    lastName: clerkUser.last_name,
    imageUrl: clerkUser.image_url,
    // Add Google ID if user signed up with Google
    googleId: googleAccount?.provider_user_id || null,
    role: 'USER', // Default role
  };

  // Check if user already exists (by email or clerkId)
  const existingUser = await this.prisma.user.findFirst({
    where: {
      OR: [
        { email: userData.email },
        { clerkId: userData.clerkId },
      ],
    },
  });

  if (existingUser) {
    // Update existing user with Clerk data
    const updatedUser = await this.prisma.user.update({
      where: { id: existingUser.id },
      data: userData,
    });

    this.logger.log(`Updated existing user: ${updatedUser.email}`);
    return { message: 'User updated', userId: updatedUser.id };
  }

  // Create new user
  const newUser = await this.prisma.user.create({
    data: userData,
  });

  this.logger.log(`Created new user: ${newUser.email}`);

  // Send welcome email
  try {
    await this.emailService.sendWelcomeEmail(newUser.email, newUser.firstName || 'User');
  } catch (error) {
    this.logger.error(`Failed to send welcome email: ${error.message}`);
  }

  return { message: 'User created', userId: newUser.id };
}

/**
 * Handle user.updated webhook from Clerk
 * Updates user data when changed in Clerk (e.g., profile updates, new OAuth link)
 */
private async handleUserUpdated(data: any) {
  const clerkUser = data;

  // Extract Google OAuth data if present
  const googleAccount = clerkUser.external_accounts?.find(
    (acc: any) => acc.provider === 'google',
  );

  const updateData = {
    email: clerkUser.email_addresses[0]?.email_address,
    emailVerified: clerkUser.email_addresses[0]?.verification?.status === 'verified',
    firstName: clerkUser.first_name,
    lastName: clerkUser.last_name,
    imageUrl: clerkUser.image_url,
    // Update Google ID if changed
    googleId: googleAccount?.provider_user_id || null,
  };

  const user = await this.prisma.user.update({
    where: { clerkId: clerkUser.id },
    data: updateData,
  });

  this.logger.log(`Updated user: ${user.email}`);
  return { message: 'User updated', userId: user.id };
}
```

---

### Phase 2: Frontend Integration (3 hours)

#### Step 2.1: Install Clerk SDK (5 minutes)

**For React/Next.js Frontend:**
```bash
npm install @clerk/nextjs
# or
npm install @clerk/clerk-react
```

**For Vue.js:**
```bash
npm install @clerk/vue
```

**For Vanilla JavaScript:**
```bash
npm install @clerk/clerk-js
```

---

#### Step 2.2: Configure Clerk Provider (15 minutes)

**Next.js App Router (`app/layout.tsx`):**

```typescript
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={{
        elements: {
          formButtonPrimary: 'bg-primary hover:bg-primary/90',
        },
      }}
    >
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

**React (`main.tsx` or `App.tsx`):**

```typescript
import { ClerkProvider } from '@clerk/clerk-react';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <YourApp />
    </ClerkProvider>
  );
}
```

**Environment Variables (Frontend `.env.local`):**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
# or
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

---

#### Step 2.3: Create Sign-In Components (1 hour)

**Sign-In Page with Google SSO (`app/sign-in/page.tsx`):**

```typescript
'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <SignIn
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-xl',
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          afterSignInUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

**Sign-Up Page (`app/sign-up/page.tsx`):**

```typescript
'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <SignUp
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-xl',
            },
          }}
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          afterSignUpUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

**Custom Google Sign-In Button (if needed):**

```typescript
'use client';

import { useSignIn } from '@clerk/nextjs';
import { OAuthStrategy } from '@clerk/types';

export function GoogleSignInButton() {
  const { signIn } = useSignIn();

  const signInWithGoogle = async () => {
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google' as OAuthStrategy,
        redirectUrl: '/dashboard',
        redirectUrlComplete: '/dashboard',
      });
    } catch (error) {
      console.error('Google sign-in error:', error);
    }
  };

  return (
    <button
      onClick={signInWithGoogle}
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      Continue with Google
    </button>
  );
}
```

---

#### Step 2.4: Add Account Linking UI (1 hour)

**Account Settings Page (`app/settings/account/page.tsx`):**

```typescript
'use client';

import { useUser } from '@clerk/nextjs';
import { useState } from 'react';

export default function AccountSettingsPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  const googleAccount = user?.externalAccounts.find(
    (acc) => acc.provider === 'google'
  );

  const isGoogleLinked = !!googleAccount;

  const linkGoogleAccount = async () => {
    setLoading(true);
    try {
      await user?.createExternalAccount({
        strategy: 'oauth_google',
        redirectUrl: '/settings/account',
      });
    } catch (error) {
      console.error('Failed to link Google account:', error);
      alert('Failed to link Google account');
    } finally {
      setLoading(false);
    }
  };

  const unlinkGoogleAccount = async () => {
    if (!googleAccount) return;

    if (!confirm('Are you sure you want to unlink your Google account?')) {
      return;
    }

    setLoading(true);
    try {
      await googleAccount.destroy();
      alert('Google account unlinked successfully');
    } catch (error) {
      console.error('Failed to unlink Google account:', error);
      alert('Failed to unlink Google account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Account Settings</h1>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Connected Accounts</h2>

        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                {/* Google icon SVG paths */}
              </svg>
            </div>
            <div>
              <p className="font-medium">Google</p>
              {isGoogleLinked ? (
                <p className="text-sm text-gray-600">
                  {googleAccount.emailAddress}
                </p>
              ) : (
                <p className="text-sm text-gray-500">Not connected</p>
              )}
            </div>
          </div>

          {isGoogleLinked ? (
            <button
              onClick={unlinkGoogleAccount}
              disabled={loading}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {loading ? 'Unlinking...' : 'Unlink'}
            </button>
          ) : (
            <button
              onClick={linkGoogleAccount}
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Linking...' : 'Link Account'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

#### Step 2.5: Protected Routes (30 minutes)

**Middleware for route protection (`middleware.ts`):**

```typescript
import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  // Public routes that don't require authentication
  publicRoutes: ['/', '/sign-in', '/sign-up', '/api/webhooks/clerk'],
  
  // Routes that are always public (even with auth)
  ignoredRoutes: ['/api/health'],
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

**Protected Page Example (`app/dashboard/page.tsx`):**

```typescript
import { currentUser } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">
        Welcome, {user.firstName || 'User'}!
      </h1>
      <p className="text-gray-600">
        Email: {user.emailAddresses[0]?.emailAddress}
      </p>
      
      {/* Show if signed in with Google */}
      {user.externalAccounts.some(acc => acc.provider === 'google') && (
        <div className="mt-4 rounded-lg bg-green-50 p-4">
          <p className="text-green-800">
            ✓ Signed in with Google
          </p>
        </div>
      )}
    </div>
  );
}
```

---

### Phase 3: Testing & Validation (1 hour)

#### Step 3.1: Manual Testing Checklist

**Test Scenarios:**

1. **New User Google Sign-Up**
   - [ ] Click "Sign in with Google" on sign-up page
   - [ ] Redirected to Google consent screen
   - [ ] Grant permissions
   - [ ] Redirected back to app
   - [ ] User created in database with `googleId`
   - [ ] Welcome email sent
   - [ ] Dashboard accessible

2. **Existing User Google Sign-In**
   - [ ] User with `googleId` clicks "Sign in with Google"
   - [ ] Authenticated without password
   - [ ] Correct user data loaded
   - [ ] Session created

3. **Link Google to Email/Password Account**
   - [ ] User signed in with email/password
   - [ ] Go to account settings
   - [ ] Click "Link Google Account"
   - [ ] Authorize with Google
   - [ ] `googleId` added to user record
   - [ ] Can now sign in with Google

4. **Unlink Google Account**
   - [ ] User with both email/password and Google
   - [ ] Go to account settings
   - [ ] Click "Unlink Google"
   - [ ] Confirm action
   - [ ] `googleId` removed from database
   - [ ] Can still sign in with email/password

5. **Error Cases**
   - [ ] Link Google account already used by another user → Error
   - [ ] Unlink Google when it's only auth method → Error
   - [ ] Invalid Google token → Error
   - [ ] Network failure → Graceful error message

---

#### Step 3.2: Automated Tests (30 minutes)

**Integration Test (`test/auth/google-sso.e2e-spec.ts`):**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Google SSO Integration (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/google/link', () => {
    it('should link Google account with valid token', async () => {
      // First, create a user and get JWT
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test1234!',
        })
        .expect(200);

      jwtToken = loginResponse.body.access_token;

      // Link Google account
      const mockGoogleToken = 'mock_google_id_token';

      const response = await request(app.getHttpServer())
        .post('/auth/google/link')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ idToken: mockGoogleToken })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Google account linked successfully',
        data: {
          googleId: expect.any(String),
          email: expect.any(String),
          linkedAt: expect.any(String),
        },
      });
    });

    it('should reject duplicate Google account', async () => {
      // Try to link same Google account to different user
      const response = await request(app.getHttpServer())
        .post('/auth/google/link')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ idToken: 'already_linked_token' })
        .expect(409);

      expect(response.body.message).toContain('already linked');
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/auth/google/link')
        .send({ idToken: 'some_token' })
        .expect(401);
    });
  });

  describe('DELETE /auth/google/unlink', () => {
    it('should unlink Google account', async () => {
      const response = await request(app.getHttpServer())
        .delete('/auth/google/unlink')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Google account unlinked successfully',
      });
    });

    it('should prevent unlinking if no password set', async () => {
      // User with only Google auth
      const response = await request(app.getHttpServer())
        .delete('/auth/google/unlink')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400);

      expect(response.body.message).toContain('set a password first');
    });
  });
});
```

**Run tests:**
```bash
npm run test:e2e -- google-sso.e2e-spec.ts
```

---

#### Step 3.3: Postman Collection (15 minutes)

**Create `postman/16-Google-SSO-API.postman_collection.json`:**

Key requests:
1. **Link Google Account** (POST `/auth/google/link`)
2. **Unlink Google Account** (DELETE `/auth/google/unlink`)
3. **Get Current User** (GET `/auth/me`) - verify `googleId` field
4. **Clerk Webhook - User Created with Google** (POST `/auth/clerk-webhook`)

---

### Phase 4: Documentation (30 minutes)

#### Step 4.1: User Documentation

**Create `docs/USER_GUIDE_GOOGLE_SSO.md`:**
- How to sign up with Google
- How to link Google to existing account
- How to unlink Google account
- Troubleshooting common issues
- Privacy and security information

#### Step 4.2: Developer Documentation

**Update `README.md`:**
- Add Google SSO setup instructions
- Document environment variables
- Add architecture diagram
- Link to Clerk documentation

---

## 🔒 Security Considerations

### 1. Token Validation

**Always validate Google tokens:**
```typescript
// ✅ CORRECT: Verify with Google
const googleUser = await this.oauthService.validateGoogleToken(idToken);

// ❌ WRONG: Trust token without verification
const decoded = jwt.decode(idToken); // NEVER DO THIS!
```

### 2. Email Conflicts

**Handle email conflicts gracefully:**
- User signs up with `user@gmail.com` via email/password
- Same user tries to sign in with Google using `user@gmail.com`
- **Solution**: Link accounts automatically if email matches and is verified

### 3. Session Management

**Clerk handles session security:**
- JWT tokens with short expiration (1 hour)
- Refresh tokens for extended sessions
- Session revocation on password change
- Multi-device session tracking

### 4. Data Privacy

**GDPR Compliance:**
- Only request necessary Google scopes (`email`, `profile`)
- Allow users to unlink Google account anytime
- Delete Google data when account deleted
- Provide data export functionality

### 5. Rate Limiting

**Protect OAuth endpoints:**
```typescript
@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
@Post('google/link')
```

---

## 🐛 Troubleshooting Guide

### Common Issues

#### Issue 1: "Redirect URI mismatch"

**Symptom:** Error during Google OAuth consent screen

**Cause:** Redirect URI in Google Cloud Console doesn't match Clerk's callback URL

**Solution:**
1. Go to Clerk Dashboard → Google settings
2. Copy the **OAuth redirect URI**
3. Add exact URI to Google Cloud Console → Credentials → Authorized redirect URIs
4. Save and wait 5 minutes for propagation

---

#### Issue 2: "This Google account is already linked to another user"

**Symptom:** Error when linking Google account

**Cause:** Google account already associated with different user

**Solution:**
- User must unlink from original account first
- Or use different Google account
- Or contact support to merge accounts

---

#### Issue 3: Webhook not receiving events

**Symptom:** User created in Clerk but not in database

**Cause:** Webhook endpoint not configured or secret mismatch

**Solution:**
1. Verify webhook endpoint in Clerk Dashboard
2. Ensure `CLERK_WEBHOOK_SECRET` matches Clerk
3. Check Railway logs for webhook errors
4. Test webhook with Clerk Dashboard test tool

---

#### Issue 4: "Cannot unlink Google account"

**Symptom:** Error when trying to unlink Google

**Cause:** No alternative authentication method (no password set)

**Solution:**
1. User must set password first
2. Go to account settings → Set password
3. Then unlink Google account

---

#### Issue 5: CORS errors on frontend

**Symptom:** Network requests blocked by browser

**Cause:** Backend CORS not configured for frontend domain

**Solution:**
Add frontend URL to CORS whitelist:
```typescript
// src/main.ts
app.enableCors({
  origin: [
    'http://localhost:3001',
    'https://yourdomain.com',
  ],
  credentials: true,
});
```

---

## 📊 Success Metrics

### Technical Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Google SSO Adoption | 40%+ of new users | Track `googleId` not null in User table |
| OAuth Flow Success Rate | >95% | `auth_google_link_success` / total attempts |
| Average Auth Time | <3 seconds | Time from click to dashboard |
| Error Rate | <1% | `auth_google_link_failed` counter |

### Business Metrics

| Metric | Target | Benefit |
|--------|--------|---------|
| Sign-Up Conversion | +25% | Easier registration |
| Cart Abandonment | -15% | Faster checkout |
| User Retention | +30% | Less password friction |
| Support Tickets | -20% | Fewer password reset requests |

---

## ✅ Final Checklist

### Backend

- [ ] Environment variables configured (`.env` + Railway)
- [ ] Clerk webhook endpoint configured
- [ ] Google account linking endpoints added
- [ ] Service methods implemented
- [ ] Webhook handler updated
- [ ] Integration tests written
- [ ] Postman collection created

### Frontend

- [ ] Clerk SDK installed
- [ ] ClerkProvider configured
- [ ] Sign-in/sign-up pages created
- [ ] Google sign-in button added
- [ ] Account settings page created
- [ ] Protected routes configured
- [ ] Error handling implemented

### Clerk Dashboard

- [ ] Google OAuth provider enabled
- [ ] Redirect URIs configured
- [ ] Webhook endpoint set
- [ ] Test mode working
- [ ] Production credentials ready

### Google Cloud Console

- [ ] OAuth consent screen configured
- [ ] OAuth 2.0 credentials created
- [ ] Authorized redirect URIs added
- [ ] Scopes configured (`email`, `profile`)
- [ ] Production deployment ready

### Testing

- [ ] New user Google sign-up tested
- [ ] Existing user Google sign-in tested
- [ ] Account linking tested
- [ ] Account unlinking tested
- [ ] Error scenarios tested
- [ ] Integration tests passing
- [ ] Postman tests passing

### Documentation

- [ ] User guide written
- [ ] Developer setup documented
- [ ] README updated
- [ ] Architecture diagram created
- [ ] Troubleshooting guide complete

---

## 🚀 Next Steps

### Immediate (Today)

1. **Configure Clerk Dashboard** (30 min)
   - Enable Google OAuth
   - Set webhook URL
   - Copy credentials

2. **Update Backend** (2 hours)
   - Add linking endpoints
   - Update webhook handler
   - Test with Postman

3. **Test End-to-End** (30 min)
   - Sign up with Google
   - Link account
   - Verify database

### Short-Term (This Week)

1. **Frontend Integration** (3 hours)
   - Install Clerk SDK
   - Add sign-in UI
   - Create account settings

2. **Write Tests** (2 hours)
   - Integration tests
   - E2E tests
   - Postman collection

3. **Deploy to Production** (1 hour)
   - Update Railway environment variables
   - Test production OAuth flow
   - Monitor logs

### Long-Term (Next Month)

1. **Analytics** (4 hours)
   - Track Google SSO usage
   - Monitor conversion rates
   - A/B test sign-in flows

2. **Additional OAuth Providers** (6 hours)
   - Facebook OAuth (already supported)
   - GitHub OAuth
   - Apple Sign In

3. **Advanced Features** (8 hours)
   - Social profile sync
   - Google Contacts integration
   - Google Calendar integration

---

## 📚 Resources

### Documentation

- **Clerk Docs**: https://clerk.com/docs
- **Google OAuth**: https://developers.google.com/identity/protocols/oauth2
- **Next.js + Clerk**: https://clerk.com/docs/quickstarts/nextjs
- **Clerk Webhooks**: https://clerk.com/docs/integration/webhooks

### Support

- **Clerk Dashboard**: https://dashboard.clerk.com
- **Google Cloud Console**: https://console.cloud.google.com
- **Clerk Discord**: https://clerk.com/discord
- **Stack Overflow**: Tag `clerk` or `google-oauth`

### Code Examples

- **Clerk + Next.js Demo**: https://github.com/clerkinc/clerk-nextjs-starter
- **OAuth Best Practices**: https://oauth.net/2/
- **MASH Backend Auth Docs**: `docs/OAUTH_SETUP_GUIDE.md`

---

## 🎉 Congratulations!

Once complete, you'll have:
- ✅ **Seamless Google SSO** - One-click authentication
- ✅ **Account Linking** - Multiple auth methods per user
- ✅ **Enterprise Security** - Clerk's built-in protections
- ✅ **Better UX** - No password management needed
- ✅ **Unified Identity** - Single user across platforms

**Next Action:** Start with Phase 1, Step 1.1 - Update environment variables!

---

**Document Version:** 1.0.0  
**Last Updated:** November 15, 2025  
**Status:** 📋 Ready for Implementation  
**Estimated Time:** 6-8 hours total  
**Difficulty:** ⭐⭐⭐ Medium

**Questions?** Check the troubleshooting section or contact the development team.
