# MASH SMTP Relay - README

## 📧 Quick Start Guide

This directory contains an SMTP relay server that forwards email requests from Railway (production) to Gmail SMTP via ngrok tunnel.

### Why This Exists

Railway blocks outbound SMTP ports (587, 465, 25), preventing direct email sending. This relay server runs on your local machine and acts as a bridge:

```
Railway Backend → ngrok HTTPS Tunnel → Local Relay Server → Gmail SMTP → Recipients
```

---

## 🚀 Quick Start (Easiest Method)

### Windows (Command Prompt)
```bash
cd c:\Users\Kenneth\Desktop\PP Namias\MASH-Backend
start-smtp-relay.bat
```

### Windows (PowerShell)
```powershell
cd "c:\Users\Kenneth\Desktop\PP Namias\MASH-Backend"
.\start-smtp-relay.ps1
```

The script will:
1. ✅ Install dependencies (if needed)
2. ✅ Start SMTP relay server (port 2525)
3. ✅ Start ngrok tunnel (Asia Pacific region)
4. ✅ Open ngrok dashboard to get your URL

---

## 📋 Manual Setup (Step-by-Step)

### 1. Install Dependencies

```bash
cd smtp-relay-server
npm install
```

### 2. Configure Environment

The `.env` file is already configured with your Gmail credentials. **No changes needed.**

```env
RELAY_PORT=2525
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=MASH.Mushroom.Automation@gmail.com
EMAIL_PASSWORD=rtaeavlpvqaovgix
EMAIL_FROM=MASH Mushroom Automation <MASH.Mushroom.Automation@gmail.com>
```

### 3. Start Relay Server

```bash
npm start
```

**Expected Output**:
```
🚀 ================================
🚀 SMTP Relay Server is running!
🚀 ================================
📍 Local: http://localhost:2525
📧 Email: MASH.Mushroom.Automation@gmail.com
🔧 Host: smtp.gmail.com

📝 Endpoints:
   GET  /health       - Health check
   POST /send-email   - Send single email
   POST /send-bulk    - Send multiple emails

✅ SMTP Relay is ready to send emails
```

### 4. Start ngrok Tunnel

**In a new terminal**:

```bash
ngrok http 2525 --region ap
```

**Expected Output**:
```
Session Status                online
Account                       Jhon Keneth Namias (Plan: Free)
Region                        Asia Pacific (ap)
Forwarding                    https://abc123-xyz.ngrok-free.app -> http://localhost:2525
```

**⚠️ Copy the HTTPS URL** - you'll need it for Railway configuration.

### 5. Update Railway Environment Variables

In Railway dashboard, add/update:

```env
SMTP_RELAY_ENABLED=true
SMTP_RELAY_URL=https://abc123-xyz.ngrok-free.app
SMTP_RELAY_ENDPOINT=/send-email
```

### 6. Deploy Backend to Railway

```bash
git add .
git commit -m "feat: Add ngrok SMTP relay support"
git push origin 13-advanced-order-management-processing-system
```

---

## 🧪 Testing

### Test 1: Local Relay (Without ngrok)

```bash
# In smtp-relay-server directory
npm test

# Or manually with curl
curl -X POST http://localhost:2525/send-email \
  -H "Content-Type: application/json" \
  -d "{\"to\":\"your-email@example.com\",\"subject\":\"Test\",\"html\":\"<h1>Test</h1>\"}"
```

### Test 2: Via ngrok Tunnel

```bash
curl -X POST https://YOUR-NGROK-URL.ngrok-free.app/send-email \
  -H "Content-Type: application/json" \
  -d "{\"to\":\"your-email@example.com\",\"subject\":\"Test via ngrok\",\"html\":\"<h1>ngrok works!</h1>\"}"
```

### Test 3: From Railway Backend

```bash
curl -X POST https://mash-backend-api-production.up.railway.app/api/v1/notifications/test-email \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"your-email@example.com\"}"
```

---

## 🔍 Monitoring

### ngrok Dashboard
- **URL**: http://127.0.0.1:4040
- **Features**: Request inspection, response times, replay requests

### Relay Server Logs

All incoming email requests are logged:

```
📧 [2025-11-23T10:30:00.000Z] Sending email to: user@example.com
   Subject: Password Reset Code
✅ Email sent successfully: <message-id@gmail.com>
   Response: 250 2.0.0 OK
```

