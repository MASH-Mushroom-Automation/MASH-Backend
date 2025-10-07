# 📬 Postman Collection Guide - User Profile Management API

## Overview

This Postman collection provides **comprehensive testing for all 17 Phase 3 endpoints** - User Management APIs with authentication, avatar upload, session management, API keys, security logs, and 2FA/TOTP.

**Collection File:** `13-User-Profile-Management-API.postman_collection.json`

---

## 🚀 Quick Start

### 1. Import Collection

1. Open Postman
2. Click **Import** button
3. Select `13-User-Profile-Management-API.postman_collection.json`
4. Collection will appear in left sidebar

### 2. Configure Environment

Set these collection variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `baseUrl` | `http://localhost:3000` | Your backend URL |
| `clerkToken` | `<your_clerk_jwt>` | Clerk authentication token |

**How to set variables:**
1. Right-click collection → **Edit**
2. Go to **Variables** tab
3. Set `clerkToken` value
4. Click **Save**

### 3. Get Clerk Token

**Option A: From Clerk Dashboard**
1. Visit [Clerk Dashboard](https://dashboard.clerk.com)
2. Go to your application
3. Navigate to **Sessions** → **Active Sessions**
4. Copy JWT token

**Option B: From Browser DevTools**
1. Login to your frontend application
2. Open DevTools (F12)
3. Go to **Application** → **Cookies**
4. Copy `__session` cookie value

**Option C: From Login Endpoint**
```bash
POST {{baseUrl}}/api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password"
}
```

---

## 📂 Collection Structure

### 1. Profile Management (4 endpoints)
- ✅ **GET** `/api/v1/profile` - Get current user profile
- ✅ **PATCH** `/api/v1/profile` - Update profile
- ✅ **GET** `/api/v1/profile/preferences` - Get preferences
- ✅ **PATCH** `/api/v1/profile/preferences` - Update preferences

### 2. Avatar Management (2 endpoints)
- ✅ **POST** `/api/v1/profile/avatar` - Upload avatar (multipart/form-data)
- ✅ **DELETE** `/api/v1/profile/avatar` - Delete avatar

### 3. Session Management (3 endpoints)
- ✅ **GET** `/api/v1/profile/sessions` - List all sessions
- ✅ **DELETE** `/api/v1/profile/sessions/:id` - Revoke specific session
- ✅ **DELETE** `/api/v1/profile/sessions` - Logout from all devices

### 4. API Key Management (3 endpoints)
- ✅ **GET** `/api/v1/profile/api-keys` - List API keys (masked)
- ✅ **POST** `/api/v1/profile/api-keys` - Generate new API key
- ✅ **DELETE** `/api/v1/profile/api-keys/:id` - Revoke API key

### 5. Security Audit Trail (1 endpoint)
- ✅ **GET** `/api/v1/profile/security-log` - View security events

### 6. Two-Factor Authentication (4 endpoints)
- ✅ **POST** `/api/v1/profile/2fa/enable` - Generate QR code
- ✅ **POST** `/api/v1/profile/2fa/verify` - Verify TOTP and enable
- ✅ **DELETE** `/api/v1/profile/2fa/disable` - Disable 2FA
- ✅ **POST** `/api/v1/profile/2fa/backup-codes` - Regenerate backup codes

**Total: 17 endpoints** 🎯

---

## 🧪 Testing Workflows

### Workflow 1: Profile Management

```
1. Get Profile → Verify user data
2. Update Profile → Change firstName/lastName
3. Get Preferences → Check default preferences
4. Update Preferences → Set theme, language, timezone
```

### Workflow 2: Avatar Upload

```
1. Upload Avatar → Select image file (JPEG/PNG/WebP)
   - Auto-resizes to 256x256
   - Converts to WebP at 85% quality
2. Get Profile → Verify imageUrl field
3. Delete Avatar → Remove avatar
4. Get Profile → Verify imageUrl is null
```

### Workflow 3: Session Management

```
1. List Sessions → View all active devices
2. Revoke Session → Logout from specific device
3. List Sessions → Verify session removed
4. Logout All Devices → Revoke all except current
```

### Workflow 4: API Key Management

```
1. Generate API Key → Get crypto-secure key
   ⚠️ Save key immediately - shown only once!
2. List API Keys → View masked keys
3. Revoke API Key → Soft delete with reason
4. List API Keys → Verify key is revoked
```

### Workflow 5: Security Audit Trail

```
1. Get Security Log → View all events
2. Filter by action → Get specific events (e.g., LOGIN)
3. Filter by date range → Get events in date range
4. Filter by severity → Get INFO/WARNING/ERROR/CRITICAL
5. Paginate results → Navigate through pages
```

### Workflow 6: 2FA/TOTP Setup (⭐ Featured)

```
1. POST /2fa/enable
   → Returns QR code (data:image/png;base64)
   → Check Console for QR code URL
   
2. Scan QR code with authenticator app:
   - Google Authenticator (iOS/Android)
   - Authy (iOS/Android/Desktop)
   - Microsoft Authenticator (iOS/Android)
   - 1Password (Multi-platform)
   - Bitwarden (Multi-platform)
   
3. POST /2fa/verify
   → Enter 6-digit code from app
   → Returns 10 backup codes (SAVE THEM!)
   ⚠️ Backup codes shown only once
   
4. Test TOTP verification:
   → Login with email/password + TOTP code
   → Or use backup code if needed
   
5. POST /2fa/backup-codes (optional)
   → Regenerate new backup codes
   → Old codes are invalidated
   
6. DELETE /2fa/disable (optional)
   → Requires TOTP code to disable
   → Prevents unauthorized removal
```

---

## 🎯 Test Automation

### Pre-request Scripts

All requests automatically:
- ✅ Attach `clerkToken` as Bearer token
- ✅ Warn if token is missing
- ✅ Set `Content-Type` headers

### Test Scripts

All requests include:
- ✅ Status code validation
- ✅ Response schema validation
- ✅ Auto-save IDs for subsequent requests
- ✅ Error logging in Console

**Example Auto-Save Flow:**
```javascript
1. List Sessions → Auto-saves sessionId
2. Revoke Session → Uses saved sessionId
3. Generate API Key → Auto-saves apiKeyId
4. Revoke API Key → Uses saved apiKeyId
```

---

## 📊 Expected Responses

### Success Response (200 OK)
```json
{
  "id": "cm1x2y3z4",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "USER",
  "createdAt": "2025-10-07T12:00:00.000Z"
}
```

### Error Response (400 Bad Request)
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "email",
      "message": "Email must be valid"
    }
  ]
}
```

### Authentication Error (401 Unauthorized)
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Invalid or expired token"
}
```

