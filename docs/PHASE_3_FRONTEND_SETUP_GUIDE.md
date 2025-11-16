# 🚀 Phase 3: Frontend Integration - Complete Implementation Guide

**Date Started:** November 15, 2025  
**Status:** 🚧 IN PROGRESS  
**Estimated Time:** 3-4 hours  
**Current Progress:** 0%

---

## ✅ Prerequisites (Already Complete!)

Before starting Phase 3, verify you've completed:

- ✅ Phase 1: Backend Implementation (100% complete)
- ✅ Phase 2: Environment Setup (100% complete)
- ✅ Clerk credentials configured
- ✅ Backend server running with Clerk initialized
- ✅ Webhook endpoint configured

**Your Clerk Configuration:**
```
Publishable Key: pk_test_YW11c2VkLWxhZHliaXJkLTI2LmNsZXJrLmFjY291bnRzLmRldiQ
Secret Key: sk_test_RygR2hOh8zf6ZD17eiFQ1gFJdQxVmYtfSAGfv05VcO
Webhook Secret: whsec_JtOiAs0zFyPNFKPKL9QCyJJjK1H/timm
Frontend API: https://amused-ladybird-26.clerk.accounts.dev
Backend API: https://api.clerk.com
```

---

## 🎯 Phase 3 Overview

In this phase, you'll build a complete frontend with:

1. **Authentication Pages**
   - Sign-in page with Google OAuth button
   - Sign-up page with Google OAuth button
   - Automatic email/password + Google SSO

2. **Protected Routes**
   - Middleware to protect authenticated pages
   - Automatic redirects for unauthenticated users

3. **User Dashboard**
   - Display user information from Clerk
   - Fetch and display backend user data
   - User profile picture and details

4. **Account Settings**
   - Link Google account to existing user
   - Unlink Google account
   - View connected OAuth providers
   - Manage authentication methods

---

## 📋 Implementation Checklist

### Step 3.1: Choose Your Frontend Framework ⏱️ (5 minutes)

**Do you have an existing frontend?**

- [ ] **Option A:** I have a Next.js frontend → Go to Step 3.2 (Next.js)
- [ ] **Option B:** I have a React (Vite/CRA) frontend → Go to Step 3.2 (React)
- [ ] **Option C:** I need to create a new frontend → See Section "Create New Frontend"

**If you need to create a new frontend:**

**For Next.js (Recommended for full-stack apps):**
```bash
# In a separate folder (NOT inside MASH-Backend)
cd ..
npx create-next-app@latest mash-frontend

# Follow prompts:
# ✓ Would you like to use TypeScript? Yes
# ✓ Would you like to use ESLint? Yes
# ✓ Would you like to use Tailwind CSS? Yes
# ✓ Would you like to use `src/` directory? No
# ✓ Would you like to use App Router? Yes
# ✓ Would you like to customize the default import alias? No

cd mash-frontend
```

**For React with Vite:**
```bash
cd ..
npm create vite@latest mash-frontend -- --template react-ts
cd mash-frontend
npm install
```

---

### Step 3.2: Install Clerk SDK ⏱️ (2 minutes)

**For Next.js:**
```bash
npm install @clerk/nextjs
```

**For React (Vite/CRA):**
```bash
npm install @clerk/clerk-react
```

**Verify installation:**
```bash
npm list @clerk/nextjs
# OR
npm list @clerk/clerk-react
```

✅ **Checkpoint:** Clerk SDK installed successfully

---

### Step 3.3: Configure Environment Variables ⏱️ (2 minutes)

Create `.env.local` in your frontend root directory:

**For Next.js:**
```env
# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YW11c2VkLWxhZHliaXJkLTI2LmNsZXJrLmFjY291bnRzLmRldiQ
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000/api/v1
```

**For React (Vite):**
```env
# .env.local
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YW11c2VkLWxhZHliaXJkLTI2LmNsZXJrLmFjY291bnRzLmRldiQ
VITE_BACKEND_URL=http://localhost:3000/api/v1
```

**Important:** Add `.env.local` to `.gitignore`:
```bash
echo .env.local >> .gitignore
```

✅ **Checkpoint:** Environment variables configured

---

### Step 3.4: Wrap App with ClerkProvider ⏱️ (5 minutes)

**For Next.js (App Router):**

