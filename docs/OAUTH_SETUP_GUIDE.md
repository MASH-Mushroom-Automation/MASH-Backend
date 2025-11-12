# 🔐 OAuth Setup Guide - Google & Facebook Credentials

## 📋 Overview

This guide walks you through setting up **Google OAuth 2.0** and **Facebook Login** credentials for the MASH backend. Follow these steps to configure your development and production environments.

---

## 🔵 Google OAuth 2.0 Setup

### Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create New Project** (or select existing):
   - Click **"Select a project"** dropdown (top bar)
   - Click **"New Project"**
   - Enter project name: `MASH-Backend` (or your preferred name)
   - Click **"Create"**
   - Wait for project creation (takes ~30 seconds)

3. **Select Your Project**:
   - Click **"Select a project"** dropdown
   - Choose your newly created project

### Step 2: Enable Google+ API

1. **Navigate to APIs & Services**:
   - Left sidebar → **"APIs & Services"** → **"Library"**

2. **Search for Google+ API**:
   - Search bar: Type **"Google+ API"**
   - Click on **"Google+ API"** result
   - Click **"Enable"** button
   - Wait for activation (~10 seconds)

3. **Enable Google Identity Toolkit** (optional but recommended):
   - Search: **"Identity Toolkit API"**
   - Click **"Enable"**

### Step 3: Create OAuth 2.0 Credentials

1. **Navigate to Credentials**:
   - Left sidebar → **"APIs & Services"** → **"Credentials"**

2. **Configure OAuth Consent Screen** (first time only):
   - Click **"Configure Consent Screen"** button
   
   **User Type**:
   - Select **"External"** (for public access)
   - Click **"Create"**
   
   **OAuth Consent Screen Info**:
   - **App name**: `MASH - Mushroom Automation`
   - **User support email**: Your email address
   - **App logo**: Upload your app logo (optional)
   - **Application home page**: `https://mash.com` (or your domain)
   - **Authorized domains**: Add your domains:
     - `mash.com`
     - `api.mash.com`
     - `localhost` (for development)
   - **Developer contact information**: Your email
   - Click **"Save and Continue"**
   
   **Scopes**:
   - Click **"Add or Remove Scopes"**
   - Select these scopes:
     - ✅ `.../auth/userinfo.email`
     - ✅ `.../auth/userinfo.profile`
     - ✅ `openid`
   - Click **"Update"**
   - Click **"Save and Continue"**
   
   **Test Users** (for development):
   - Click **"Add Users"**
   - Add your test email addresses
   - Click **"Save and Continue"**
   
   **Summary**:
   - Review and click **"Back to Dashboard"**

3. **Create OAuth Client ID**:
   - Click **"+ Create Credentials"** button (top)
   - Select **"OAuth client ID"**
   
   **Application Type**:
   - Select **"Web application"**
   
   **Web Client Configuration**:
   - **Name**: `MASH Backend - Web Client`
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (development)
     - `http://localhost:3001` (frontend dev)
     - `https://api.mash.com` (production)
     - `https://mash.com` (production frontend)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/v1/auth/oauth/google/callback` (if using redirect flow)
     - `https://api.mash.com/api/v1/auth/oauth/google/callback` (production)
   - Click **"Create"**

4. **Save Your Credentials**:
   - A popup appears with your credentials:
     - **Client ID**: `123456789-abcdefghijklmnop.apps.googleusercontent.com`
     - **Client Secret**: `GOCSPX-xxxxxxxxxxxxxxxxxxxxx`
   - **IMPORTANT**: Copy both values immediately
   - Click **"Download JSON"** (optional, for backup)
   - Click **"OK"**

### Step 4: Create Credentials for Mobile Apps (iOS & Android)

#### iOS Client ID

1. **Create OAuth Client ID**:
   - Click **"+ Create Credentials"** → **"OAuth client ID"**
   - **Application type**: **"iOS"**
   - **Name**: `MASH iOS App`
   - **Bundle ID**: `com.mash.app` (your iOS bundle ID)
   - Click **"Create"**
   - **Save iOS Client ID**: `123456789-ios.apps.googleusercontent.com`

#### Android Client ID

1. **Get SHA-1 Fingerprint**:
   - Open terminal in your Android project root
   - Run:
     ```bash
     # Debug keystore (development)
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
     
     # Production keystore
     keytool -list -v -keystore /path/to/your/release.keystore -alias your-key-alias
     ```
   - Copy the **SHA-1** certificate fingerprint (looks like: `AA:BB:CC:DD:...`)

2. **Create OAuth Client ID**:
   - Click **"+ Create Credentials"** → **"OAuth client ID"**
   - **Application type**: **"Android"**
   - **Name**: `MASH Android App`
   - **Package name**: `com.mash.app` (your Android package name)
   - **SHA-1 certificate fingerprint**: Paste the SHA-1 you copied
   - Click **"Create"**
   - **Save Android Client ID**: `123456789-android.apps.googleusercontent.com`

