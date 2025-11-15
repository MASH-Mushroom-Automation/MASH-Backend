# 🎯 Google SSO with Clerk - Complete Step-by-Step Guide

**Last Updated:** November 15, 2025  
**Current Status:** Phase 2 - Environment Setup  
**Time to Complete:** 10 minutes for Phase 2, then 3-4 hours for frontend

---

## ✅ PHASE 1: BACKEND IMPLEMENTATION - COMPLETE!

Great news! The backend is fully implemented and working:

- ✅ **DTOs Created**: `google-link.dto.ts` with proper validation
- ✅ **Endpoints Ready**: POST `/auth/social/link/google`, DELETE `/auth/social/unlink`
- ✅ **Service Methods**: `linkGoogleAccount()`, `unlinkSocialAccount()`
- ✅ **Webhook Handlers**: Automatically extract Google OAuth from Clerk
- ✅ **Build Successful**: All TypeScript errors fixed
- ✅ **Database Ready**: User model has `googleId`, `clerkId`, `oauthProvider[]`

**Files Modified:**
- `src/modules/auth/dto/google-link.dto.ts` (NEW)
- `src/modules/auth/auth.controller.ts` (ENHANCED)
- `src/modules/auth/auth.service.ts` (ENHANCED)

---

## 🚀 PHASE 2: ENVIRONMENT SETUP (DO THIS NOW - 10 MINUTES)

### Step 2.1: Get Clerk Credentials (3 minutes)

#### Action Items:
1. **Visit Clerk Dashboard**
   - Go to: https://dashboard.clerk.com
   - Sign in with your account

2. **Select Your Application**
   - If you have an existing application, select it
   - If not, click "Add application" and name it (e.g., "MASH Backend")

3. **Copy Your Keys**
   - Go to **API Keys** section in the left sidebar
   - You'll see two keys:
     - **Publishable Key**: `pk_test_...` or `pk_live_...`
     - **Secret Key**: `sk_test_...` or `sk_live_...`
   - Click the copy button for each
   - **IMPORTANT**: Keep these secret! Never commit to Git

#### Expected Result:
```
Publishable Key: pk_test_YW11c2VkLWxhZHliaXJkLTI2LmNsZXJrLmFjY291bnRzLmRldiQ
Secret Key: sk_test_RygR2hOh8zf6ZD17eiFQ1gFJdQxVmYtfSAGfv05VcO
```

---

### Step 2.2: Enable Google OAuth in Clerk (2 minutes)

#### Action Items:
1. **Navigate to Social Connections**
   - In Clerk Dashboard, go to **User & Authentication** → **Social Connections**

2. **Enable Google**
   - Find **Google** in the list of providers
   - Toggle the switch to **ON**
   - You'll see a modal with two options:
     - "Use Clerk's credentials" (quickest for testing)
     - "Use custom credentials" (required for production)

3. **Choose Setup Method**
   
   **Option A: Quick Setup (Testing/Development)**
   - Click "Use Clerk's credentials"
   - Google OAuth is now enabled!
   - **Note**: User data is shared with Clerk
   - **Best for**: Local development, testing

   **Option B: Custom Setup (Production Ready)**
   - Click "Use custom credentials"
   - You'll need to set up Google Cloud Console (see Step 2.3)
   - **Best for**: Production deployment

4. **Copy Redirect URI**
   - After enabling, copy the **Authorized redirect URI**
   - Example: `https://your-app.clerk.accounts.dev/v1/oauth_callback`
   - You'll need this for Google Cloud Console

#### Expected Result:
- Google appears as **Enabled** in Social Connections
- You have the redirect URI copied

---

### Step 2.3: Set Up Google Cloud Console (5 minutes) - OPTIONAL FOR TESTING

**Skip this step if you chose "Use Clerk's credentials" in Step 2.2**

#### Action Items:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create a Project (if needed)**
   - Click **Select a project** at the top
   - Click **New Project**
   - Name it (e.g., "MASH Backend")
   - Click **Create**

3. **Enable Google+ API**
   - Go to **APIs & Services** → **Library**
   - Search for "Google+ API"
   - Click **Enable**

4. **Create OAuth 2.0 Credentials**
   - Go to **APIs & Services** → **Credentials**
   - Click **+ CREATE CREDENTIALS** → **OAuth client ID**
   - Application type: **Web application**
   - Name: "MASH Backend - Clerk"
   
