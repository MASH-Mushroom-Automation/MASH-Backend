# ngrok SMTP Relay Setup Guide for Railway Deployment

**Problem**: Railway blocks outbound connections on port 587 (SMTP), preventing email sending from deployed backend.

**Solution**: Use ngrok as an SMTP relay tunnel to forward Railway → Your Local Machine → Email Provider

**Date**: November 23, 2025  
**Project**: MASH-Backend  
**Deployment**: Railway  
**ngrok Account**: Jhon Keneth Namias (Free Plan)

---

## 📋 Table of Contents

1. [Problem Overview](#problem-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Prerequisites](#prerequisites)
4. [Local SMTP Relay Setup](#local-smtp-relay-setup)
5. [ngrok Tunnel Configuration](#ngrok-tunnel-configuration)
6. [Railway Backend Configuration](#railway-backend-configuration)
7. [Email Service Multi-Provider Failover](#email-service-multi-provider-failover)
8. [Testing & Validation](#testing--validation)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)
11. [Cost & Limitations](#cost--limitations)

---

## 🔴 Problem Overview

### Railway Restrictions

Railway blocks the following ports on their free tier:
- **Port 587**: SMTP (STARTTLS) - Used by Gmail, Outlook
- **Port 465**: SMTPS (SSL/TLS) - Alternative SMTP port
- **Port 25**: SMTP (Unencrypted) - Legacy SMTP

**Impact**:
- Cannot send emails directly from Railway backend
- All email-dependent features fail (OTP, notifications, password resets)
- No error logs visible in Railway dashboard

### Current Email Service Setup

**File**: `src/modules/notifications/services/email.service.ts`

```typescript
// Multi-provider email system with failover
providers = [
  { name: 'SMTP', priority: 10, transporter: nodemailer } // Gmail SMTP
  { name: 'SENDGRID', priority: 1, transporter: null }    // SendGrid API (TODO)
]
```

**Current State**:
- ✅ Gmail SMTP works locally (port 587)
- ❌ Gmail SMTP fails on Railway (port blocked)
- ⏸️ SendGrid API not yet implemented
- 🔧 Need ngrok relay as intermediate solution

---

## 🏗️ Architecture Diagram

### Without ngrok (Current - BROKEN on Railway)
```
Railway Backend → Gmail SMTP:587 ❌ BLOCKED
```

### With ngrok SMTP Relay (Solution)
```
Railway Backend (Railway Cloud)
    ↓ HTTPS
ngrok Tunnel (rylie-totable-unwifely.ngrok-free.dev)
    ↓ HTTP/TCP
Local SMTP Relay (Your PC - Port 2525)
    ↓ SMTP
Gmail/SendGrid (Port 587/465)
    ↓ Email Delivery
User's Inbox ✅
```

**Flow Breakdown**:
1. Railway backend sends email via HTTP POST to ngrok URL
2. ngrok tunnel forwards request to your local machine
3. Local SMTP relay receives and transforms to SMTP protocol
4. SMTP relay connects to Gmail/SendGrid (port 587/465)
5. Email provider delivers to recipient

---

## ✅ Prerequisites

### 1. ngrok Account Setup ✅ (Already Done)

**Your Current Setup**:
```
Account: Jhon Keneth Namias
Plan: Free
Version: 3.24.0-msix
Region: Asia Pacific (ap)
Current Tunnel: https://rylie-totable-unwifely.ngrok-free.dev
```

**⚠️ Important Notice**: 
- Free plan agents ≤3.18.x stop working on **December 17, 2025**
- Your version (3.24.0) is safe until then
- Update available: 3.33.0 (run `ngrok update` or Ctrl-U)

### 2. Local Machine Requirements

- **Windows PC** (your development machine)
- **Always-on requirement**: PC must run 24/7 for production emails
- **Stable internet**: Recommended upload speed ≥5 Mbps
- **Port access**: Ability to run services on localhost:2525

### 3. Email Provider Access

**Gmail SMTP** (Already Configured):
- ✅ Email: `MASH.Mushroom.Automation@gmail.com`
- ✅ App Password: `rtaeavlpvqaovgix`
- ✅ SMTP: `smtp.gmail.com:587`

**SendGrid API** (Optional Failover):
- ⏸️ API Key: Not yet configured
- ⏸️ From Email: `MASH.Mushroom.Automation@gmail.com`
- Sign up: https://sendgrid.com (100 emails/day free)

---

## 🛠️ Local SMTP Relay Setup

### Option 1: Node.js SMTP Relay Server (Recommended)

Create a lightweight SMTP relay service that accepts HTTP requests and sends via SMTP.

#### Step 1: Create Relay Server

**File**: `smtp-relay-server/server.js` (in project root or separate folder)

```javascript
const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// SMTP transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Transporter Error:', error);
  } else {
    console.log('✅ SMTP Relay is ready to send emails');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'smtp-relay', timestamp: new Date() });
});

// Email sending endpoint
app.post('/send-email', async (req, res) => {
  const { to, subject, html, text, from } = req.body;

  try {
    console.log(`📧 Sending email to: ${to}`);
    
    const info = await transporter.sendMail({
      from: from || process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });

    console.log('✅ Email sent:', info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('❌ Email send error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.RELAY_PORT || 2525;
app.listen(PORT, () => {
  console.log(`🚀 SMTP Relay Server running on http://localhost:${PORT}`);
  console.log(`📧 Configured for: ${process.env.EMAIL_USER || 'No email configured'}`);
});
```

#### Step 2: Create Package.json

**File**: `smtp-relay-server/package.json`

```json
{
  "name": "mash-smtp-relay",
  "version": "1.0.0",
  "description": "SMTP relay server for Railway deployment",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "nodemailer": "^6.9.7",
    "body-parser": "^1.20.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

#### Step 3: Create Environment File

**File**: `smtp-relay-server/.env`

```env
# SMTP Relay Configuration
RELAY_PORT=2525

# Gmail SMTP (Same as main backend)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=MASH.Mushroom.Automation@gmail.com
EMAIL_PASSWORD=rtaeavlpvqaovgix
EMAIL_FROM=MASH Mushroom Automation <MASH.Mushroom.Automation@gmail.com>
```

#### Step 4: Install and Run

```bash
cd smtp-relay-server
npm install
npm start
```

**Expected Output**:
```
🚀 SMTP Relay Server running on http://localhost:2525
✅ SMTP Relay is ready to send emails
📧 Configured for: MASH.Mushroom.Automation@gmail.com
```

#### Step 5: Test Locally

```bash
curl -X POST http://localhost:2525/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<h1>Hello from SMTP Relay</h1>",
    "text": "Hello from SMTP Relay"
  }'
```

---

## 🌐 ngrok Tunnel Configuration

### Step 1: Update ngrok (Recommended)

```bash
# Check current version
ngrok version

# Update to latest (3.33.0)
ngrok update

# Or use Ctrl-U in ngrok terminal
```

### Step 2: Start ngrok Tunnel

**Option A: HTTP Tunnel (Recommended for REST API)**

```bash
# Start HTTP tunnel on port 2525
ngrok http 2525 --region ap

# With custom subdomain (requires paid plan)
# ngrok http 2525 --subdomain=mash-smtp-relay --region ap
```

**Option B: TCP Tunnel (For pure SMTP forwarding)**

```bash
# Start TCP tunnel on port 2525
ngrok tcp 2525 --region ap
```

**Current Tunnel Status**:
```
Session Status: online
Account: Jhon Keneth Namias (Plan: Free)
Version: 3.24.0-msix
Region: Asia Pacific (ap)
Forwarding: https://rylie-totable-unwifely.ngrok-free.dev -> http://localhost:3000
```

### Step 3: Configure Multiple Tunnels (Advanced)

**File**: `ngrok.yml` (in `%USERPROFILE%\.ngrok2\` or `C:\Users\Kenneth\.ngrok2\`)

```yaml
version: "2"
authtoken: YOUR_NGROK_AUTH_TOKEN

tunnels:
  backend:
    proto: http
    addr: 3000
    subdomain: mash-backend  # Requires paid plan
    region: ap

  smtp-relay:
    proto: http
    addr: 2525
    region: ap
    # Optional: Add basic auth for security
    # auth: "username:password"
```

**Start all tunnels**:
```bash
ngrok start --all
```

**Or start specific tunnel**:
```bash
ngrok start smtp-relay
```

### Step 4: Get ngrok URL

After starting tunnel, ngrok will display:

```
Forwarding    https://abc123-xyz.ngrok-free.app -> http://localhost:2525
```

**Copy this URL** - you'll need it for Railway configuration.

**Example**:
- Local: `http://localhost:2525`
- ngrok: `https://abc123-xyz.ngrok-free.app`

---

## ⚙️ Railway Backend Configuration

### Step 1: Update Environment Variables

In Railway dashboard, add/update these variables:

```env
# SMTP Relay Configuration (ngrok tunnel)
SMTP_RELAY_ENABLED=true
SMTP_RELAY_URL=https://abc123-xyz.ngrok-free.app  # Your ngrok URL
SMTP_RELAY_ENDPOINT=/send-email
SMTP_RELAY_API_KEY=optional_security_key          # Optional: for authentication

# Original SMTP Config (Backup - for local development)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=MASH.Mushroom.Automation@gmail.com
EMAIL_PASSWORD=rtaeavlpvqaovgix
EMAIL_FROM=MASH Mushroom Automation <MASH.Mushroom.Automation@gmail.com>

# SendGrid Fallback (Optional)
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=MASH.Mushroom.Automation@gmail.com
```

### Step 2: Update Email Service

**File**: `src/modules/notifications/services/email.service.ts`

Add HTTP relay provider (before the existing code):

```typescript
import axios from 'axios';

private async sendViaRelay(options: SendEmailOptions, html: string, text: string): Promise<void> {
  if (!process.env.SMTP_RELAY_ENABLED || !process.env.SMTP_RELAY_URL) {
    throw new Error('SMTP relay not configured');
  }

  const relayUrl = `${process.env.SMTP_RELAY_URL}${process.env.SMTP_RELAY_ENDPOINT || '/send-email'}`;

  try {
    this.logger.log(`📧 Sending email via ngrok relay: ${relayUrl}`);

    const response = await axios.post(relayUrl, {
      to: options.to,
      subject: options.subject,
      html,
      text,
      from: process.env.EMAIL_FROM,
    }, {
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SMTP_RELAY_API_KEY && {
          'Authorization': `Bearer ${process.env.SMTP_RELAY_API_KEY}`
        })
      },
      timeout: 30000, // 30 seconds
    });

    if (response.data.success) {
      this.logger.log(`✅ Email sent successfully via relay: ${response.data.messageId}`);
    } else {
      throw new Error(response.data.error || 'Unknown relay error');
    }
  } catch (error) {
    this.logger.error(`❌ SMTP Relay error: ${error.message}`);
    throw error;
  }
}
```

### Step 3: Update Provider Priority

**Modify `initializeProviders()` method**:

```typescript
private initializeProviders() {
  // 1. SMTP Relay (Railway) - Highest priority
  if (process.env.SMTP_RELAY_ENABLED === 'true') {
    this.providers.push({
      name: 'RELAY' as EmailProvider,
      enabled: true,
      priority: 1, // Highest priority
    });
    this.logger.log('✅ SMTP Relay provider enabled');
  }

  // 2. SendGrid API (if configured)
  if (process.env.SENDGRID_API_KEY) {
    this.providers.push({
      name: EmailProvider.SENDGRID,
      enabled: true,
      priority: 5,
    });
    this.logger.log('✅ SendGrid provider enabled');
  }

  // 3. Direct SMTP (fallback for local development)
  this.providers.push({
    name: EmailProvider.SMTP,
    enabled: true,
    priority: 10, // Lowest priority
    transporter: this.createSMTPTransporter(),
  });

  this.providers.sort((a, b) => a.priority - b.priority);
  this.logger.log(`📧 Initialized ${this.providers.length} email providers`);
}
```

### Step 4: Update Send Method

**Modify `sendEmail()` method to handle relay**:

```typescript
async sendEmail(options: SendEmailOptions): Promise<void> {
  const { html, text } = await this.emailTemplateService.getTemplate(
    options.templateType,
    options.variables,
  );

  // Try each provider in order of priority
  for (const provider of this.providers) {
    if (!provider.enabled) continue;

    try {
      if (provider.name === 'RELAY') {
        await this.sendViaRelay(options, html, text);
        return; // Success - exit
      } else if (provider.name === EmailProvider.SENDGRID) {
        // TODO: Implement SendGrid
        throw new Error('SendGrid not yet implemented');
      } else if (provider.name === EmailProvider.SMTP) {
        await this.sendViaSMTP(provider, options, html, text);
        return; // Success - exit
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to send via ${provider.name}: ${error.message}`
      );
      // Try next provider
    }
  }

  throw new Error('All email providers failed');
}
```

### Step 5: Deploy to Railway

```bash
# Commit changes
git add .
git commit -m "feat: Add ngrok SMTP relay support for Railway"

# Push to trigger Railway deployment
git push origin 13-advanced-order-management-processing-system

# Or use Railway CLI
railway up
```

---

## 🔄 Email Service Multi-Provider Failover

### Priority Order

```
1. SMTP Relay (ngrok) - Railway production     [Priority: 1]
   ↓ (if fails)
2. SendGrid API - Alternative cloud provider   [Priority: 5]
   ↓ (if fails)
3. Direct SMTP - Local development only        [Priority: 10]
   ↓ (if all fail)
Error: All email providers failed
```

### Provider Configuration Matrix

| Provider | Environment | Requires | Status |
|----------|-------------|----------|--------|
| **SMTP Relay** | Railway Production | ngrok tunnel + local relay | ✅ Ready to implement |
| **SendGrid API** | Any (Cloud-native) | SendGrid API key | ⏸️ TODO: Implement |
| **Direct SMTP** | Local Development | Gmail app password | ✅ Working |

### Failover Example

```typescript
// Attempt 1: SMTP Relay (Railway)
try {
  await sendViaRelay(options);
  // ✅ Success - Email sent
} catch (error) {
  // ❌ ngrok down or local PC offline
  
  // Attempt 2: SendGrid API
  try {
    await sendViaSendGrid(options);
    // ✅ Success - Email sent via SendGrid
  } catch (error) {
    // ❌ SendGrid quota exceeded or API key invalid
    
    // Attempt 3: Direct SMTP (will fail on Railway)
    try {
      await sendViaSMTP(options);
      // ✅ Success (only works locally)
    } catch (error) {
      // ❌ Port 587 blocked on Railway
      throw new Error('All email providers failed');
    }
  }
}
```

---

## 🧪 Testing & Validation

### Test 1: Local Relay Server

```bash
# Terminal 1: Start SMTP relay
cd smtp-relay-server
npm start

# Terminal 2: Test relay endpoint
curl -X POST http://localhost:2525/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "subject": "Test from Local Relay",
    "html": "<h1>Test</h1>",
    "text": "Test"
  }'
```

**Expected**: Email arrives in inbox within 30 seconds

### Test 2: ngrok Tunnel

```bash
# Terminal 3: Start ngrok
ngrok http 2525 --region ap

# Copy the HTTPS URL, then test:
curl -X POST https://YOUR-NGROK-URL.ngrok-free.app/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "subject": "Test from ngrok Relay",
    "html": "<h1>ngrok works!</h1>",
    "text": "ngrok works!"
  }'
```

**Expected**: Email arrives via ngrok tunnel

### Test 3: Railway Backend

```bash
# Deploy to Railway, then test
curl -X POST https://your-railway-app.up.railway.app/api/v1/notifications/test-email \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com"
  }'