### Step 5: Add to Environment Variables

Add to your `.env` file:

```env
# === GOOGLE OAUTH 2.0 ===
GOOGLE_CLIENT_ID="123456789-abcdefghijklmnop.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxxx"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/v1/auth/oauth/google/callback"  # Optional

# For frontend configuration (mobile apps)
GOOGLE_IOS_CLIENT_ID="123456789-ios.apps.googleusercontent.com"
GOOGLE_ANDROID_CLIENT_ID="123456789-android.apps.googleusercontent.com"
```

### Step 6: Testing Google OAuth

1. **Start your backend**:
   ```bash
   npm run start:dev
   ```

2. **Open Swagger UI**:
   - Go to: http://localhost:3000/api/docs
   - Find **POST /auth/google/login** endpoint

3. **Get a test Google ID token**:
   - Option 1: Use Google OAuth Playground
     - Visit: https://developers.google.com/oauthplayground/
     - Click **"OAuth 2.0 Configuration"** (gear icon)
     - Check **"Use your own OAuth credentials"**
     - Enter your Client ID and Secret
     - Select scopes: `email`, `profile`, `openid`
     - Click **"Authorize APIs"**
     - Click **"Exchange authorization code for tokens"**
     - Copy the **id_token** value
   
   - Option 2: Use mobile app (recommended)
     - Install Google Sign-In SDK in your app
     - Sign in with Google
     - Log the `idToken` value
     - Copy and use in Swagger

4. **Test the endpoint**:
   - In Swagger UI, click **POST /auth/google/login**
   - Click **"Try it out"**
   - Paste your ID token:
     ```json
     {
       "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
     }
     ```
   - Click **"Execute"**
   - Expected response: `200 OK` with JWT tokens

---

## 🔴 Facebook Login Setup

### Step 1: Create Facebook Developer Account

1. **Go to Facebook Developers**:
   - Visit: https://developers.facebook.com/
   - Click **"Get Started"** (top right)
   - Log in with your Facebook account
   - Accept Facebook Platform Terms

2. **Complete Account Setup**:
   - Verify your email address
   - Add a phone number (required for app creation)

### Step 2: Create Facebook App

1. **Create New App**:
   - Dashboard: https://developers.facebook.com/apps/
   - Click **"Create App"** button
   
2. **Select App Type**:
   - Choose **"Consumer"** (for user authentication)
   - Click **"Next"**

3. **App Details**:
   - **App Name**: `MASH - Mushroom Automation`
   - **App Contact Email**: Your email address
   - **Business Account**: Leave blank (or select if you have one)
   - Click **"Create App"**
   - Complete security check (CAPTCHA)

4. **App Dashboard**:
   - You'll be redirected to your new app dashboard
   - Note your **App ID** (top left): `1234567890123456`

### Step 3: Add Facebook Login Product

1. **Add Product**:
   - In left sidebar, click **"Add Product"**
   - Find **"Facebook Login"** card
   - Click **"Set Up"** button

2. **Select Platform**:
   - Choose your platform:
     - **"Web"** (for web portal)
     - **"Android"** (for Android app)
     - **"iOS"** (for iOS app)
   
   **Note**: You can add multiple platforms later

### Step 4: Configure Facebook Login Settings

1. **Navigate to Facebook Login Settings**:
   - Left sidebar → **"Facebook Login"** → **"Settings"**

2. **Configure Settings**:
   - **Client OAuth Login**: ✅ **Yes**
   - **Web OAuth Login**: ✅ **Yes**
   - **Enforce HTTPS**: ✅ **Yes** (production only)
   - **Embedded Browser OAuth Login**: ✅ **Yes**
   - **Login from Devices**: ✅ **No** (unless you need device flow)
   
3. **Valid OAuth Redirect URIs**:
   - Add these URIs (one per line):
     ```
     http://localhost:3000/api/v1/auth/oauth/facebook/callback
     http://localhost:3001/auth/callback
     https://api.mash.com/api/v1/auth/oauth/facebook/callback
     https://mash.com/auth/callback
     ```
   - Click **"Save Changes"** (bottom)

4. **Allowed Domains for the JavaScript SDK**:
   - Add your domains:
     ```
     localhost
     mash.com
     api.mash.com
     ```
   - Click **"Save Changes"**

### Step 5: Get App Secret

1. **Navigate to Basic Settings**:
   - Left sidebar → **"Settings"** → **"Basic"**

2. **Get Credentials**:
   - **App ID**: `1234567890123456` (visible)
   - **App Secret**: Click **"Show"** button
     - Enter your Facebook password to reveal
     - Copy the secret: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

