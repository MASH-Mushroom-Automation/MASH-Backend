# 🚀 Quick Start - SMTP Relay for Railway

**Problem**: Railway blocks SMTP port 587, preventing email sending  
**Solution**: ngrok tunnel relay (Railway → ngrok → local PC → Gmail)  
**Time**: 10-15 minutes setup

---

## ⚡ Super Quick Start (One Command)

### Windows Command Prompt
```cmd
cd c:\Users\Kenneth\Desktop\PP Namias\MASH-Backend
start-smtp-relay.bat
```

### Windows PowerShell
```powershell
cd "c:\Users\Kenneth\Desktop\PP Namias\MASH-Backend"
.\start-smtp-relay.ps1
```

**What happens**:
1. ✅ Installs dependencies (if needed)
2. ✅ Starts SMTP relay on port 2525
3. ✅ Starts ngrok tunnel (Asia Pacific)
4. ✅ Opens ngrok dashboard

---

## 📋 Manual Steps (If Scripts Don't Work)

### Step 1: Install Dependencies
```bash
cd smtp-relay-server
npm install
```

### Step 2: Start Relay Server
```bash
npm start
```

**Expected output**:
```
🚀 SMTP Relay Server is running!
📍 Local: http://localhost:2525
📧 Email: MASH.Mushroom.Automation@gmail.com
✅ SMTP Relay is ready to send emails
```

### Step 3: Start ngrok Tunnel (New Terminal)
```bash
ngrok http 2525 --region ap
```

**Expected output**:
```
Session Status                online
Account                       Jhon Keneth Namias (Plan: Free)
Forwarding                    https://abc123-xyz.ngrok-free.app -> http://localhost:2525
```

**⚠️ IMPORTANT**: Copy the `https://...ngrok-free.app` URL

### Step 4: Configure Railway

In Railway dashboard, add these environment variables:

```env
SMTP_RELAY_ENABLED=true
SMTP_RELAY_URL=https://abc123-xyz.ngrok-free.app
SMTP_RELAY_ENDPOINT=/send-email
```

### Step 5: Deploy to Railway

```bash
git add .
git commit -m "feat: Add ngrok SMTP relay support"
git push origin 13-advanced-order-management-processing-system
```

### Step 6: Test Email

Trigger any email-sending action (password reset, verification, etc.)

---

## 🧪 Testing

### Test Relay Locally
```bash
curl -X POST http://localhost:2525/send-email ^
  -H "Content-Type: application/json" ^
  -d "{\"to\":\"your-email@example.com\",\"subject\":\"Test\",\"html\":\"<h1>Test</h1>\"}"
```

### Test via ngrok
```bash
curl -X POST https://YOUR-NGROK-URL.ngrok-free.app/send-email ^
  -H "Content-Type: application/json" ^
  -d "{\"to\":\"your-email@example.com\",\"subject\":\"Test\",\"html\":\"<h1>Works!</h1>\"}"
```

---

## 🔍 Monitoring

### ngrok Dashboard
- **URL**: http://127.0.0.1:4040
- **View**: All incoming requests, response times, errors

### Relay Server Logs
Watch the terminal where `npm start` is running:
- `📧 Sending email to: ...` - Request received
- `✅ Email sent: ...` - Successfully sent
- `❌ Email send error: ...` - Failed (check Gmail credentials)

### Railway Logs
```bash
railway logs --follow
```

Look for:
- `📧 Sending email via ngrok relay`
- `✅ Email sent successfully via relay`
- `❌ SMTP Relay error` - troubleshoot

---

## 🔧 Troubleshooting

### Error: "ECONNREFUSED"
**Symptom**: Railway can't reach relay

**Fix**:
1. Check relay is running: `curl http://localhost:2525/health`
2. Check ngrok is running: Visit http://127.0.0.1:4040
3. Verify Railway has correct ngrok URL

### Error: "Invalid login"
**Symptom**: Gmail rejects authentication

**Fix**:
1. Check `.env` has correct app password
2. Regenerate: https://myaccount.google.com/apppasswords
3. Ensure 2-Step Verification is ON

### Error: "Port 2525 already in use"
**Fix**:
```bash
# Find process
netstat -ano | findstr :2525

# Kill process
taskkill /PID <PID> /F
```

### ngrok URL Changes After Restart
**Cause**: Free plan generates random URLs

**Fix**:
- **Option A**: Update Railway env vars with new URL (5 min)
- **Option B**: Upgrade to ngrok Personal ($8/month) for reserved domain

---

## ⚠️ Important Notes

### Keep Running 24/7
- ⚠️ Your PC must stay on for production emails
- ⚠️ ngrok must stay connected
- ⚠️ Relay server must keep running

### ngrok Free Plan Limitations
- Random URL (changes on restart)
- 1 tunnel at a time
- 40 connections/minute
- Version 3.18.x stops working **Dec 17, 2025** (update to 3.24.0+)

### Update ngrok (Recommended)
```bash
# Check version
ngrok version

# Update to latest
ngrok update

# Or press Ctrl-U in ngrok terminal
```

---

## 📊 Email Provider Priority

Backend automatically tries providers in order:

| Priority | Provider | Environment | Status |
|----------|----------|-------------|--------|
| 1 | SMTP Relay | Railway Production | ✅ Ready |
| 5 | SendGrid API | Any (Cloud) | ⏸️ TODO |
| 10 | Direct SMTP | Local Dev Only | ✅ Ready |

If SMTP Relay fails → falls back to SendGrid → falls back to Direct SMTP

---

## 📚 Full Documentation

- **Complete Guide**: [docs/NGROK_SMTP_SETUP_GUIDE.md](../docs/NGROK_SMTP_SETUP_GUIDE.md)
- **Relay Server**: [smtp-relay-server/README.md](../smtp-relay-server/README.md)
- **Backend Changes**: [src/modules/notifications/services/email.service.ts](../src/modules/notifications/services/email.service.ts)

---

## ✅ Quick Checklist

Before deploying to Railway:

- [ ] Relay server running (`npm start`)
- [ ] ngrok tunnel active (`ngrok http 2525 --region ap`)
- [ ] ngrok URL copied
- [ ] Railway env vars updated:
  - [ ] `SMTP_RELAY_ENABLED=true`
  - [ ] `SMTP_RELAY_URL=<your-ngrok-url>`
- [ ] Code committed and pushed
- [ ] Railway deployment successful
- [ ] Test email sent successfully

---

## 💡 Pro Tips

### Auto-start on PC Boot
Create Windows Task Scheduler task to run `start-smtp-relay.bat` on login

### Monitor Uptime
Use free service like UptimeRobot to monitor relay: http://localhost:2525/health

### Upgrade Path
1. **Now**: ngrok Free + Gmail (works but requires PC on)
2. **Next 2 weeks**: Implement SendGrid API (no tunnel needed)
3. **Future**: ngrok Personal ($8/month) for stable URL

---

**Status**: Production Ready ✅  
**Created**: November 23, 2025  
**ngrok Account**: Jhon Keneth Namias (Free Plan)  
**ngrok Version**: 3.24.0-msix (update available: 3.33.0)