5. **Add Authorized Redirect URIs**
   - In the "Authorized redirect URIs" section, click **+ ADD URI**
   - Paste the redirect URI you copied from Clerk (Step 2.2)
   - Example: `https://your-app.clerk.accounts.dev/v1/oauth_callback`
   - Click **CREATE**

6. **Copy Credentials**
   - You'll see a modal with:
     - **Client ID**: `1234567890-abc123def456.apps.googleusercontent.com`
     - **Client Secret**: `GOCSPX-abc123def456`
   - Click **Download JSON** and save it
   - **Or** copy both values directly

7. **Add Credentials to Clerk**
   - Go back to Clerk Dashboard → Social Connections → Google
   - Click **Settings** (gear icon)
   - Paste:
     - Client ID
     - Client Secret
   - Click **Save**

#### Expected Result:
```
Google OAuth Client ID: 1234567890-abc123def456.apps.googleusercontent.com
Google OAuth Client Secret: GOCSPX-abc123def456
```

---

### Step 2.4: Update .env File (2 minutes)

#### Action Items:

1. **Open `.env` file** in your project root

2. **Update Clerk Configuration**
   ```env
   # Clerk Configuration
   CLERK_ENABLED=true  # ⚠️ CHANGE FROM false TO true
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_[YOUR_KEY_FROM_STEP_2.1]
   CLERK_SECRET_KEY=sk_test_[YOUR_KEY_FROM_STEP_2.1]
   CLERK_WEBHOOK_SECRET=whsec_[GET_THIS_IN_STEP_2.5]
   ```

3. **Update Google OAuth Configuration** (if using custom credentials)
   ```env
   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=[YOUR_CLIENT_ID_FROM_STEP_2.3]
   GOOGLE_CLIENT_SECRET=[YOUR_CLIENT_SECRET_FROM_STEP_2.3]
   ```

4. **Verify Frontend URL** (important for webhooks)
   ```env
   # Frontend URLs
   FRONTEND_URL=https://mash-backend-api-production.up.railway.app
   ```

#### Expected Result:
Your `.env` should look like this:
```env
# Clerk Configuration
CLERK_ENABLED=true  # ✅ Changed to true
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YW11c2VkLWxhZHliaXJkLTI2LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_RygR2hOh8zf6ZD17eiFQ1gFJdQxVmYtfSAGfv05VcO
CLERK_WEBHOOK_SECRET=whsec_[COMING_IN_STEP_2.5]

# Google OAuth (if using custom credentials)
GOOGLE_CLIENT_ID=1234567890-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456
```

---

### Step 2.5: Configure Clerk Webhook (3 minutes)

#### Action Items:

1. **Determine Your Webhook URL**
   
   **For Local Development:**
   - You need to expose localhost to the internet
   - Use ngrok: `ngrok http 3000`
   - Your webhook URL: `https://[ngrok-subdomain].ngrok.io/api/v1/auth/clerk-webhook`
   
   **For Production (Railway):**
   - Your webhook URL: `https://mash-backend-api-production.up.railway.app/api/v1/auth/clerk-webhook`

2. **Add Webhook in Clerk Dashboard**
   - Go to **Webhooks** in the left sidebar
   - Click **+ Add Endpoint**
   - Paste your webhook URL
   - Select events to listen to:
     - ✅ `user.created`
     - ✅ `user.updated`
     - ✅ `user.deleted`
   - Click **Create**

3. **Copy Webhook Secret**
   - After creating, you'll see a **Signing Secret**
   - Click **Reveal** and copy it
   - Example: `whsec_abc123def456...`

4. **Update .env with Webhook Secret**
   ```env
   CLERK_WEBHOOK_SECRET=whsec_[PASTE_YOUR_SECRET_HERE]
   ```

5. **Test Webhook (Optional)**
   - In Clerk Dashboard → Webhooks → Your endpoint
   - Click **Send test event**
   - Choose `user.created`
   - Check your backend logs for: "✅ Clerk webhook processed successfully"

#### Expected Result:
- Webhook endpoint created in Clerk
- Webhook secret copied to `.env`
- Test event sent successfully (optional)

---

