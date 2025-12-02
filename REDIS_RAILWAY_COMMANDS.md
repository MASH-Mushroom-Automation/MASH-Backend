# Redis Railway - Command Reference Card

Quick command reference for managing Redis on Railway.

---

## 🎯 Railway CLI Commands

### Setup & Configuration
```bash
# Install Railway CLI (one-time)
npm install -g @railway/cli

# Login to Railway
railway login

# Link to project
cd "C:\Users\Kenneth\Desktop\PP Namias\MASH-Backend"
railway link

# Add Redis plugin
railway add redis

# Check project status
railway status
```

### Environment Variables
```bash
# List all Redis variables
railway variables --service redis

# List backend variables
railway variables --service backend

# Set Redis URL for backend
railway variables set REDIS_URL="redis://default:password@redis.railway.internal:6379" --service backend

# Get specific variable
railway variables get REDIS_URL --service backend
```

### Deployment & Logs
```bash
# Deploy backend manually (usually auto-deploys)
railway up --service backend

# View backend logs (live tail)
railway logs --service backend --tail

# View Redis logs
railway logs --service redis --tail

# View last 100 lines
railway logs --service backend --lines 100

# Filter logs
railway logs --service backend | findstr "redis\|Redis\|error"
```

### Service Management
```bash
# Restart backend service
railway restart --service backend

# Restart Redis service
railway restart --service redis

# Check metrics
railway metrics --service redis
railway metrics --service backend

# Open Railway dashboard
railway open
```

---

## 🔧 Redis CLI Commands

### Connect to Railway Redis
```bash
# Via Railway CLI
railway run --service redis redis-cli

# Via direct connection (if using public URL)
redis-cli -h your-redis-host -p port -a password
```

### Basic Redis Commands
```bash
# Test connection
PING
# Returns: PONG

# Set key-value
SET mykey "Hello Railway"
# Returns: OK

# Get value
GET mykey
# Returns: "Hello Railway"

# Check if key exists
EXISTS mykey
# Returns: (integer) 1

# Delete key
DEL mykey
# Returns: (integer) 1

# List all keys (be careful in production!)
KEYS *

# Get Redis info
INFO
INFO memory
INFO stats

# Check memory usage
MEMORY USAGE mykey

# Exit Redis CLI
EXIT
```

### Monitoring Commands
```bash
# Monitor all commands in real-time
MONITOR

# Get server statistics
INFO stats

# Check connected clients
CLIENT LIST

# Get slow log
SLOWLOG GET 10

# Check memory
INFO memory
```

---

## 🐛 Debugging Commands

### Check Redis Connection
```bash
# From Railway logs
railway logs --service backend | findstr "redis\|Redis"

# Test health endpoint
curl https://mash-backend-api-production.up.railway.app/health

# Check if Redis is running
railway status --service redis
```

### Diagnose Connection Issues
```bash
# Check Redis service logs
railway logs --service redis --tail

# Check backend environment variables
railway variables --service backend | findstr REDIS

# Test Redis connection directly
railway run --service redis redis-cli PING

# Check network connectivity
railway run --service backend curl redis.railway.internal:6379
```

### Check Queue Status
```bash
# View queue-related logs
railway logs --service backend | findstr -i "queue\|bull\|job"

# Check for errors
railway logs --service backend | findstr -i "error\|failed\|timeout"

# Monitor in real-time
railway logs --service backend --tail | findstr -i "queue"
```

---

## 📊 Monitoring Commands

### Check Performance
```bash
# Redis memory usage
railway run --service redis redis-cli INFO memory

# Redis stats
railway run --service redis redis-cli INFO stats

# Check connected clients
railway run --service redis redis-cli CLIENT LIST

# Monitor latency
railway run --service redis redis-cli --latency
```

### Check Queue Health
```bash
# View all keys (careful in production!)
railway run --service redis redis-cli KEYS "bull:*"

# Count keys by pattern
railway run --service redis redis-cli KEYS "bull:email-notifications:*" | wc -l

# Get queue info
railway run --service redis redis-cli HGETALL "bull:email-notifications:meta"
```

---

## 🔄 Maintenance Commands

### Clear Cache (if needed)
```bash
# Connect to Redis
railway run --service redis redis-cli

# Delete all cache keys (be careful!)
FLUSHDB

# Delete specific pattern
EVAL "return redis.call('del', unpack(redis.call('keys', 'cache:*')))" 0

# Exit
EXIT
```

### Backup & Restore
```bash
# Trigger Redis save
railway run --service redis redis-cli BGSAVE

# Check last save time
railway run --service redis redis-cli LASTSAVE

# Note: Railway handles backups automatically
```