```

**Expected**: Email sent via Railway → ngrok → local relay → Gmail

### Test 4: End-to-End Flow

1. Trigger password reset from frontend
2. Check Railway logs for email sending
3. Verify ngrok shows incoming request
4. Check local relay logs for SMTP send
5. Confirm email arrives in inbox

---

## 📊 Monitoring & Maintenance

### ngrok Dashboard

Access: http://127.0.0.1:4040

**Features**:
- Request inspection
- Response times
- Replay requests
- Request/response bodies

**Metrics to Monitor**:
- Connections: `ttl`, `opn` (open connections)
- Response times: `p50`, `p90` (50th/90th percentile)
- Error rates

### SMTP Relay Logs

**Monitor**:
```bash
cd smtp-relay-server
npm start | tee smtp-relay.log
```

**Log Patterns**:
- `✅ Email sent`: Successful delivery
- `❌ Email send error`: SMTP failure (check Gmail credentials)
- `📧 Sending email to`: Incoming request logged

### Railway Logs

**Command**:
```bash
railway logs --follow
```

**Look for**:
- `📧 Sending email via ngrok relay`
- `✅ Email sent successfully via relay`
- `❌ SMTP Relay error`

### Uptime Monitoring

**Critical**:
- ⚠️ Your local PC must be **always running** for production emails
- ⚠️ ngrok must be **always connected**
- ⚠️ SMTP relay server must be **always running**

**Solutions for 24/7 Uptime**:
1. **Dedicated Mini PC**: Run relay on always-on Raspberry Pi or old laptop
2. **Cloud VM**: Deploy relay to free-tier VM (Google Cloud, AWS Free Tier)
3. **SendGrid Migration**: Complete SendGrid API implementation (no tunnel needed)

---

## 🔧 Troubleshooting

### Issue 1: ngrok Tunnel Disconnects

**Symptoms**:
- Railway logs show "SMTP Relay error: ECONNREFUSED"
- ngrok shows "Session Status: offline"

**Solutions**:
```bash
# 1. Restart ngrok
ngrok http 2525 --region ap