## ✅ PHASE 2 COMPLETE! - Quick Verification

Before moving to Phase 3, verify everything is working:

### Verification Checklist:

```bash
# 1. Restart your development server
npm run start:dev

# Expected output:
# ✅ Clerk client initialized
# 🚀 Application listening on port 3000
```

### Test the Backend:

1. **Check Swagger Documentation**
   - Open: http://localhost:3000/api
   - Look for endpoints:
     - `POST /api/v1/auth/social/link/google`
     - `DELETE /api/v1/auth/social/unlink`

2. **Check Health Endpoint**
   ```bash
   curl http://localhost:3000/api/v1/health
   ```
   Expected: `{"status":"ok"}`

3. **Verify Clerk Integration**
   - Check logs for: "✅ Clerk client initialized"
   - If you see this, Clerk is working!

---

## 🎨 PHASE 3: FRONTEND INTEGRATION (3-4 HOURS)

Now that the backend is ready, let's build the frontend!

### Step 3.1: Install Clerk SDK (5 minutes)

**For Next.js Frontend:**
```bash
npm install @clerk/nextjs
```

**For React (Vite/CRA) Frontend:**
```bash
npm install @clerk/clerk-react
```

---

### Step 3.2: Configure Clerk Provider (10 minutes)

#### For Next.js:

**File: `app/layout.tsx` or `pages/_app.tsx`**

```typescript
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={{
        elements: {
          formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
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

**Create `.env.local`:**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YW11c2VkLWxhZHliaXJkLTI2LmNsZXJrLmFjY291bnRzLmRldiQ
```

#### For React (Vite):

**File: `src/main.tsx`**

```typescript
import { ClerkProvider } from '@clerk/clerk-react';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
```

**Create `.env.local`:**
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YW11c2VkLWxhZHliaXJkLTI2LmNsZXJrLmFjY291bnRzLmRldiQ
```

---

### Step 3.3: Create Sign-In Page (30 minutes)

**File: `app/sign-in/page.tsx` (Next.js) or `src/pages/SignIn.tsx` (React)**

```typescript
'use client'; // Only for Next.js App Router

import { SignIn } from '@clerk/nextjs'; // or '@clerk/clerk-react'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          Sign in to MASH
        </h1>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-lg',
            },
          }}
          routing="path"
          path="/sign-in"
          redirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

**Features Included:**
- ✅ Email/password sign-in
- ✅ Google OAuth sign-in (one-click)
- ✅ "Forgot password" link
- ✅ "Sign up" link
- ✅ Full validation and error handling

---

### Step 3.4: Create Sign-Up Page (30 minutes)

**File: `app/sign-up/page.tsx` (Next.js) or `src/pages/SignUp.tsx` (React)**

```typescript
'use client'; // Only for Next.js App Router

import { SignUp } from '@clerk/nextjs'; // or '@clerk/clerk-react'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          Create your MASH account
        </h1>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-lg',
            },
          }}
          routing="path"
          path="/sign-up"
          redirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

**Features Included:**
- ✅ Email/password registration
- ✅ Google OAuth sign-up (one-click)
- ✅ Email verification
- ✅ Full validation and error handling
- ✅ Automatic webhook to backend (creates user in your database)

---

### Step 3.5: Add Protected Route Middleware (20 minutes)

**File: `middleware.ts` (Next.js root) or custom hook (React)**

#### For Next.js:

```typescript
import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  // Public routes that don't require authentication
  publicRoutes: [
    '/',
    '/sign-in',
    '/sign-up',
    '/api/v1/health',
  ],
  
  // Routes that require authentication
  ignoredRoutes: [],
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

#### For React (Custom Hook):

```typescript
// hooks/useProtectedRoute.ts
import { useAuth } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useProtectedRoute() {
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isSignedIn, isLoaded, navigate]);

  return { isSignedIn, isLoaded };
}

// Usage in protected pages:
function DashboardPage() {
  const { isSignedIn, isLoaded } = useProtectedRoute();
  
  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return null;
  
  return <div>Dashboard Content</div>;
}
```

---

### Step 3.6: Create Dashboard Page with User Info (30 minutes)

**File: `app/dashboard/page.tsx` (Next.js) or `src/pages/Dashboard.tsx` (React)**