### Reset Queue (if stuck)
```bash
# Connect to Redis
railway run --service redis redis-cli

# Remove all jobs from a queue
DEL bull:email-notifications:wait
DEL bull:email-notifications:active
DEL bull:email-notifications:completed
DEL bull:email-notifications:failed

# Exit
EXIT

# Restart backend to reinitialize
railway restart --service backend
```

---

## 🚀 Quick Actions

### Deploy New Version
```bash
# If using Railway CLI
cd "C:\Users\Kenneth\Desktop\PP Namias\MASH-Backend"
railway up --service backend

# Railway auto-deploys on git push to main branch
git push origin main
```

### Rollback Deployment
```bash
# Via Railway CLI
railway rollback --service backend

# Via Dashboard:
# 1. Go to Backend service
# 2. Click "Deployments"
# 3. Click "..." on previous deployment
# 4. Click "Redeploy"
```

### Emergency Restart
```bash
# Restart all services
railway restart --service backend
railway restart --service redis

# Or via Dashboard:
# Click service → Settings → Restart
```

---

## 📱 Quick Tests

### Test Backend Health
```bash
curl https://mash-backend-api-production.up.railway.app/health
```

### Test Redis Connection
```bash
railway run --service redis redis-cli PING
```

### Test Lalamove City Info (No Auth)
```bash
curl https://mash-backend-api-production.up.railway.app/api/v1/lalamove/city-info
```

### Test with Auth
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://mash-backend-api-production.up.railway.app/api/v1/lalamove/quotations
```

---

## 🔐 Security Commands

### Check Environment Variables (Sensitive)
```bash
# List all variables (careful - contains secrets!)
railway variables --service backend

# Get specific non-sensitive variable
railway variables get NODE_ENV --service backend
```

### Rotate Redis Password (if needed)
```bash
# 1. Generate new Redis instance
railway add redis

# 2. Update REDIS_URL in backend
railway variables set REDIS_URL="new_redis_url" --service backend

# 3. Delete old Redis instance
# Via Dashboard: Redis service → Settings → Delete
```

---

## 📝 Common Workflows

### After Code Changes
```bash
# 1. Commit changes
git add .
git commit -m "Your changes"

# 2. Push to trigger deployment
git push origin main

# 3. Watch deployment
railway logs --service backend --tail

# 4. Test deployment
curl https://mash-backend-api-production.up.railway.app/health
```

### When Debugging Issues
```bash
# 1. Check service status
railway status

# 2. View recent logs
railway logs --service backend --lines 100

# 3. Check Redis connection
railway run --service redis redis-cli PING

# 4. Restart if needed
railway restart --service backend

# 5. Monitor logs
railway logs --service backend --tail
```

### When Testing Locally
```bash
# 1. Use local Redis or Railway public URL in .env
REDIS_URL=redis://localhost:6379

# 2. Start local Redis (if using local)
redis-server

# 3. Build and start backend
npm run build
npm run start:dev

# 4. Test endpoints
curl http://localhost:3000/health
```

---

## 🆘 Emergency Commands

### Backend Not Responding
```bash
railway restart --service backend
railway logs --service backend --tail
```

### Redis Connection Issues
```bash
railway restart --service redis
railway logs --service redis --tail
railway run --service redis redis-cli PING
```

### High Memory Usage
```bash
# Check Redis memory
railway run --service redis redis-cli INFO memory

# Clear cache if needed
railway run --service redis redis-cli FLUSHDB

# Check backend memory
railway metrics --service backend
```

### Queues Stuck
```bash
# View queue status
railway logs --service backend | findstr -i "queue"

# Restart backend
railway restart --service backend

# Check Redis for stuck jobs
railway run --service redis redis-cli KEYS "bull:*:active"
```

---

## 📚 Helpful Links

- **Railway Docs**: https://docs.railway.app
- **Railway Redis**: https://docs.railway.app/databases/redis
- **Railway CLI**: https://docs.railway.app/develop/cli
- **Redis Commands**: https://redis.io/commands
- **Railway Discord**: https://discord.gg/railway

---

**💡 Pro Tip**: Save commonly used commands as shell aliases or scripts!

**Example** (PowerShell profile):
```powershell
function rail-logs { railway logs --service backend --tail }
function rail-restart { railway restart --service backend }
function rail-status { railway status }
function rail-redis { railway run --service redis redis-cli }
```

Add to: `$PROFILE` (open with `notepad $PROFILE`)