**File: `app/layout.tsx`**
```typescript
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata = {
  title: 'MASH - Mushroom Automation',
  description: 'Smart farming platform with IoT integration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

**For Next.js (Pages Router):**

**File: `pages/_app.tsx`**
```typescript
import { ClerkProvider } from '@clerk/nextjs';
import type { AppProps } from 'next/app';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider {...pageProps}>
      <Component {...pageProps} />
    </ClerkProvider>
  );
}

export default MyApp;
```

**For React (Vite):**

**File: `src/main.tsx`**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
```

✅ **Checkpoint:** App wrapped with ClerkProvider

---

### Step 3.5: Create Sign-In Page ⏱️ (30 minutes)

**For Next.js (App Router):**

**File: `app/sign-in/[[...sign-in]]/page.tsx`**
```typescript
'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to MASH</h1>
          <p className="text-gray-600 mt-2">Sign in to your account</p>
        </div>
        
        <SignIn
          routing="path"
          path="/sign-in"
          redirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-xl',
            },
          }}
        />
      </div>
    </div>
  );
}
```

**For Next.js (Pages Router):**

**File: `pages/sign-in/[[...index]].tsx`**
```typescript
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to MASH</h1>
          <p className="text-gray-600 mt-2">Sign in to your account</p>
        </div>
        
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          redirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

**For React (Vite):**

**File: `src/pages/SignIn.tsx`**
```typescript
import { SignIn } from '@clerk/clerk-react';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to MASH</h1>
          <p className="text-gray-600 mt-2">Sign in to your account</p>
        </div>
        
        <SignIn
          routing="path"
          path="/sign-in"
          redirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

**Test the page:**
```bash
npm run dev
# Open: http://localhost:3000/sign-in (Next.js)
# Open: http://localhost:5173/sign-in (Vite)
```

✅ **Checkpoint:** Sign-in page displays with Google OAuth button

---

### Step 3.6: Create Sign-Up Page ⏱️ (30 minutes)

**For Next.js (App Router):**

**File: `app/sign-up/[[...sign-up]]/page.tsx`**
```typescript
'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Join MASH</h1>
          <p className="text-gray-600 mt-2">Create your account to get started</p>
        </div>
        
        <SignUp
          routing="path"
          path="/sign-up"
          redirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-xl',
            },
          }}
        />
      </div>
    </div>
  );
}
```

**For Next.js (Pages Router):**

**File: `pages/sign-up/[[...index]].tsx`**
```typescript
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Join MASH</h1>
          <p className="text-gray-600 mt-2">Create your account to get started</p>
        </div>
        
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          redirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

**For React (Vite):**

**File: `src/pages/SignUp.tsx`**
```typescript
import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Join MASH</h1>
          <p className="text-gray-600 mt-2">Create your account to get started</p>
        </div>
        
        <SignUp
          routing="path"
          path="/sign-up"
          redirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
```

**Test the page:**
```bash
# Open: http://localhost:3000/sign-up (Next.js)
# Open: http://localhost:5173/sign-up (Vite)
```

✅ **Checkpoint:** Sign-up page displays with Google OAuth button

---

### Step 3.7: Add Protected Route Middleware ⏱️ (20 minutes)

**For Next.js:**

**File: `middleware.ts` (in root directory)**
```typescript
import { authMiddleware } from '@clerk/nextjs';

// This example protects all routes including api/trpc routes
// Please edit this to allow other routes to be public as needed.
// See https://clerk.com/docs/references/nextjs/auth-middleware for more information about configuring your Middleware
export default authMiddleware({
  // Routes that can be accessed while signed out
  publicRoutes: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/v1/health',
    '/api/v1/auth/webhook',
  ],
  // Routes that can always be accessed, and have
  // no authentication information
  ignoredRoutes: ['/api/v1/health'],
});