# 2. Check ngrok version (must be ≥3.18.x)
ngrok version
ngrok update

# 3. Verify ngrok authtoken
ngrok config check
```

### Issue 2: Port 2525 Already in Use

**Error**: `EADDRINUSE: address already in use :::2525`

**Solutions**:
```bash
# Find process using port 2525
netstat -ano | findstr :2525

# Kill process
taskkill /PID <PID> /F

# Or use different port
set RELAY_PORT=3535
npm start
```

### Issue 3: Gmail Blocks SMTP

**Error**: `Invalid login: 535-5.7.8 Username and Password not accepted`

**Solutions**:
1. **Regenerate App Password**:
   - Visit: https://myaccount.google.com/apppasswords
   - Create new "App Password" for "Mail"
   - Update `EMAIL_PASSWORD` in `.env`

2. **Enable Less Secure Apps**:
   - Visit: https://myaccount.google.com/lesssecureapps
   - Turn ON (not recommended, use App Password instead)

3. **Check 2FA**:
   - 2-Step Verification must be **enabled** for App Passwords

### Issue 4: Railway Can't Reach ngrok

**Symptoms**:
- Railway logs: "SMTP Relay error: timeout of 30000ms exceeded"
- ngrok dashboard shows no incoming requests

**Solutions**:
1. **Verify ngrok URL** in Railway env vars
2. **Check ngrok is running**: `ngrok config check`
3. **Test ngrok publicly**:
   ```bash
   curl https://YOUR-NGROK-URL.ngrok-free.app/health
   ```
4. **Check firewall**: Windows Firewall may block ngrok

### Issue 5: Emails Not Arriving

**Checklist**:
- [ ] Check spam/junk folder
- [ ] Verify Gmail credentials are correct
- [ ] Check Gmail "Sent" folder (if using Gmail SMTP)
- [ ] Review SMTP relay logs for send confirmation
- [ ] Test with different recipient email
- [ ] Verify email template renders correctly

---

## 💰 Cost & Limitations

### ngrok Free Plan (Current)

**Limits**:
- ✅ 1 online tunnel at a time
- ✅ 40 connections/minute
- ❌ Random subdomain (changes on restart)
- ❌ No custom domains
- ⚠️ Agents ≤3.18.x stop working **Dec 17, 2025**

**Cost**: $0/month

### ngrok Personal Plan ($8/month)

**Benefits**:
- ✅ 3 simultaneous tunnels
- ✅ Reserved domain (stable URL)
- ✅ Custom subdomains
- ✅ 120 connections/minute
- ✅ Webhook signatures

**Use Cases**:
- Production-ready email relay
- Multiple services (backend + SMTP relay)
- No URL changes after restart

### SendGrid Free Tier (Alternative)

**Limits**:
- ✅ 100 emails/day (3,000/month)
- ✅ No relay needed (API-based)
- ✅ Delivery analytics
- ✅ Email validation

**Cost**: $0/month (no credit card required)

**Implementation Status**: ⏸️ TODO

### Recommended Approach

**Phase 1 (Now)**: ngrok Free Plan
- ✅ Quick setup (1 hour)
- ✅ No code changes to backend email service
- ⚠️ Requires always-on local PC

**Phase 2 (Next 2 weeks)**: SendGrid API
- 🔧 Implement SendGrid provider (2-3 hours)
- ✅ No tunnel needed
- ✅ More reliable
- ⚠️ 100 emails/day limit

**Phase 3 (Future)**: ngrok Personal ($8/month)
- ✅ Production-ready relay
- ✅ Reserved domain (no URL changes)
- ✅ Backup for SendGrid

---

## 📚 Quick Reference

### Commands

```bash
# Start SMTP Relay
cd smtp-relay-server && npm start