```typescript
'use client'; // Only for Next.js App Router

import { UserButton, useUser } from '@clerk/nextjs'; // or '@clerk/clerk-react'
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [backendUser, setBackendUser] = useState<any>(null);

  // Fetch user data from your backend
  useEffect(() => {
    if (user) {
      fetchUserFromBackend();
    }
  }, [user]);

  const fetchUserFromBackend = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${await user?.getToken()}`,
        },
      });
      const data = await response.json();
      setBackendUser(data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <UserButton afterSignOutUrl="/" />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Information</h2>
          <div className="space-y-2">
            <p><strong>Name:</strong> {user?.fullName}</p>
            <p><strong>Email:</strong> {user?.primaryEmailAddress?.emailAddress}</p>
            <p><strong>User ID:</strong> {user?.id}</p>
            <p><strong>Email Verified:</strong> {user?.primaryEmailAddress?.verification?.status}</p>
          </div>
        </div>

        {backendUser && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Backend Data</h2>
            <div className="space-y-2">
              <p><strong>Database ID:</strong> {backendUser.id}</p>
              <p><strong>Role:</strong> {backendUser.role}</p>
              <p><strong>OAuth Providers:</strong> {backendUser.oauthProvider?.join(', ')}</p>
              <p><strong>Created:</strong> {new Date(backendUser.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Step 3.7: Create Account Settings with Link/Unlink (1 hour)

**File: `app/settings/page.tsx` (Next.js) or `src/pages/Settings.tsx` (React)**

```typescript
'use client'; // Only for Next.js App Router

import { useUser } from '@clerk/nextjs'; // or '@clerk/clerk-react'
import { useState } from 'react';

export default function SettingsPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLinkGoogle = async () => {
    setLoading(true);
    setMessage('');

    try {
      // Get Google ID token from Clerk
      const token = await user?.getToken();
      
      // Call your backend to link Google account
      const response = await fetch('http://localhost:3000/api/v1/auth/social/link/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          idToken: token, // In production, get this from Google Sign-In button
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('✅ Google account linked successfully!');
      } else {
        setMessage(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      setMessage('❌ Failed to link Google account');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!confirm('Are you sure you want to unlink your Google account?')) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const token = await user?.getToken();
      
      const response = await fetch('http://localhost:3000/api/v1/auth/social/unlink?provider=google', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('✅ Google account unlinked successfully!');
      } else {
        setMessage(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      setMessage('❌ Failed to unlink Google account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Connected Accounts</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded">
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  {/* Google icon SVG */}
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <div>
                  <p className="font-medium">Google</p>
                  <p className="text-sm text-gray-500">
                    {user?.externalAccounts?.find(acc => acc.provider === 'google')
                      ? 'Connected'
                      : 'Not connected'}
                  </p>
                </div>
              </div>
              
              <div>
                {user?.externalAccounts?.find(acc => acc.provider === 'google') ? (
                  <button
                    onClick={handleUnlinkGoogle}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? 'Unlinking...' : 'Unlink'}
                  </button>
                ) : (
                  <button
                    onClick={handleLinkGoogle}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Linking...' : 'Link Google'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {message && (
            <div className={`mt-4 p-4 rounded ${message.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 🧪 PHASE 4: TESTING (1 HOUR)

### Test Scenario 1: New User Sign-Up with Google (10 minutes)

**Steps:**
1. Open your frontend: http://localhost:3000/sign-up
2. Click "Continue with Google"
3. Select a Google account
4. **Expected Results:**
   - ✅ Redirected to dashboard
   - ✅ User created in your database (check Prisma Studio)
   - ✅ `googleId` field populated
   - ✅ `oauthProvider` contains 'google'
   - ✅ `emailVerified` is true
   - ✅ Welcome email sent (check logs)

**Verify in Backend:**
```bash
# Check logs for:
# "✅ Clerk webhook received: user.created"
# "✅ Created new user: user@gmail.com"
# "✅ User created successfully"
```

**Verify in Database:**
```bash
npx prisma studio
# Navigate to User table
# Find user by email
# Check: googleId, clerkId, oauthProvider, emailVerified
```

---

### Test Scenario 2: Existing User Sign-In with Google (10 minutes)

**Steps:**
1. Sign out if logged in
2. Go to: http://localhost:3000/sign-in
3. Click "Continue with Google"
4. Select the same Google account from Scenario 1
5. **Expected Results:**
   - ✅ Signed in immediately
   - ✅ Redirected to dashboard
   - ✅ User data displayed correctly
   - ✅ No duplicate user created

---

### Test Scenario 3: Link Google to Email/Password Account (15 minutes)

**Setup:**
1. Create an email/password account:
   - Go to http://localhost:3000/sign-up
   - Use email: `test@example.com`, password: `Test1234!`
   - Verify email (check Clerk dashboard if needed)
2. Sign in with email/password

**Test:**
1. Go to http://localhost:3000/settings
2. Click "Link Google" button
3. Select your Google account
4. **Expected Results:**
   - ✅ Success message: "Google account linked successfully"
   - ✅ Database updated with `googleId`
   - ✅ `oauthProvider` now includes 'google'
   - ✅ Can now sign in with either email/password OR Google

**Verify:**
```bash
# Call backend API directly
curl -X GET http://localhost:3000/api/v1/auth/social/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected response:
{
  "linkedProviders": ["google"],
  "googleId": "1234567890",
  "facebookId": null,
  "canUnlink": true
}
```

---

### Test Scenario 4: Unlink Google Account (10 minutes)

**Prerequisites:**
- Must have password set (from Scenario 3)
- Must have Google account linked

**Steps:**
1. Go to http://localhost:3000/settings
2. Click "Unlink" button next to Google
3. Confirm the action
4. **Expected Results:**
   - ✅ Success message: "Google account unlinked successfully"
   - ✅ `googleId` removed from database
   - ✅ `oauthProvider` no longer includes 'google'
   - ✅ Can still sign in with email/password
   - ✅ Cannot sign in with Google anymore

---

### Test Scenario 5: Error Cases (15 minutes)

#### Test 5.1: Try to Unlink Without Password
**Steps:**
1. Sign up with Google only (no password)
2. Go to settings
3. Try to unlink Google
4. **Expected Result:**
   - ❌ Error: "Cannot unlink Google account. Please set a password first."

#### Test 5.2: Link Google Account Already Used
**Steps:**
1. Create User A with Google
2. Create User B with email/password
3. Try to link User A's Google account to User B
4. **Expected Result:**
   - ❌ Error: "This Google account is already linked to another user"

#### Test 5.3: Invalid Google Token
**Steps:**
1. Call API with invalid token:
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/social/link/google \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"idToken": "invalid_token"}'
   ```
2. **Expected Result:**
   - ❌ Error 400: "Invalid Google token"

---

## 📊 SUCCESS METRICS

After completing all phases, you should have:

### Technical Metrics:
- ✅ Backend build successful (no TypeScript errors)
- ✅ Clerk webhook responding with 200 status
- ✅ Database has users with `googleId`, `clerkId`, `oauthProvider`
- ✅ API endpoints responding correctly
- ✅ Frontend successfully calling backend APIs

### User Experience Metrics:
- ✅ Users can sign up with Google in < 5 seconds
- ✅ Users can sign in with Google in < 3 seconds
- ✅ Users can link/unlink accounts seamlessly
- ✅ Error messages are clear and helpful
- ✅ No duplicate accounts created

### Security Metrics:
- ✅ Clerk webhook signature verified
- ✅ Google tokens validated
- ✅ Cannot unlink last authentication method
- ✅ Cannot link already-used Google accounts
- ✅ JWT tokens properly validated

---

## 🚨 TROUBLESHOOTING

### Issue 1: "Clerk webhook not receiving events"

**Symptoms:**
- User created in Clerk but not in your database
- No logs showing webhook received

**Solutions:**
1. **Check webhook URL is correct**
   ```bash
   # Test webhook endpoint
   curl http://localhost:3000/api/v1/auth/clerk-webhook
   # Should return 405 Method Not Allowed (POST required)
   ```

2. **Use ngrok for local development**
   ```bash
   ngrok http 3000
   # Copy the https URL and update in Clerk dashboard
   ```

3. **Check webhook secret matches**
   ```bash
   # In .env:
   CLERK_WEBHOOK_SECRET=whsec_...
   # Must match Clerk dashboard
   ```

4. **Check logs**
   ```bash
   # Look for:
   # "✅ Clerk webhook received: user.created"
   # "✅ Clerk webhook processed successfully"
   ```

---

### Issue 2: "Google sign-in redirects but user not created"

**Symptoms:**
- Google OAuth completes
- Redirected to dashboard
- But no user in database

**Solutions:**
1. **Check Clerk webhook is configured** (see Issue 1)

2. **Verify Google is enabled in Clerk**
   - Go to Clerk Dashboard → Social Connections
   - Ensure Google is ON

3. **Check backend logs for errors**
   ```bash
   # Look for:
   # "❌ Failed to create user: ..."
   # "❌ Clerk webhook error: ..."
   ```

---

### Issue 3: "Cannot link Google account"

**Symptoms:**
- Click "Link Google" button
- Error: "This Google account is already linked to another user"

**Solutions:**
1. **Check if Google account is already in use**
   ```bash
   npx prisma studio
   # Search for googleId in User table
   ```

2. **Unlink from the other account first**
   - Sign in with the other account
   - Go to settings
   - Unlink Google
   - Then try linking again

---

### Issue 4: "Build errors after updating code"

**Solutions:**
```bash
# Clean install
rmdir /s /q node_modules dist
del package-lock.json
npm install --legacy-peer-deps
npx prisma generate
npm run build
```

---

## 📝 QUICK REFERENCE

### Important URLs:

| Purpose | URL |
|---------|-----|
| Clerk Dashboard | https://dashboard.clerk.com |
| Google Cloud Console | https://console.cloud.google.com |
| Local Backend API | http://localhost:3000/api |
| Swagger Docs | http://localhost:3000/api |
| Prisma Studio | Run `npx prisma studio` |

### API Endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/auth/social/link/google` | Link Google account |
| DELETE | `/api/v1/auth/social/unlink` | Unlink social account |
| GET | `/api/v1/auth/social/status` | Get OAuth status |
| POST | `/api/v1/auth/clerk-webhook` | Clerk webhook receiver |
| GET | `/api/v1/auth/me` | Get current user |

### Environment Variables:

```env
# Clerk
CLERK_ENABLED=true
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Google OAuth (optional)
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# Frontend
FRONTEND_URL=https://...
```

---

## ✅ COMPLETION CHECKLIST

Use this checklist to track your progress:

### Phase 1: Backend ✅
- [x] DTOs created
- [x] Controller endpoints added
- [x] Service methods implemented
- [x] Webhook handlers enhanced
- [x] Build successful

### Phase 2: Environment Setup
- [ ] Clerk credentials obtained
- [ ] Google OAuth enabled in Clerk
- [ ] Google Cloud Console configured (optional)
- [ ] .env file updated
- [ ] Clerk webhook configured
- [ ] Backend restarted and verified

### Phase 3: Frontend Integration
- [ ] Clerk SDK installed
- [ ] Clerk Provider configured
- [ ] Sign-in page created
- [ ] Sign-up page created
- [ ] Protected route middleware added
- [ ] Dashboard created
- [ ] Account settings created

### Phase 4: Testing
- [ ] Test 1: New user sign-up with Google
- [ ] Test 2: Existing user sign-in with Google
- [ ] Test 3: Link Google to email/password account
- [ ] Test 4: Unlink Google account
- [ ] Test 5: Error cases

### Phase 5: Production Deployment
- [ ] Update Railway environment variables
- [ ] Update Google Cloud Console for production URLs
- [ ] Update Clerk webhook for production URL
- [ ] Deploy and verify
- [ ] Monitor logs for errors

---

## 🎉 CONGRATULATIONS!

Once you've completed all phases, you'll have:
- ✅ Fully functional Google SSO authentication
- ✅ Clerk-powered user management
- ✅ Seamless account linking
- ✅ Production-ready security
- ✅ Excellent user experience

**Next Steps After Completion:**
1. Monitor user adoption metrics
2. Gather user feedback
3. Consider adding Facebook, GitHub OAuth
4. Implement advanced features (2FA, SSO for organizations)

---

**Need Help?**
- Clerk Documentation: https://clerk.com/docs
- Google OAuth Guide: https://developers.google.com/identity/protocols/oauth2
- MASH Backend Issues: Create an issue on GitHub

**Last Updated:** November 15, 2025
