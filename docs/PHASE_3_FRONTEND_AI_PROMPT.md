# 🤖 AI PROMPT: Complete Google SSO Frontend Implementation with Clerk

**Purpose:** Use this entire document as a prompt for an AI coding assistant in your frontend codebase to implement complete Google Single Sign-On authentication.

**Copy everything below this line and paste it into your frontend AI assistant (GitHub Copilot, Claude, etc.)**

---

# 🎯 TASK: Implement Complete Google SSO Authentication with Clerk

## 📋 CONTEXT

I need you to implement a complete Google Single Sign-On (SSO) authentication system using Clerk in my frontend application. The backend API is already fully implemented and ready to integrate.

## 🔧 BACKEND API DETAILS (Already Complete)

**Base URL:** `https://mash-backend-api-production.up.railway.app/api/v1`
**Alternative (Development):** `http://localhost:3000/api/v1`

### Available Authentication Endpoints:

```
POST   /auth/social/link/google
DELETE /auth/social/unlink/:provider
GET    /auth/social/status
POST   /auth/clerk-webhook
```

### Backend Configuration:
- Authentication: JWT tokens from Clerk
- CORS: Enabled for frontend origins
- Content-Type: application/json
- Authorization Header: Bearer {clerk_jwt_token}

## 🔑 CLERK CONFIGURATION

**Use these exact credentials:**

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YW11c2VkLWxhZHliaXJkLTI2LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_RygR2hOh8zf6ZD17eiFQ1gFJdQxVmYtfSAGfv05VcO

# Clerk URLs
CLERK_FRONTEND_API=https://amused-ladybird-26.clerk.accounts.dev
CLERK_BACKEND_API=https://api.clerk.com
CLERK_JWKS_URL=https://amused-ladybird-26.clerk.accounts.dev/.well-known/jwks.json

# Backend API
NEXT_PUBLIC_BACKEND_URL=https://mash-backend-api-production.up.railway.app/api/v1
```

## 🎯 REQUIREMENTS

### Phase 1: Project Setup (5-10 minutes)

**Step 1.1: Install Clerk SDK**

Detect my framework and install the appropriate package:

**For Next.js:**
```bash
npm install @clerk/nextjs
```

**For React (Vite/CRA):**
```bash
npm install @clerk/clerk-react react-router-dom
```

**For Vue.js:**
```bash
npm install @clerk/vue
```

**Step 1.2: Create Environment File**

Create `.env.local` (Next.js) or `.env` (Vite/CRA) with the credentials provided above.

**Step 1.3: Configure Clerk Provider**

**For Next.js App Router:**
Create or update `app/layout.tsx`:
```typescript
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={{
        baseTheme: undefined, // or your custom theme
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

**For Next.js Pages Router:**
Create or update `pages/_app.tsx`:
```typescript
import { ClerkProvider } from '@clerk/nextjs';
import type { AppProps } from 'next/app';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      <Component {...pageProps} />
    </ClerkProvider>
  );
}

export default MyApp;
```

**For React with Vite:**
Update `src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
);
```

---

### Phase 2: Authentication Pages (30-45 minutes)

**Step 2.1: Create Sign-In Page**

**For Next.js App Router:**
Create `app/sign-in/[[...sign-in]]/page.tsx`:
```typescript
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-center text-3xl font-bold text-gray-900">
          Sign in to MASH
        </h1>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-lg',
            },
          }}
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          redirectUrl="/dashboard"
          afterSignInUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

**For Next.js Pages Router:**
Create `pages/sign-in/[[...index]].tsx`:
```typescript
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        redirectUrl="/dashboard"
      />
    </div>
  );
}
```

**For React with Vite:**
Create `src/pages/SignIn.tsx`:
```typescript
import { SignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

export default function SignInPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        redirectUrl="/dashboard"
        afterSignInUrl="/dashboard"
      />
    </div>
  );
}
```

**Step 2.2: Create Sign-Up Page**

**For Next.js App Router:**
Create `app/sign-up/[[...sign-up]]/page.tsx`:
```typescript
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-center text-3xl font-bold text-gray-900">
          Create your account
        </h1>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-lg',
            },
          }}
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          redirectUrl="/dashboard"
          afterSignUpUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

**For Next.js Pages Router:**
Create `pages/sign-up/[[...index]].tsx`:
```typescript
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        redirectUrl="/dashboard"
      />
    </div>
  );
}
```

**For React with Vite:**
Create `src/pages/SignUp.tsx`:
```typescript
import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        redirectUrl="/dashboard"
        afterSignUpUrl="/dashboard"
      />
    </div>
  );
}
```

