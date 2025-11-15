# 🚀 Google SSO with Clerk - Step-by-Step Implementation Guide

**Status:** ✅ Backend Implementation Complete  
**Date:** November 15, 2025  
**Completion:** Phase 1 (Backend) - 100% | Phase 2 (Frontend) - 0% | Phase 3 (Testing) - 0%

---

## ✅ What We Just Completed (Phase 1 - Backend)

### 1. Created Google Link/Unlink DTOs ✅
**File:** `src/modules/auth/dto/google-link.dto.ts`

Contains:
- `LinkGoogleAccountDto` - For linking Google accounts
- `GoogleLinkResponseDto` - Success response format
- `GoogleUnlinkResponseDto` - Unlink response format

### 2. Added Controller Endpoints ✅
**File:** `src/modules/auth/auth.controller.ts`

Added endpoints:
- `POST /auth/google/link` - Link Google account to current user
- `DELETE /auth/google/unlink` - Unlink Google account from current user

Features:
- Full Swagger documentation
- JWT authentication required
- Rate limiting protection
- Audit logging
- Comprehensive error handling

### 3. Implemented Service Methods ✅
**File:** `src/modules/auth/auth.service.ts`

Added methods:
- `linkGoogleAccount()` - Links Google OAuth to user
- `unlinkGoogleAccount()` - Removes Google OAuth from user