# Start ngrok HTTP tunnel
ngrok http 2525 --region ap

# Start ngrok with config file
ngrok start smtp-relay

# Update ngrok
ngrok update

# Check ngrok version
ngrok version

# Test relay locally
curl -X POST http://localhost:2525/send-email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","html":"<h1>Test</h1>"}'

# Test via ngrok
curl -X POST https://YOUR-NGROK-URL.ngrok-free.app/send-email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","html":"<h1>Test</h1>"}'

# Railway logs
railway logs --follow

# Kill process on port 2525 (Windows)
netstat -ano | findstr :2525
taskkill /PID <PID> /F
```

### URLs

- **ngrok Dashboard**: http://127.0.0.1:4040
- **Gmail App Passwords**: https://myaccount.google.com/apppasswords
- **SendGrid Signup**: https://sendgrid.com
- **Railway Dashboard**: https://railway.app/dashboard
- **ngrok Pricing**: https://ngrok.com/pricing

### Environment Variables

```env
# SMTP Relay Server (.env in smtp-relay-server/)
RELAY_PORT=2525
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=MASH.Mushroom.Automation@gmail.com
EMAIL_PASSWORD=rtaeavlpvqaovgix
EMAIL_FROM=MASH Mushroom Automation <MASH.Mushroom.Automation@gmail.com>