---

### Phase 3: Protected Routes Middleware (15-20 minutes)

**Step 3.1: Create Middleware for Route Protection**

**For Next.js (both App and Pages Router):**
Create `middleware.ts` in the root directory:
```typescript
import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  // Public routes that don't require authentication
  publicRoutes: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/webhooks(.*)',
  ],
  
  // Routes that should be accessible to authenticated users
  ignoredRoutes: [
    '/api/public(.*)',
  ],
  
  // Redirect unauthenticated users to sign-in
  afterAuth(auth, req, evt) {
    // If user is not signed in and trying to access a protected route
    if (!auth.userId && !auth.isPublicRoute) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return Response.redirect(signInUrl);
    }
  },
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

**For React with Vite:**
Create `src/components/ProtectedRoute.tsx`:
```typescript
import { useAuth } from '@clerk/clerk-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export default function ProtectedRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
```

Update `src/App.tsx` to use protected routes:
```typescript
import { Routes, Route } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import SignInPage from './pages/SignIn';
import SignUpPage from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import AccountSettings from './pages/AccountSettings';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      
      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<AccountSettings />} />
      </Route>
      
      {/* Redirect root to dashboard or sign-in */}
      <Route
        path="/"
        element={
          <>
            <SignedIn>
              <Navigate to="/dashboard" />
            </SignedIn>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
          </>
        }
      />
    </Routes>
  );
}

export default App;
```

---

### Phase 4: Dashboard with Backend Integration (45-60 minutes)

**Step 4.1: Create API Utility for Backend Calls**

Create `lib/api.ts` (Next.js) or `src/utils/api.ts` (Vite):
```typescript
import { useAuth } from '@clerk/nextjs'; // or '@clerk/clerk-react'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000/api/v1';

export interface BackendUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  googleId: string | null;
  clerkId: string | null;
  oauthProvider: string[];
  profilePicture: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthStatus {
  hasGoogle: boolean;
  hasEmailPassword: boolean;
  providers: string[];
  primaryEmail: string;
}

export class BackendAPI {
  constructor(private getToken: () => Promise<string | null>) {}

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async getUser(): Promise<BackendUser> {
    return this.request<BackendUser>('/auth/me');
  }

  async getOAuthStatus(): Promise<OAuthStatus> {
    return this.request<OAuthStatus>('/auth/social/status');
  }