### Railway Logs

```bash
railway logs --follow
```

Look for:
- `📧 Sending email via ngrok relay`
- `✅ Email sent successfully via relay`
- `❌ SMTP Relay error` (troubleshoot)

---

## 🔧 Troubleshooting

### Issue: "ECONNREFUSED" Error

**Symptom**: Railway logs show connection refused

**Solution**:
1. Check if relay server is running: `curl http://localhost:2525/health`
2. Check if ngrok is running: Visit http://127.0.0.1:4040
3. Verify ngrok URL in Railway matches current tunnel

### Issue: "Invalid login" Error

**Symptom**: Relay logs show Gmail authentication failure

**Solution**:
1. Check Gmail app password is correct in `.env`
2. Regenerate app password: https://myaccount.google.com/apppasswords
3. Ensure 2-Step Verification is enabled on Gmail

### Issue: ngrok URL Changes

**Symptom**: Relay stops working after ngrok restart

**Solution**:
- **Free Plan**: URL changes on every restart - update Railway env vars
- **Paid Plan ($8/month)**: Get reserved domain (URL never changes)

### Issue: Port 2525 Already in Use

```bash
# Windows - Find and kill process
netstat -ano | findstr :2525
taskkill /PID <PID> /F

# Or use different port
set RELAY_PORT=3535
npm start
```

---

## 📊 Email Provider Priority (Automatic Failover)

The backend automatically tries providers in this order:

1. **SMTP Relay (Priority 1)** - Railway production ✅
   - Requires: ngrok tunnel + local relay running
   - Best for: Production deployment on Railway

2. **SendGrid API (Priority 5)** - Cloud-native ⏸️ TODO
   - Requires: SendGrid API key
   - Best for: Reliable cloud-based sending

3. **Direct SMTP (Priority 10)** - Local development ✅
   - Requires: Gmail app password
   - Best for: Local testing only (fails on Railway)

If SMTP Relay fails (ngrok down), backend automatically falls back to next provider.

---

## 💰 Cost Analysis

### Current Setup (Free)
- ✅ ngrok Free Plan: $0/month
- ✅ Gmail SMTP: $0/month
- ⚠️ Requires always-on PC

### Recommended Upgrade
- ngrok Personal Plan: $8/month
  - ✅ Reserved domain (URL never changes)
  - ✅ 3 simultaneous tunnels
  - ✅ 120 connections/minute

### Alternative (No Tunnel)
- SendGrid Free Tier: $0/month
  - ✅ 100 emails/day
  - ✅ No local relay needed
  - ⏸️ Requires implementation

---

## 📁 File Structure

```
smtp-relay-server/
├── server.js           # Main relay server (Express + nodemailer)
├── package.json        # Dependencies
├── .env               # Configuration (Gmail credentials)
├── test-relay.js      # Automated testing script
├── .gitignore         # Ignore node_modules, logs
└── README.md          # This file
```

---

## 🔐 Security Notes

1. **Never commit `.env`** to Git (contains Gmail password)
2. **Use app-specific password** (not your main Gmail password)
3. **Optional**: Add `SMTP_RELAY_API_KEY` to Railway for authentication
4. **Keep ngrok updated**: Version 3.18.x stops working Dec 17, 2025

---

## 📚 Additional Resources

- **Full Setup Guide**: `docs/NGROK_SMTP_SETUP_GUIDE.md`
- **ngrok Dashboard**: http://127.0.0.1:4040
- **Railway Dashboard**: https://railway.app/dashboard
- **Gmail App Passwords**: https://myaccount.google.com/apppasswords
- **SendGrid Signup**: https://sendgrid.com

---

## ✅ Quick Checklist

Before deploying to Railway:

- [ ] Relay server running (`npm start`)
- [ ] ngrok tunnel active (`ngrok http 2525 --region ap`)
- [ ] ngrok URL copied
- [ ] Railway env vars updated (`SMTP_RELAY_URL`)
- [ ] Backend code deployed to Railway
- [ ] Test email sent successfully
- [ ] Monitoring logs for errors

---

**Status**: Production Ready ✅  
**Setup Time**: 10-15 minutes  
**Maintenance**: Keep PC running + update ngrok URL after restarts