Features:
- Google token validation
- Duplicate account checking
- Safety checks (can't remove only auth method)
- Prometheus metrics tracking
- OpenTelemetry tracing

### 4. Enhanced Clerk Webhook Handler ✅
**File:** `src/modules/auth/auth.service.ts`

Updated:
- `createUser()` - Extracts Google OAuth data from Clerk
- `updateUser()` - Syncs Google account changes

Features:
- Automatic Google ID extraction from Clerk webhooks
- Email verification from Google
- Profile picture from Google
- OAuth provider tracking

---

## 📋 Next Steps - Complete Implementation

### Phase 1: Environment Setup (10 minutes) - **DO THIS NOW**

#### Step 1.1: Get Clerk Credentials

1. **Go to Clerk Dashboard:** https://dashboard.clerk.com
2. **Create Application** (if not exists):
   - Click "Create Application"
   - Name: "MASH Backend"
   - Select "Email" and "Google" as sign-in options
3. **Copy Keys:**
   - Copy `PUBLISHABLE_KEY` (starts with `pk_test_` or `pk_live_`)
   - Copy `SECRET_KEY` (starts with `sk_test_` or `sk_live_`)

#### Step 1.2: Enable Google OAuth in Clerk

1. In Clerk Dashboard → **User & Authentication** → **Social Connections**
2. Click **"Configure"** on Google
3. **Enable** Google OAuth
4. Configure settings:
   - ✅ Enable for sign-up
   - ✅ Enable for sign-in
   - ✅ Require email verification
5. **Copy OAuth redirect URI** from Clerk (e.g., `https://your-app.clerk.accounts.dev/v1/oauth_callback`)

#### Step 1.3: Setup Google Cloud Console

1. **Go to:** https://console.cloud.google.com
2. **Create Project** (if needed):
   - Project name: "MASH Authentication"
3. **Enable APIs:**
   - Search "Google+ API" → Enable
4. **Configure OAuth Consent Screen:**
   - Go to **APIs & Services** → **OAuth consent screen**
   - User Type: **External**
   - App name: "MASH Mushroom Automation"
   - Support email: `MASH.Mushroom.Automation@gmail.com`
   - Scopes: Add `email`, `profile`, `openid`
   - Save

5. **Create OAuth Credentials:**
   - Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: "MASH Backend - Production"
   - **Authorized JavaScript origins:**
     ```
     http://localhost:3000
     http://localhost:3001
     https://mash-backend-api-production.up.railway.app
     https://yourdomain.com
     ```
   - **Authorized redirect URIs:**
     ```
     [PASTE CLERK'S OAUTH CALLBACK URL FROM STEP 1.2]
     ```
   - Click **Create**
   - **Copy Client ID and Client Secret**

#### Step 1.4: Link Google Credentials to Clerk

1. Back in Clerk Dashboard → Google settings
2. **Paste Google Client ID**
3. **Paste Google Client Secret**
4. **Save**
5. Test with "Test OAuth" button

#### Step 1.5: Update .env File

**Add/Update these variables in `.env`:**

```env
# ============================================================================
# CLERK CONFIGURATION - Google SSO Integration
# ============================================================================
# Status: ✅ CONFIGURED
# Last Updated: November 15, 2025

# Enable Clerk authentication
CLERK_ENABLED=true

# Clerk API Keys (from https://dashboard.clerk.com)
CLERK_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE

# Webhook secret for Clerk webhooks (from Clerk Dashboard → Webhooks)
CLERK_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# JWT key for Clerk token verification
CLERK_JWT_KEY=YOUR_CLERK_JWT_KEY_HERE

# Google OAuth Credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE

# Frontend URL for OAuth redirects
FRONTEND_URL=https://yourdomain.com
# or for development:
# FRONTEND_URL=http://localhost:3001

# Clerk redirect URLs (after sign-in/sign-up)
CLERK_AFTER_SIGN_IN_URL=/dashboard
CLERK_AFTER_SIGN_UP_URL=/onboarding
```

**Important:** Replace all `YOUR_*_HERE` placeholders with actual values!

#### Step 1.6: Configure Clerk Webhook

1. In Clerk Dashboard → **Webhooks**
2. Click **"Add Endpoint"**
3. **Endpoint URL:**
   ```
   https://mash-backend-api-production.up.railway.app/api/v1/auth/clerk-webhook
   ```
   (or your actual backend URL)
4. **Subscribe to events:**
   - ✅ `user.created`
   - ✅ `user.updated`
   - ✅ `user.deleted`
5. **Copy Webhook Secret** → Add to `.env` as `CLERK_WEBHOOK_SECRET`
6. **Save**

#### Step 1.7: Deploy to Railway

```bash
# Commit changes
git add .
git commit -m "feat: Add Google SSO integration with Clerk"
git push origin main
```

**In Railway Dashboard:**
1. Go to your project
2. **Variables** → Add all Clerk variables from `.env`
3. Click **Deploy**
4. Wait for deployment to complete

---

### Phase 2: Frontend Integration (3-4 hours)

#### Step 2.1: Install Clerk SDK

**For Next.js 14+ (App Router):**
```bash
npm install @clerk/nextjs
```

**For React (Vite/CRA):**
```bash
npm install @clerk/clerk-react
```

**For Vue.js:**
```bash
npm install @clerk/vue
```

#### Step 2.2: Configure Clerk Provider

**Next.js App Router - `app/layout.tsx`:**

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
          formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
          card: 'shadow-lg',
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

**Environment Variables (`.env.local`):**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
```

#### Step 2.3: Create Sign-In Page

**`app/sign-in/[[...sign-in]]/page.tsx`:**

```typescript
'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-xl border-2 border-gray-200',
          },
        }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/dashboard"
      />
    </div>
  );
}
```

#### Step 2.4: Create Sign-Up Page

**`app/sign-up/[[...sign-up]]/page.tsx`:**

```typescript
'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-xl border-2 border-gray-200',
          },
        }}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        afterSignUpUrl="/dashboard"
      />
    </div>
  );
}
```

#### Step 2.5: Add Protected Route Middleware

**`middleware.ts`:**

```typescript
import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  // Public routes that don't require authentication
  publicRoutes: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/webhooks/clerk',
  ],
  
  // Routes that are always public
  ignoredRoutes: ['/api/health', '/api/metrics'],
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

#### Step 2.6: Create Dashboard Page (Protected)

**`app/dashboard/page.tsx`:**