3. **Configure App Domains**:
   - Scroll to **"App Domains"**
   - Add:
     ```
     localhost
     mash.com
     ```
   - Click **"Save Changes"**

### Step 6: Configure Platform Settings

#### For Web

1. **Add Platform**:
   - Scroll to **"Add Platform"** (bottom)
   - Click **"Website"**
   - **Site URL**: `http://localhost:3000` (development) or `https://mash.com` (production)
   - Click **"Save Changes"**

#### For Android

1. **Add Platform**:
   - Click **"Add Platform"** → **"Android"**
   - **Google Play Package Name**: `com.mash.app`
   - **Key Hashes**: Get from your Android keystore
     ```bash
     keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore | openssl sha1 -binary | openssl base64
     ```
   - Paste the hash (looks like: `Ab1Cd2Ef3Gh4==`)
   - Click **"Save Changes"**

#### For iOS

1. **Add Platform**:
   - Click **"Add Platform"** → **"iOS"**
   - **Bundle ID**: `com.mash.app`
   - **iPhone Store ID**: Your App Store ID (optional for development)
   - Click **"Save Changes"**

### Step 7: Switch to Live Mode (Production Only)

**Important**: Facebook apps start in **Development Mode** (limited to test users)

1. **Add Test Users** (Development Mode):
   - Left sidebar → **"Roles"** → **"Test Users"**
   - Click **"Add"** → **"Create Test Users"**
   - Create test accounts for your team

2. **Switch to Live Mode** (when ready for production):
   - Top bar → **"App Mode"** toggle
   - Switch from **"Development"** to **"Live"**
   - **Requirements**:
     - Privacy Policy URL configured
     - Terms of Service URL configured
     - App Review completed (if requesting advanced permissions)
   - Click **"Switch Mode"**

### Step 8: Add to Environment Variables

Add to your `.env` file:

```env
# === FACEBOOK LOGIN ===
FACEBOOK_APP_ID="1234567890123456"
FACEBOOK_APP_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
FACEBOOK_REDIRECT_URI="http://localhost:3000/api/v1/auth/oauth/facebook/callback"  # Optional
```

### Step 9: Testing Facebook Login

1. **Start your backend**:
   ```bash
   npm run start:dev
   ```

2. **Open Swagger UI**:
   - Go to: http://localhost:3000/api/docs
   - Find **POST /auth/facebook/login** endpoint

3. **Get a test Facebook access token**:
   - Option 1: Use Facebook Graph API Explorer
     - Visit: https://developers.facebook.com/tools/explorer/
     - Select your app from dropdown
     - Click **"Get User Access Token"**
     - Select permissions: `email`, `public_profile`
     - Click **"Generate Access Token"**
     - Copy the token
   
   - Option 2: Use mobile app (recommended)
     - Install Facebook SDK in your app
     - Sign in with Facebook
     - Log the `accessToken` value
     - Copy and use in Swagger

4. **Test the endpoint**:
   - In Swagger UI, click **POST /auth/facebook/login**
   - Click **"Try it out"**
   - Paste your access token:
     ```json
     {
       "accessToken": "EAABwzLixnjYBO6Df8BNCMl8Qs..."
     }
     ```
   - Click **"Execute"**
   - Expected response: `200 OK` with JWT tokens

---

## 🔧 Environment Variables Reference

### Complete `.env` Configuration

```env
# === CORE CONFIGURATION ===
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/mash?sslmode=require"
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"

# === GOOGLE OAUTH 2.0 ===
GOOGLE_CLIENT_ID="123456789-abcdefghijklmnop.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxxx"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/v1/auth/oauth/google/callback"

# Google Client IDs for Mobile (optional, for frontend config)
GOOGLE_IOS_CLIENT_ID="123456789-ios.apps.googleusercontent.com"
GOOGLE_ANDROID_CLIENT_ID="123456789-android.apps.googleusercontent.com"

# === FACEBOOK LOGIN ===
FACEBOOK_APP_ID="1234567890123456"
FACEBOOK_APP_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
FACEBOOK_REDIRECT_URI="http://localhost:3000/api/v1/auth/oauth/facebook/callback"

# === FRONTEND URLS (for CORS) ===
FRONTEND_URL="http://localhost:3001"
MOBILE_APP_SCHEME="mash://"
```

### Production Environment Variables

```env
# === PRODUCTION GOOGLE OAUTH ===
GOOGLE_CLIENT_ID="123456789-production.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-production-secret"
GOOGLE_REDIRECT_URI="https://api.mash.com/api/v1/auth/oauth/google/callback"

# === PRODUCTION FACEBOOK LOGIN ===
FACEBOOK_APP_ID="9876543210987654"
FACEBOOK_APP_SECRET="yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
FACEBOOK_REDIRECT_URI="https://api.mash.com/api/v1/auth/oauth/facebook/callback"

# === PRODUCTION FRONTEND ===
FRONTEND_URL="https://mash.com"
MOBILE_APP_SCHEME="mash://"
```