  async linkGoogleAccount(idToken: string): Promise<any> {
    return this.request('/auth/social/link/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  }

  async unlinkSocialAccount(provider: string): Promise<any> {
    return this.request(`/auth/social/unlink/${provider}`, {
      method: 'DELETE',
    });
  }
}

// Hook for Next.js
export function useBackendAPI() {
  const { getToken } = useAuth();
  return new BackendAPI(getToken);
}
```

**Step 4.2: Create Dashboard Page**

**For Next.js App Router:**
Create `app/dashboard/page.tsx`:
```typescript
'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useBackendAPI, type BackendUser } from '@/lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const api = useBackendAPI();
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && user) {
      fetchBackendUser();
    }
  }, [isLoaded, user]);

  const fetchBackendUser = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getUser();
      setBackendUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user data');
      console.error('Error fetching backend user:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg bg-red-50 p-6 text-red-800">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error}</p>
          <button
            onClick={fetchBackendUser}
            className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const googleConnected = backendUser?.oauthProvider?.includes('google') || false;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <Link
            href="/settings"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Account Settings
          </Link>
        </div>

        {/* User Profile Card */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="flex items-start gap-4">
            {user?.imageUrl && (
              <img
                src={user.imageUrl}
                alt={user.fullName || 'User'}
                className="h-20 w-20 rounded-full"
              />
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">
                {user?.fullName || user?.username || 'User'}
              </h2>
              <p className="text-gray-600">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
              <div className="mt-2 flex gap-2">
                <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                  {backendUser?.role || 'USER'}
                </span>
                {googleConnected && (
                  <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                    ✓ Google Connected
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Backend User Data */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-xl font-bold text-gray-900">
            Account Information
          </h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">User ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {backendUser?.id}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Clerk ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {backendUser?.clerkId || 'Not synced'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Google ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {backendUser?.googleId || 'Not connected'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                OAuth Providers
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {backendUser?.oauthProvider?.join(', ') || 'None'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Account Created
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {backendUser?.createdAt
                  ? new Date(backendUser.createdAt).toLocaleDateString()
                  : 'Unknown'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Last Updated
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {backendUser?.updatedAt
                  ? new Date(backendUser.updatedAt).toLocaleDateString()
                  : 'Unknown'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Google Connection Status */}
        {!googleConnected && (
          <div className="mt-6 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Google Account Not Connected
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Link your Google account in Account Settings for easier sign-in.
                </p>
                <Link
                  href="/settings"
                  className="mt-2 inline-block text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
                >
                  Go to Settings →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**For React with Vite:**
Create `src/pages/Dashboard.tsx` with similar structure (replace `'use client'` and Next.js imports with React Router imports).

---

### Phase 5: Account Settings with Link/Unlink (60 minutes)

**Step 5.1: Create Account Settings Page**

**For Next.js App Router:**
Create `app/settings/page.tsx`:
```typescript
'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useBackendAPI, type OAuthStatus } from '@/lib/api';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const api = useBackendAPI();
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && user) {
      fetchOAuthStatus();
    }
  }, [isLoaded, user]);

  const fetchOAuthStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getOAuthStatus();
      setOAuthStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OAuth status');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkGoogle = async () => {
    if (!user) return;

    try {
      setActionLoading(true);
      setError(null);
      setSuccessMessage(null);

      // Get Google ID token from Clerk
      const googleAccount = user.externalAccounts?.find(
        (account) => account.provider === 'google'
      );

      if (!googleAccount) {
        throw new Error('No Google account found in Clerk. Please sign in with Google first.');
      }

      // Get the verification token
      const token = await googleAccount.verification?.externalVerificationRedirectURL;
      
      if (!token) {
        throw new Error('Unable to get Google verification token');
      }

      // Call backend to link account
      await api.linkGoogleAccount(token.toString());
      
      setSuccessMessage('Google account linked successfully!');
      await fetchOAuthStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link Google account');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!confirm('Are you sure you want to unlink your Google account?')) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      setSuccessMessage(null);

      await api.unlinkSocialAccount('google');
      
      setSuccessMessage('Google account unlinked successfully!');
      await fetchOAuthStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink Google account');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const googleConnected = oauthStatus?.hasGoogle || false;
  const hasEmailPassword = oauthStatus?.hasEmailPassword || false;
  const canUnlinkGoogle = googleConnected && hasEmailPassword;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4">
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Profile Section */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Profile</h2>
          <div className="flex items-center gap-4">
            {user?.imageUrl && (
              <img
                src={user.imageUrl}
                alt={user.fullName || 'User'}
                className="h-16 w-16 rounded-full"
              />
            )}
            <div>
              <p className="font-medium text-gray-900">
                {user?.fullName || user?.username}
              </p>
              <p className="text-sm text-gray-600">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
        </div>

        {/* OAuth Connections */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Connected Accounts
          </h2>

          {/* Google Account */}
          <div className="border-b border-gray-200 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
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
                </div>
                <div>
                  <p className="font-medium text-gray-900">Google</p>
                  <p className="text-sm text-gray-600">
                    {googleConnected ? (
                      <span className="text-green-600">✓ Connected</span>
                    ) : (
                      'Not connected'
                    )}
                  </p>
                </div>
              </div>

              <div>
                {googleConnected ? (
                  <button
                    onClick={handleUnlinkGoogle}
                    disabled={!canUnlinkGoogle || actionLoading}
                    className={`rounded-lg px-4 py-2 font-medium ${
                      canUnlinkGoogle && !actionLoading
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title={
                      !hasEmailPassword
                        ? 'Cannot unlink - set up email/password first'
                        : ''
                    }
                  >
                    {actionLoading ? 'Processing...' : 'Unlink'}
                  </button>
                ) : (
                  <button
                    onClick={handleLinkGoogle}
                    disabled={actionLoading}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {actionLoading ? 'Linking...' : 'Link Account'}
                  </button>
                )}
              </div>
            </div>

            {googleConnected && !hasEmailPassword && (
              <div className="mt-3 rounded bg-yellow-50 p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ Set up email/password authentication before unlinking Google
                  to avoid losing access to your account.
                </p>
              </div>
            )}
          </div>

          {/* Email/Password Status */}
          <div className="mt-4 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <svg
                    className="h-5 w-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Email & Password</p>
                  <p className="text-sm text-gray-600">
                    {hasEmailPassword ? (
                      <span className="text-green-600">✓ Configured</span>
                    ) : (
                      'Not configured'
                    )}
                  </p>
                </div>
              </div>

              {!hasEmailPassword && (
                <button
                  onClick={() => {
                    alert('Navigate to Clerk User Button to set up password');
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                >
                  Set Up Password
                </button>
              )}
            </div>
          </div>
        </div>

        {/* OAuth Provider List */}
        {oauthStatus && oauthStatus.providers.length > 0 && (
          <div className="mt-6 rounded-lg bg-gray-50 p-4">
            <h3 className="mb-2 font-medium text-gray-900">Active Providers</h3>
            <div className="flex flex-wrap gap-2">
              {oauthStatus.providers.map((provider) => (
                <span
                  key={provider}
                  className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
                >
                  {provider}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Phase 6: Testing & Verification (30 minutes)

**Step 6.1: Test Complete Authentication Flow**

Create a test checklist and verify each scenario:

**Test 1: New User Sign-Up with Google**
```
1. Clear browser cookies/local storage
2. Navigate to /sign-up
3. Click "Continue with Google" button
4. Complete Google OAuth flow
5. Verify redirect to /dashboard
6. Check that user info displays correctly
7. Verify Google connection shows as "Connected" in settings
8. Check backend logs for webhook events
```

**Test 2: Existing User Sign-In with Google**
```
1. Sign out from application
2. Navigate to /sign-in
3. Click "Continue with Google"
4. Sign in with same Google account
5. Verify redirect to /dashboard
6. Confirm user data persists
```

**Test 3: Link Google Account to Email/Password Account**
```
1. Create account with email/password
2. Sign in
3. Navigate to /settings
4. Click "Link Account" for Google
5. Complete Google OAuth
6. Verify both auth methods work
7. Test signing in with Google
8. Test signing in with email/password
```

**Test 4: Unlink Google Account**
```
1. Go to /settings
2. Verify email/password is set up first
3. Click "Unlink" for Google
4. Confirm the action
5. Verify Google shows as "Not connected"
6. Test that email/password still works
```

**Test 5: Protected Routes**
```
1. Sign out
2. Try to access /dashboard directly
3. Verify redirect to /sign-in
4. Sign in
5. Verify redirect back to /dashboard
```

**Step 6.2: Verify Backend Integration**

Check that these backend calls are working:

```typescript
// Test in browser console on dashboard page
const response = await fetch('https://mash-backend-api-production.up.railway.app/api/v1/auth/me', {
  headers: {
    'Authorization': `Bearer ${await window.Clerk.session.getToken()}`
  }
});
console.log(await response.json());
```

---

### Phase 7: Styling & Polish (30 minutes - OPTIONAL)

**Step 7.1: Customize Clerk Components**

Add custom styling to match your brand:

```typescript
<ClerkProvider
  appearance={{
    baseTheme: undefined,
    variables: {
      colorPrimary: '#3b82f6', // blue-600
      colorText: '#111827', // gray-900
      colorBackground: '#ffffff',
      colorInputBackground: '#f9fafb', // gray-50
      colorInputText: '#111827',
      borderRadius: '0.5rem',
    },
    elements: {
      formButtonPrimary: 
        'bg-blue-600 hover:bg-blue-700 text-white font-medium',
      card: 'shadow-lg',
      headerTitle: 'text-2xl font-bold',
      headerSubtitle: 'text-gray-600',
      socialButtonsBlockButton: 
        'border border-gray-300 hover:border-gray-400',
      formFieldLabel: 'text-sm font-medium text-gray-700',
      formFieldInput: 
        'rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500',
      footerActionLink: 'text-blue-600 hover:text-blue-700',
    },
  }}
>
```

**Step 7.2: Add Loading States**

Improve UX with loading indicators:

```typescript
{loading ? (
  <div className="flex items-center justify-center py-12">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
  </div>
) : (
  // Your content
)}
```

---

## ✅ COMPLETION CHECKLIST

Mark each item as complete:

### Setup & Configuration
- [ ] Clerk SDK installed
- [ ] Environment variables configured
- [ ] ClerkProvider wrapping app
- [ ] Middleware/ProtectedRoute implemented

### Authentication Pages
- [ ] Sign-in page created with Google button
- [ ] Sign-up page created with Google button
- [ ] Pages styled and responsive
- [ ] Redirects working correctly

### Dashboard
- [ ] Dashboard page created
- [ ] User info from Clerk displays
- [ ] Backend user data fetches correctly
- [ ] OAuth status shows accurately
- [ ] Error handling implemented

### Account Settings
- [ ] Settings page created
- [ ] Link Google account button works
- [ ] Unlink Google account button works
- [ ] Proper warning for unlinking without email/password
- [ ] Success/error messages display

### Testing
- [ ] New user sign-up with Google works
- [ ] Existing user sign-in with Google works
- [ ] Link Google to email/password account works
- [ ] Unlink Google account works
- [ ] Protected routes redirect correctly
- [ ] Backend API integration verified
- [ ] Webhook events received in backend

### Polish (Optional)
- [ ] Custom Clerk theming applied
- [ ] Loading states added
- [ ] Mobile responsive
- [ ] Accessibility checked

---

## 🐛 TROUBLESHOOTING

### "Clerk not initialized" Error
**Solution:** Check `.env.local` or `.env` file has correct publishable key.

```bash
# Verify environment variable
echo $NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
```

### "401 Unauthorized" from Backend
**Solution:** Verify JWT token is being sent correctly.

```typescript
// Debug token
const { getToken } = useAuth();
const token = await getToken();
console.log('Token:', token);
```

### "Google OAuth button not showing"
**Solution:** Verify Google is enabled in Clerk dashboard:
1. Go to dashboard.clerk.com
2. User & Authentication → Social Connections
3. Toggle Google to ON

### "Failed to link Google account"
**Solution:** Check that user has Google account connected in Clerk first:

```typescript
const googleAccount = user.externalAccounts?.find(
  (account) => account.provider === 'google'
);
console.log('Google account:', googleAccount);
```

### "Redirect loop" or middleware issues
**Solution:** Check middleware configuration:

```typescript
// Ensure public routes are configured
publicRoutes: [
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
],
```

### Backend CORS errors
**Solution:** Backend already has CORS enabled. If issues persist, verify your frontend URL matches:

```
Allowed origins:
- http://localhost:3000
- http://localhost:5173
- https://your-production-domain.com
```

---

## 📊 EXPECTED RESULTS

After completing this implementation, you should have:

1. ✅ **Complete Google SSO Authentication**
   - Users can sign up with Google
   - Users can sign in with Google
   - Email/password auth still works

2. ✅ **Account Management**
   - Users can link Google to existing accounts
   - Users can unlink Google (with safeguards)
   - OAuth status visible in settings

3. ✅ **Protected Routes**
   - Middleware redirects unauthenticated users
   - Authenticated users access dashboard
   - Session persists across page refreshes

4. ✅ **Backend Integration**
   - Frontend communicates with MASH backend
   - User data synced between Clerk and backend
   - Webhooks update backend automatically

5. ✅ **Production Ready**
   - Error handling implemented
   - Loading states for better UX
   - Responsive design
   - Security best practices followed

---

## 🚀 DEPLOYMENT

### Next.js Deployment (Vercel)

1. Push code to GitHub
2. Import to Vercel
3. Add environment variables:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YW11c2VkLWxhZHliaXJkLTI2LmNsZXJrLmFjY291bnRzLmRldiQ
NEXT_PUBLIC_BACKEND_URL=https://mash-backend-api-production.up.railway.app/api/v1
```
4. Deploy

### React/Vite Deployment (Netlify)

1. Build the project: `npm run build`
2. Deploy `dist` folder to Netlify
3. Add environment variables in Netlify dashboard:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YW11c2VkLWxhZHliaXJkLTI2LmNsZXJrLmFjY291bnRzLmRldiQ
VITE_BACKEND_URL=https://mash-backend-api-production.up.railway.app/api/v1
```

### Update Clerk Dashboard

After deployment:
1. Go to dashboard.clerk.com
2. Settings → Domains
3. Add your production domain
4. Update allowed redirect URLs

---

## 📞 SUPPORT

If you encounter issues:

1. **Check Backend Status:**
   - Visit: https://mash-backend-api-production.up.railway.app/api/v1/health
   - Should return: `{"status": "ok"}`

2. **Check Clerk Status:**
   - Visit: https://status.clerk.com
   - Verify no outages

3. **Review Backend Logs:**
   - Check Railway dashboard for backend logs
   - Look for webhook events and authentication attempts

4. **Review Documentation:**
   - Clerk Docs: https://clerk.com/docs
   - Backend API Docs: Available in MASH-Backend repository

---

## ✨ YOU'RE DONE!

Congratulations! You now have a complete Google SSO authentication system with:
- ✅ Clerk integration
- ✅ Google OAuth
- ✅ Backend synchronization
- ✅ Account management
- ✅ Protected routes
- ✅ Production-ready code

**Total Implementation Time:** 3-4 hours  
**Lines of Code:** ~800-1000  
**Files Created:** 6-8 files  
**Features Delivered:** Complete enterprise-grade authentication

---

**END OF AI PROMPT**