```typescript
import { currentUser } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const googleAccount = user.externalAccounts.find(
    (acc) => acc.provider === 'google'
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {user.firstName || 'User'}!
        </h1>
        
        <div className="mt-6 rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Account Information</h2>
          <div className="mt-4 space-y-2">
            <p><strong>Email:</strong> {user.emailAddresses[0]?.emailAddress}</p>
            <p><strong>User ID:</strong> {user.id}</p>
            
            {googleAccount && (
              <div className="mt-4 rounded-lg bg-green-50 p-4">
                <p className="flex items-center text-green-800">
                  <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  ✓ Signed in with Google
                </p>
                <p className="mt-1 text-sm text-green-600">
                  Google Account: {googleAccount.emailAddress}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### Step 2.7: Create Account Settings Page

**`app/settings/account/page.tsx`:**

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
      alert('Failed to link Google account. Please try again.');
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
      alert('Failed to unlink Google account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>

        <div className="mt-6 rounded-lg border bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Connected Accounts</h2>
          
          <div className="mt-4 flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-6 w-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium">Google</p>
                {isGoogleLinked ? (
                  <p className="text-sm text-green-600">
                    ✓ {googleAccount.emailAddress}
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
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Linking...' : 'Link Account'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Phase 3: Testing (1 hour)

#### Test Scenario 1: New User Google Sign-Up

1. Open frontend: `http://localhost:3001/sign-up`
2. Click **"Continue with Google"**
3. Select Google account
4. Grant permissions
5. **Verify:**
   - ✅ Redirected to `/dashboard`
   - ✅ User created in database with `googleId`
   - ✅ Welcome email sent
   - ✅ Email marked as verified

**Backend check:**
```bash
# Check Railway logs
railway logs --tail 50

# Should see:
# ✅ Created new user: user@gmail.com
# ✅ Google account linked
```

#### Test Scenario 2: Existing User Google Sign-In

1. User already has account with password
2. Go to `http://localhost:3001/sign-in`
3. Click **"Continue with Google"**
4. **Verify:**
   - ✅ Authenticated successfully
   - ✅ Dashboard shows "✓ Signed in with Google"
   - ✅ No duplicate user created

#### Test Scenario 3: Link Google to Email/Password Account

1. Sign in with email/password
2. Go to `/settings/account`
3. Click **"Link Account"** on Google
4. Authorize with Google
5. **Verify:**
   - ✅ Success message shown
   - ✅ `googleId` added to user record
   - ✅ Can now sign in with Google

**Backend API Test (Postman):**
```http
POST {{baseUrl}}/auth/google/link
Authorization: Bearer {{jwtToken}}
Content-Type: application/json

{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
}
```

Expected Response:
```json
{
  "success": true,
  "message": "Google account linked successfully",
  "data": {
    "googleId": "1234567890",
    "email": "user@gmail.com",
    "linkedAt": "2025-11-15T10:30:00.000Z"
  }
}
```

#### Test Scenario 4: Unlink Google Account

1. User has both email/password AND Google linked
2. Go to `/settings/account`
3. Click **"Unlink"** on Google
4. Confirm action
5. **Verify:**
   - ✅ `googleId` removed from database
   - ✅ Can still sign in with email/password
   - ✅ Cannot sign in with Google anymore

**Backend API Test (Postman):**
```http
DELETE {{baseUrl}}/auth/google/unlink
Authorization: Bearer {{jwtToken}}
```

Expected Response:
```json
{
  "success": true,
  "message": "Google account unlinked successfully"
}
```

#### Test Scenario 5: Error Cases

**Test 5.1: Try to unlink Google when it's only auth method**
```http
DELETE {{baseUrl}}/auth/google/unlink
Authorization: Bearer {{jwtToken}}
```

Expected Error:
```json
{
  "statusCode": 400,
  "message": "Cannot unlink Google account. Please set a password first.",
  "error": "Bad Request"
}
```

**Test 5.2: Try to link Google account already used by another user**
```http
POST {{baseUrl}}/auth/google/link
Authorization: Bearer {{jwtToken}}
Content-Type: application/json

{
  "idToken": "already_linked_google_token"
}
```

Expected Error:
```json
{
  "statusCode": 409,
  "message": "This Google account is already linked to another user",
  "error": "Conflict"
}
```

---

### Phase 4: Production Deployment (30 minutes)

#### Step 4.1: Update Railway Environment Variables

1. Go to Railway Dashboard → Your Project
2. **Variables** tab
3. Add/Update:
   ```
   CLERK_ENABLED=true
   CLERK_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY
   CLERK_SECRET_KEY=sk_live_YOUR_LIVE_KEY
   CLERK_WEBHOOK_SECRET=whsec_YOUR_LIVE_SECRET
   GOOGLE_CLIENT_ID=YOUR_PRODUCTION_CLIENT_ID
   GOOGLE_CLIENT_SECRET=YOUR_PRODUCTION_SECRET
   FRONTEND_URL=https://yourdomain.com
   ```

#### Step 4.2: Update Google Cloud Console for Production