# Railway Backend (Railway Dashboard)
SMTP_RELAY_ENABLED=true
SMTP_RELAY_URL=https://YOUR-NGROK-URL.ngrok-free.app
SMTP_RELAY_ENDPOINT=/send-email
SMTP_RELAY_API_KEY=optional_security_key
```

---

## ✅ Implementation Checklist

- [ ] **1. Update ngrok** (version 3.33.0)
- [ ] **2. Create SMTP relay server** (`smtp-relay-server/server.js`)
- [ ] **3. Install relay dependencies** (`npm install`)
- [ ] **4. Configure relay environment** (`.env` file)
- [ ] **5. Test relay locally** (curl to localhost:2525)
- [ ] **6. Start ngrok tunnel** (`ngrok http 2525`)
- [ ] **7. Copy ngrok URL** (from terminal output)
- [ ] **8. Update Railway env vars** (add `SMTP_RELAY_URL`)
- [ ] **9. Modify email service** (add relay provider)
- [ ] **10. Deploy to Railway** (`git push`)
- [ ] **11. Test end-to-end** (trigger email from Railway)
- [ ] **12. Monitor logs** (Railway, ngrok, relay)
- [ ] **13. Set up monitoring** (uptime checks)
- [ ] **14. Document for team** (share this guide)

---

## 🎯 Next Steps

### Immediate (Today)
1. Create SMTP relay server
2. Test locally
3. Start ngrok tunnel
4. Test via ngrok

### Short-term (This Week)
1. Update email service code
2. Deploy to Railway
3. Test production emails
4. Monitor for issues

### Long-term (Next 2 Weeks)
1. Implement SendGrid API provider
2. Add email sending dashboard
3. Set up automated monitoring
4. Consider ngrok Personal plan ($8/month)

---

**Status**: Ready to implement  
**Estimated Setup Time**: 1-2 hours  
**Maintenance**: Always-on PC required + periodic ngrok updates

**Created by**: GitHub Copilot  
**Date**: November 23, 2025  
**Last Updated**: November 23, 2025