export const config = {
  // Protects all routes, including api/trpc.
  // See https://clerk.com/docs/references/nextjs/auth-middleware
  // for more information about configuring your Middleware
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

**For React (Vite) - Using React Router:**

**File: `src/components/ProtectedRoute.tsx`**
```typescript
import { useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}
```

**Update `src/App.tsx`:**
```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import SignInPage from './pages/SignIn';
import SignUpPage from './pages/SignUp';
import DashboardPage from './pages/Dashboard';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

**Install React Router (if not already installed):**
```bash
npm install react-router-dom
```

✅ **Checkpoint:** Protected routes redirect unauthenticated users to sign-in

---

### Step 3.8: Create Dashboard Page ⏱️ (1 hour)

**For Next.js (App Router):**

**File: `app/dashboard/page.tsx`**
```typescript
'use client';

import { UserButton, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

interface BackendUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  oauthProvider: string[];
  googleId: string | null;
  clerkId: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && isLoaded) {
      fetchBackendUser();
    }
  }, [user, isLoaded]);

  const fetchBackendUser = async () => {
    try {
      setLoading(true);
      const token = await user?.getToken();
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const data = await response.json();
      setBackendUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching backend user:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="font-medium">Error loading user data</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Clerk User Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">
              Clerk User Information
            </h2>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <img
                  src={user?.imageUrl}
                  alt="Profile"
                  className="w-16 h-16 rounded-full"
                />
                <div>
                  <p className="font-medium text-gray-900">{user?.fullName}</p>
                  <p className="text-sm text-gray-600">
                    {user?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email Verified</dt>
                    <dd className="text-sm text-gray-900">
                      {user?.primaryEmailAddress?.verification?.status === 'verified' 
                        ? '✅ Verified' 
                        : '❌ Not Verified'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Clerk ID</dt>
                    <dd className="text-sm text-gray-900 font-mono">{user?.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Created At</dt>
                    <dd className="text-sm text-gray-900">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Backend User Info */}
          {backendUser && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                Backend User Data
              </h2>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Role</dt>
                  <dd className="text-sm text-gray-900">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {backendUser.role}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">OAuth Providers</dt>
                  <dd className="text-sm text-gray-900">
                    {backendUser.oauthProvider?.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {backendUser.oauthProvider.map((provider) => (
                          <span
                            key={provider}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                          >
                            {provider}
                          </span>
                        ))}
                      </div>
                    ) : (
                      'None'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Google Account</dt>
                  <dd className="text-sm text-gray-900">
                    {backendUser.googleId ? (
                      <span className="text-green-600">✅ Linked</span>
                    ) : (
                      <span className="text-gray-500">Not linked</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Database ID</dt>
                  <dd className="text-sm text-gray-900 font-mono">{backendUser.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Registered</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(backendUser.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <a
              href="/settings"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Account Settings
            </a>
            <button
              onClick={fetchBackendUser}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
```

**For React (Vite):**

**File: `src/pages/Dashboard.tsx`** - Use the same code as above, but change:
- `process.env.NEXT_PUBLIC_BACKEND_URL` → `import.meta.env.VITE_BACKEND_URL`
- Remove `'use client';` directive

✅ **Checkpoint:** Dashboard displays user information from Clerk and backend

---

### Step 3.9: Create Account Settings Page ⏱️ (1 hour)

**For Next.js (App Router):**

**File: `app/settings/page.tsx`**
```typescript
'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface OAuthStatus {
  googleLinked: boolean;
  facebookLinked: boolean;
  providers: string[];
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user && isLoaded) {
      fetchOAuthStatus();
    }
  }, [user, isLoaded]);

  const fetchOAuthStatus = async () => {
    try {
      const token = await user?.getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/social/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch OAuth status');
      }

      const data = await response.json();
      setOauthStatus(data);
    } catch (err) {
      console.error('Error fetching OAuth status:', err);
    }
  };

  const handleLinkGoogle = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Get Google token from Clerk
      const token = await user?.getToken({ template: 'google_oauth' });
      
      if (!token) {
        throw new Error('Failed to get Google token');
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/social/link/google`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await user?.getToken()}`,
          },
          body: JSON.stringify({ idToken: token }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to link Google account');
      }

      setSuccess('Google account linked successfully!');
      await fetchOAuthStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link Google account');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!confirm('Are you sure you want to unlink your Google account?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/social/unlink/google`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${await user?.getToken()}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to unlink Google account');
      }

      setSuccess('Google account unlinked successfully!');
      await fetchOAuthStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink Google account');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* Connected Accounts */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            Connected Accounts
          </h2>
          
          <div className="space-y-4">
            {/* Google Account */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Google</p>
                  <p className="text-sm text-gray-600">
                    {oauthStatus?.googleLinked 
                      ? '✅ Connected' 
                      : 'Not connected'}
                  </p>
                </div>
              </div>
              
              {oauthStatus?.googleLinked ? (
                <button
                  onClick={handleUnlinkGoogle}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50"
                >
                  {loading ? 'Unlinking...' : 'Unlink'}
                </button>
              ) : (
                <button
                  onClick={handleLinkGoogle}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Linking...' : 'Link Account'}
                </button>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    About OAuth Providers
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      Linking your Google account allows you to:
                    </p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Sign in with Google in one click</li>
                      <li>Automatically sync your profile information</li>
                      <li>Use Google as a backup login method</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            Profile Information
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="text-sm text-gray-900">{user?.fullName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="text-sm text-gray-900">
                {user?.primaryEmailAddress?.emailAddress}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Username</dt>
              <dd className="text-sm text-gray-900">{user?.username || 'Not set'}</dd>
            </div>
          </dl>
        </div>
      </main>
    </div>
  );
}
```

**For React (Vite):**

**File: `src/pages/Settings.tsx`** - Use the same code, but:
- Change `useRouter` from `next/navigation` → `react-router-dom` (use `useNavigate`)
- Change `process.env.NEXT_PUBLIC_BACKEND_URL` → `import.meta.env.VITE_BACKEND_URL`
- Remove `'use client';` directive

✅ **Checkpoint:** Account settings page allows linking/unlinking Google account

---

### Step 3.10: Test the Complete Flow ⏱️ (30 minutes)

**Test 1: Sign Up with Google**
1. Open http://localhost:3000/sign-up
2. Click "Continue with Google"
3. Select your Google account
4. **Expected:** Redirected to `/dashboard`, user info displayed

**Test 2: Sign In with Google**
1. Sign out
2. Go to http://localhost:3000/sign-in
3. Click "Continue with Google"
4. **Expected:** Signed in, redirected to `/dashboard`

**Test 3: Link Google Account**
1. Create an email/password account
2. Sign in
3. Go to http://localhost:3000/settings
4. Click "Link Account" for Google
5. **Expected:** Google account linked successfully

**Test 4: Protected Routes**
1. Sign out
2. Try to access http://localhost:3000/dashboard
3. **Expected:** Redirected to `/sign-in`

**Test 5: Backend Integration**
1. Open browser DevTools (F12)
2. Go to Dashboard
3. Check Network tab for API calls to backend
4. **Expected:** Successful fetch from `http://localhost:3000/api/v1/auth/me`

✅ **Checkpoint:** All tests passing

---

## 🎉 Phase 3 Complete!

Congratulations! You've successfully implemented the frontend for Google SSO authentication!

### What You've Built:
- ✅ Sign-in page with Google OAuth
- ✅ Sign-up page with Google OAuth
- ✅ Protected route middleware
- ✅ User dashboard with Clerk + backend data
- ✅ Account settings for linking/unlinking Google

---

## 🧪 Next: Phase 4 - Testing

Now proceed to comprehensive testing:

📄 **Open:** [GOOGLE_SSO_STEP_BY_STEP_GUIDE.md](./GOOGLE_SSO_STEP_BY_STEP_GUIDE.md) - Phase 4

---

## 🆘 Troubleshooting

### Issue: "Clerk not initialized"
**Solution:** Check `.env.local` has correct Publishable Key

### Issue: "401 Unauthorized" from backend
**Solution:** Verify JWT token is being sent correctly:
```typescript
const token = await user?.getToken();
console.log('Token:', token); // Debug
```

### Issue: Google OAuth button not showing
**Solution:** 
1. Verify Google OAuth is enabled in Clerk dashboard
2. Check browser console for errors
3. Clear browser cache and cookies

### Issue: "Failed to link Google account"
**Solution:**
1. Check backend logs for errors
2. Verify webhook is receiving events
3. Test backend endpoint directly with Postman

### Issue: Redirect loop after sign-in
**Solution:**
1. Check middleware.ts publicRoutes configuration
2. Verify redirectUrl in SignIn/SignUp components
3. Clear cookies and try again

---

## 📊 Progress Tracker

**Phase 3 Implementation Progress:**

- [ ] Step 3.1: Choose frontend framework
- [ ] Step 3.2: Install Clerk SDK
- [ ] Step 3.3: Configure environment variables
- [ ] Step 3.4: Wrap app with ClerkProvider
- [ ] Step 3.5: Create Sign-In page
- [ ] Step 3.6: Create Sign-Up page
- [ ] Step 3.7: Add protected route middleware
- [ ] Step 3.8: Create Dashboard page
- [ ] Step 3.9: Create Account Settings page
- [ ] Step 3.10: Test complete flow

**Overall Progress:** 66% (Phase 1 ✅, Phase 2 ✅, Phase 3 🚧, Phase 4 ⏳)

---

**Last Updated:** November 15, 2025  
**Current Status:** Phase 3 - Ready to implement!