---

## ✅ Verification Checklist

### Google OAuth Setup

- [ ] Google Cloud project created
- [ ] Google+ API enabled
- [ ] OAuth consent screen configured
- [ ] Web client ID created and credentials saved
- [ ] iOS client ID created (if applicable)
- [ ] Android client ID created (if applicable)
- [ ] Authorized origins configured
- [ ] Redirect URIs configured
- [ ] Environment variables added to `.env`
- [ ] Backend started successfully
- [ ] Test login via Swagger UI successful

### Facebook Login Setup

- [ ] Facebook Developer account created
- [ ] Facebook App created
- [ ] Facebook Login product added
- [ ] OAuth settings configured
- [ ] Valid OAuth Redirect URIs added
- [ ] App Secret retrieved
- [ ] Platform(s) added (Web, iOS, Android)
- [ ] Environment variables added to `.env`
- [ ] Backend started successfully
- [ ] Test login via Swagger UI successful

### Backend Configuration

- [ ] `.env` file updated with all OAuth credentials
- [ ] Backend server starts without errors
- [ ] Swagger UI accessible at `/api/docs`
- [ ] `/auth/google/login` endpoint visible
- [ ] `/auth/facebook/login` endpoint visible
- [ ] Health check passes: `/api/v1/health`

---

## 🐛 Common Issues & Solutions

### Issue 1: "invalid_client" Error (Google)

**Error Message**:
```
Error: invalid_client
The OAuth client was not found.
```

**Solution**:
- Verify `GOOGLE_CLIENT_ID` in `.env` matches the one in Google Cloud Console
- Ensure you're using the **Web Client ID**, not iOS or Android client ID
- Check for typos or extra spaces in the client ID

### Issue 2: "redirect_uri_mismatch" Error (Google)

**Error Message**:
```
Error: redirect_uri_mismatch
The redirect URI in the request does not match the ones authorized for the OAuth client.
```

**Solution**:
- Go to Google Cloud Console → Credentials
- Edit your OAuth client ID
- Add the exact redirect URI to **"Authorized redirect URIs"**
- Make sure there's no trailing slash mismatch

### Issue 3: "Invalid OAuth access token" Error (Facebook)

**Error Message**:
```
{
  "error": {
    "message": "Invalid OAuth access token",
    "type": "OAuthException"
  }
}
```

**Solution**:
- Check if your Facebook app is in **"Development Mode"**
  - If yes, ensure the test user is added to your app (Roles → Test Users)
- Verify `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` are correct
- Generate a new access token from Graph API Explorer
- Check if the access token has expired (short-lived tokens expire in 1-2 hours)

### Issue 4: Facebook App in Development Mode

**Problem**: Only test users can log in

**Solution**:
1. Add test users: Dashboard → Roles → Test Users
2. Or switch to Live Mode:
   - Add Privacy Policy URL
   - Add Terms of Service URL
   - Top bar → Switch "Development" to "Live"

### Issue 5: "Origin not allowed" Error (Facebook)

**Error Message**:
```
Given URL is not allowed by the Application configuration
```

**Solution**:
- Go to Facebook App Settings → Basic
- Add your domain to **"App Domains"**
- Go to Facebook Login → Settings
- Add your URL to **"Valid OAuth Redirect URIs"**

---

## 📞 Support & Resources

### Google OAuth Resources

- **Google Cloud Console**: https://console.cloud.google.com/
- **OAuth 2.0 Playground**: https://developers.google.com/oauthplayground/
- **Documentation**: https://developers.google.com/identity/protocols/oauth2
- **Support**: https://support.google.com/cloud/

### Facebook Login Resources

- **Facebook App Dashboard**: https://developers.facebook.com/apps/
- **Graph API Explorer**: https://developers.facebook.com/tools/explorer/
- **Documentation**: https://developers.facebook.com/docs/facebook-login
- **Support**: https://developers.facebook.com/support/

### MASH Backend Resources

- **Swagger API Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health
- **GitHub Repository**: https://github.com/MASH-Mushroom-Automation/MASH-Backend
- **SSO Implementation Plan**: `docs/SSO_IMPLEMENTATION_PLAN.md`

---

## 🎉 Next Steps

Once your OAuth credentials are configured:

1. ✅ **Test the endpoints** via Swagger UI
2. ✅ **Integrate with mobile apps** (see `docs/FRONTEND_INTEGRATION_GUIDE.md`)
3. ✅ **Write unit tests** (Phase 9)
4. ✅ **Deploy to staging** environment
5. ✅ **Run production verification** tests

---

**Document Version**: 1.0  
**Last Updated**: November 12, 2025  
**Status**: ✅ Ready for Use