1. Go to Google Cloud Console → Credentials
2. Edit your OAuth Client
3. Add production URLs:
   ```
   Authorized JavaScript origins:
   - https://mash-backend-api-production.up.railway.app
   - https://yourdomain.com
   
   Authorized redirect URIs:
   - [Your Clerk production OAuth callback URL]
   ```

#### Step 4.3: Update Clerk Webhook for Production

1. Clerk Dashboard → Webhooks
2. Update endpoint URL:
   ```
   https://mash-backend-api-production.up.railway.app/api/v1/auth/clerk-webhook
   ```

#### Step 4.4: Deploy

```bash
git add .
git commit -m "chore: Update production configuration for Google SSO"
git push origin main
```

**Monitor deployment:**
```bash
railway logs --tail 100
```

Look for:
```
✅ Clerk client initialized
✅ Google OAuth configured
🚀 Application started on port 3000
```

---

## 📊 Success Checklist

### Backend ✅
- [x] DTOs created (`google-link.dto.ts`)
- [x] Controller endpoints added (`auth.controller.ts`)
- [x] Service methods implemented (`auth.service.ts`)
- [x] Clerk webhook handler enhanced
- [x] Swagger documentation complete
- [x] Error handling implemented
- [x] Metrics tracking added

### Environment Setup ⏳
- [ ] Clerk account created
- [ ] Google Cloud Console project created
- [ ] OAuth credentials generated
- [ ] Clerk connected to Google OAuth
- [ ] `.env` file updated
- [ ] Railway variables configured
- [ ] Clerk webhook configured

### Frontend Integration ⏳
- [ ] Clerk SDK installed
- [ ] ClerkProvider configured
- [ ] Sign-in page created
- [ ] Sign-up page created
- [ ] Dashboard page created
- [ ] Account settings page created
- [ ] Middleware for protected routes

### Testing ⏳
- [ ] New user Google sign-up tested
- [ ] Existing user Google sign-in tested
- [ ] Link Google account tested
- [ ] Unlink Google account tested
- [ ] Error scenarios tested
- [ ] Postman collection created

### Production Deployment ⏳
- [ ] Railway environment variables updated
- [ ] Google Cloud Console production URLs added
- [ ] Clerk webhook production URL updated
- [ ] Production deployment successful
- [ ] Monitoring configured

---

## 🎯 Quick Start (15 Minutes)

**For immediate testing:**

1. **Get Clerk credentials** (5 min):
   - Visit https://dashboard.clerk.com
   - Create app, enable Google
   - Copy keys

2. **Update `.env`** (2 min):
   ```bash
   CLERK_ENABLED=true
   CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

3. **Restart server** (1 min):
   ```bash
   npm run build
   npm run start:dev
   ```

4. **Test API** (5 min):
   - Open Swagger: http://localhost:3000/api
   - Try `POST /auth/google/link`
   - Check logs for Clerk initialization

5. **Verify** (2 min):
   ```bash
   # Check logs
   railway logs --tail 20
   
   # Should see:
   # ✅ Clerk client initialized
   ```

---

## 📚 Additional Resources

### Documentation
- **Clerk Docs:** https://clerk.com/docs
- **Google OAuth:** https://developers.google.com/identity/protocols/oauth2
- **Next.js + Clerk:** https://clerk.com/docs/quickstarts/nextjs

### Support
- **Clerk Dashboard:** https://dashboard.clerk.com
- **Google Cloud Console:** https://console.cloud.google.com
- **Clerk Discord:** https://clerk.com/discord

### Code Examples
- **Clerk + Next.js Starter:** https://github.com/clerkinc/clerk-nextjs-starter
- **OAuth Best Practices:** https://oauth.net/2/

---

## 🎉 Completion Status

**Current Progress:** 33% Complete

- ✅ Phase 1: Backend Implementation (100%)
- ⏳ Phase 2: Environment Setup (0%)
- ⏳ Phase 3: Frontend Integration (0%)
- ⏳ Phase 4: Testing (0%)
- ⏳ Phase 5: Production Deployment (0%)

**Next Immediate Action:** 
**→ Follow Phase 1 (Environment Setup) to configure Clerk and Google OAuth credentials**

---

**Questions?** Check the troubleshooting section in `GOOGLE_SSO_CLERK_IMPLEMENTATION_PLAN.md`

**Need help?** Contact the development team or check Clerk documentation.