---

## 🔐 2FA Testing Guide

### Setup Instructions

#### Step 1: Enable 2FA
```bash
POST /api/v1/profile/2fa/enable
```

**Response:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,iVBORw0KGgo...",
  "manualEntryKey": "JBSWY3DPEHPK3PXP",
  "message": "Scan the QR code with your authenticator app"
}
```

**Actions:**
1. Check Postman Console for QR code
2. Copy QR code data URL
3. Open in browser or decode:
   ```html
   <img src="data:image/png;base64,iVBORw0KGgo..." />
   ```
4. Scan with authenticator app

#### Step 2: Verify TOTP
```bash
POST /api/v1/profile/2fa/verify
{
  "token": "123456"  # From authenticator app
}
```

**Response:**
```json
{
  "enabled": true,
  "backupCodes": [
    "A3F9E2D1",
    "B7C1D4E8",
    "C9F2E3A5",
    "D1B8C7F4",
    "E6A9D2C3",
    "F4B1E7A9",
    "G8C3D5B2",
    "H2E9F1C7",
    "I5D8A4B6",
    "J7F2C9E1"
  ],
  "message": "Two-factor authentication has been successfully enabled",
  "warning": "Save these backup codes in a secure location. You will not see them again."
}
```

**⚠️ CRITICAL:** Save backup codes immediately!

#### Step 3: Test Authentication

After enabling 2FA, login requires:
1. Email + Password
2. TOTP code OR backup code

**Login with TOTP:**
```bash
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password",
  "totpCode": "123456"  # 6-digit code
}
```

**Login with Backup Code:**
```bash
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password",
  "backupCode": "A3F9E2D1"  # One-time use
}
```

### Troubleshooting 2FA

**Issue 1: "Invalid verification code"**
- ✅ Check device time synchronization
- ✅ TOTP codes expire every 30 seconds
- ✅ Try next code if timing is tight
- ✅ System allows ±60 second tolerance

**Issue 2: QR code not displaying**
- ✅ Check Postman Console for data URL
- ✅ Copy and paste into browser
- ✅ Use manual entry key as fallback

**Issue 3: Lost backup codes**
- ✅ Run POST `/2fa/backup-codes` to regenerate
- ✅ Requires current TOTP code
- ✅ Old codes will be invalidated

**Issue 4: Lost authenticator app**
- ✅ Use backup recovery code
- ✅ Each code is single-use
- ✅ Regenerate new codes after recovery

---

## 🛠️ Environment Setup

### Local Development
```json
{
  "baseUrl": "http://localhost:3000",
  "clerkToken": "<local_jwt_token>"
}
```

### Staging
```json
{
  "baseUrl": "https://staging-api.mash.com",
  "clerkToken": "<staging_jwt_token>"
}
```

### Production
```json
{
  "baseUrl": "https://api.mash.com",
  "clerkToken": "<prod_jwt_token>"
}
```

---

## 📝 Tips & Best Practices

### 1. Token Management
- ✅ Refresh token before it expires
- ✅ Use environment variables for sensitive data
- ✅ Never commit tokens to Git

### 2. Test Order
- ✅ Run in sequence: Profile → Avatar → Sessions → API Keys → Security → 2FA
- ✅ Some requests depend on previous responses
- ✅ Auto-saved variables handle dependencies

### 3. File Upload (Avatar)
- ✅ Max file size: 5MB
- ✅ Formats: JPEG, PNG, WebP
- ✅ Auto-resizes to 256x256
- ✅ Converts to WebP at 85% quality

### 4. API Key Security
- ✅ Save full key immediately at creation
- ✅ Never logged or stored after creation
- ✅ Use for service accounts only
- ✅ Rotate keys regularly

### 5. 2FA Best Practices
- ✅ Save backup codes securely (password manager)
- ✅ Test backup code before relying on it
- ✅ Regenerate codes after using several
- ✅ Keep authenticator app synced with device time

---

## 🐛 Common Errors

### 401 Unauthorized
**Cause:** Invalid or expired Clerk token

**Solution:**
```bash
1. Get new token from Clerk Dashboard
2. Update {{clerkToken}} variable
3. Retry request
```

### 400 Bad Request
**Cause:** Invalid request body or parameters

**Solution:**
```bash
1. Check request body schema
2. Validate required fields
3. Check data types
```

### 404 Not Found
**Cause:** Invalid endpoint or resource ID

**Solution:**
```bash
1. Verify endpoint URL
2. Check resource ID format
3. Ensure resource exists
```

### 500 Internal Server Error
**Cause:** Server-side error or database issue

**Solution:**
```bash
1. Check server logs
2. Verify database connection
3. Contact development team
```

---

## 📊 Collection Variables

| Variable | Type | Auto-Set | Description |
|----------|------|----------|-------------|
| `baseUrl` | String | ❌ Manual | API base URL |
| `clerkToken` | String | ❌ Manual | Clerk JWT token |
| `userId` | String | ✅ Auto | Current user ID |
| `sessionId` | String | ✅ Auto | Session ID for testing |
| `apiKeyId` | String | ✅ Auto | API key ID for revoke |
| `generatedApiKey` | String | ✅ Auto | Full API key (saved once) |

---

## 🎓 Learning Resources

### Authenticator Apps
- [Google Authenticator](https://support.google.com/accounts/answer/1066447)
- [Authy](https://authy.com/guides/)
- [Microsoft Authenticator](https://www.microsoft.com/en-us/security/mobile-authenticator-app)

### TOTP Standard
- [RFC 6238: TOTP](https://datatracker.ietf.org/doc/html/rfc6238)
- [How TOTP Works](https://www.freecodecamp.org/news/how-time-based-one-time-passwords-work-and-why-you-should-use-them-in-your-app-fdd2b9ed43c3/)

### API Security
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

## 🚀 Next Steps

### Phase 4: IoT Device Management APIs (Coming Soon)
- Device registration and management
- Sensor data collection
- Real-time monitoring
- Device commands and controls

### Additional Collections
- `01-Authentication-API.postman_collection.json` - Auth endpoints
- `02-System-Administration-Monitoring-API.postman_collection.json` - Admin APIs
- `03-Categories-API.postman_collection.json` - Category management
- `04-Orders-API.postman_collection.json` - Order processing
- `05-Products-API.postman_collection.json` - Product catalog

---

## 📞 Support

**Issues?**
- Check console logs in Postman
- Verify environment variables
- Review server logs
- Contact: [your-email@example.com]

**Feature Requests?**
- Open GitHub issue
- Submit pull request
- Join our Discord

---

## ✅ Completion Checklist

- [ ] Import collection into Postman
- [ ] Set `baseUrl` variable
- [ ] Set `clerkToken` variable
- [ ] Test Profile endpoints (4)
- [ ] Test Avatar upload/delete (2)
- [ ] Test Session management (3)
- [ ] Test API Key generation (3)
- [ ] Test Security log (1)
- [ ] Test 2FA setup flow (4)
- [ ] Save backup codes securely
- [ ] Document any issues

**Total: 17 endpoints to test** ✨

---

**Happy Testing! 🎉**
