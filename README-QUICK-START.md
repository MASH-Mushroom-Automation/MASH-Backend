# 🚀 MASH Backend - Quick Start Guide

## One-Click Startup Scripts (Windows)

This project includes convenient startup scripts for Windows users. Just double-click to run!

---

## 📦 Available Scripts

### 1. **start-dev.bat** (Recommended for Beginners)
**Double-click to run the backend only**

✅ **Use this when:**
- You already have PostgreSQL/Redis running elsewhere
- You want to run only the NestJS backend
- You're developing and just need the API server

🔧 **What it does:**
1. ✓ Checks if `.env` file exists
2. ✓ Installs dependencies (if needed)
3. ✓ Generates Prisma Client
4. ✓ Builds the application
5. ✓ Starts development server at `http://localhost:3000`

---

### 2. **start-full-stack.bat** (Complete Solution)
**Double-click to run everything (Docker + Backend)**

✅ **Use this when:**
- You want a complete local development environment
- You need PostgreSQL, Redis, and MQTT running
- This is your first time running the project

🔧 **What it does:**
1. ✓ Checks if Docker is running
2. ✓ Starts PostgreSQL (port 5432)
3. ✓ Starts Redis (port 6379)
4. ✓ Starts MQTT Broker (port 1883)
5. ✓ Installs dependencies (if needed)
6. ✓ Generates Prisma Client
7. ✓ Runs database migrations
8. ✓ Builds and starts backend server

**Requirements:**
- Docker Desktop must be installed and running

---

### 3. **start-dev.ps1** (PowerShell Version)
**Advanced users - Better error messages and colored output**

Right-click → "Run with PowerShell"

Same as `start-dev.bat` but with:
- ✨ Color-coded output
- ✨ Better error messages
- ✨ Progress indicators

---

### 4. **stop-all.bat**
**Double-click to stop all Docker services**

Cleanly stops PostgreSQL, Redis, and MQTT containers.

---

## 🎯 First Time Setup

### Step 1: Prerequisites
```bash
✓ Node.js 18+ installed
✓ Docker Desktop (for full-stack mode)
✓ Git (already have this)
```

### Step 2: Configure Environment
1. Copy `.env.example` to `.env`:
   ```cmd
   copy .env.example .env
   ```
2. Edit `.env` and fill in required values (database connection, JWT secret, etc.)

### Step 3: Choose Your Startup Mode

**Option A: Backend Only**
- Double-click `start-dev.bat`
- Wait for "Nest application successfully started" message
- Open http://localhost:3000/api

**Option B: Full Stack (Recommended)**
- Start Docker Desktop
- Double-click `start-full-stack.bat`
- Wait for everything to start (~2-3 minutes first time)
- Open http://localhost:3000/api

---

## 🌐 Access Points

After startup, you can access:

| Service | URL | Description |
|---------|-----|-------------|
| **API Server** | http://localhost:3000 | Main backend API |
| **Swagger Docs** | http://localhost:3000/api | Interactive API documentation |
| **Metrics** | http://localhost:3000/metrics | Prometheus metrics |
| **Health Check** | http://localhost:3000/health | System health status |
| **PostgreSQL** | localhost:5432 | Database (use Prisma Studio) |
| **Redis** | localhost:6379 | Cache server |
| **MQTT Broker** | localhost:1883 | IoT messaging |

---

## 🔧 Troubleshooting

### ❌ "Docker is not running"
**Solution:** Start Docker Desktop and wait for it to fully initialize (green icon in system tray)

### ❌ ".env file not found"
**Solution:** Copy `.env.example` to `.env`:
```cmd
copy .env.example .env
```

### ❌ "Port 3000 is already in use"
**Solution:** Kill the process using port 3000:
```cmd
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### ❌ "Cannot find module" errors
**Solution:** Clean install dependencies:
```cmd
rmdir /s /q node_modules
del package-lock.json
npm install --legacy-peer-deps
npx prisma generate
```

### ❌ "Prisma Client not found"
**Solution:** Regenerate Prisma Client:
```cmd
npx prisma generate
```

### ❌ Database connection errors
**Solution:** 
1. Check if PostgreSQL is running (full-stack mode)
2. Verify `.env` has correct `DATABASE_URL`
3. Run migrations: `npx prisma migrate dev`

---

## 🛑 Stopping the Server

**Backend Only:**
- Press `Ctrl+C` in the terminal window

**Full Stack:**
- Press `Ctrl+C` to stop backend
- Double-click `stop-all.bat` to stop Docker services

**Or manually:**
```cmd
docker compose -f docker-compose.dev.yml down
```

---

## 📱 Testing the API

### Option 1: Swagger UI (Easiest)
1. Open http://localhost:3000/api
2. Click "Authorize" and enter credentials
3. Try any endpoint

### Option 2: Postman
1. Import collections from `/postman` folder
2. Set environment variable: `baseUrl = http://localhost:3000`
3. Run requests

### Option 3: curl
```bash
# Health check
curl http://localhost:3000/health

# Register user
curl -X POST http://localhost:3000/api/v1/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"Test123!@#\",\"firstName\":\"Test\",\"lastName\":\"User\"}"
```

---

## 🔄 Daily Development Workflow

1. **Start Development:**
   - Double-click `start-full-stack.bat` (first time each day)
   - Or `start-dev.bat` if Docker services already running

2. **Make Changes:**
   - Edit code in `src/`
   - Server automatically rebuilds (watch mode)
   - Refresh browser to see changes

3. **Database Changes:**
   ```cmd
   npx prisma migrate dev --name my_change
   npx prisma generate
   ```

4. **End of Day:**
   - Press `Ctrl+C` to stop server
   - Double-click `stop-all.bat` to stop Docker

---

## 💡 Pro Tips

1. **Keep Docker Running:** If you're actively developing, keep Docker services running all day and just use `start-dev.bat`

2. **Prisma Studio:** Visualize your database
   ```cmd
   npx prisma studio
   ```
   Opens at http://localhost:5555

3. **Watch Logs:** Backend logs appear in the terminal window. Look for errors here first.

4. **Hot Reload:** The dev server watches for file changes. Save a file and it rebuilds automatically!

5. **Clean Build:** If things get weird:
   ```cmd
   rmdir /s /q dist
   npm run build
   ```

---

## 📚 Additional Resources

- **Main README:** [README.md](README.md)
- **API Specification:** [API_SPECIFICATION.md](API_SPECIFICATION.md)
- **Deployment Guide:** [docs/DEPLOYMENT_QUICK_GUIDE.md](docs/DEPLOYMENT_QUICK_GUIDE.md)
- **Email Setup:** [docs/NGROK_SMTP_SETUP_GUIDE.md](docs/NGROK_SMTP_SETUP_GUIDE.md)

---

## 🆘 Need Help?

1. Check the troubleshooting section above
2. Review error messages in terminal
3. Check Docker Desktop if using full-stack mode
4. Verify `.env` configuration
5. Try a clean install (see troubleshooting)

**Common Issues:** Most problems are solved by:
- Ensuring `.env` file exists and is configured
- Running `npx prisma generate` after schema changes
- Restarting Docker Desktop
- Clean install of dependencies

---

**Happy Coding! 🍄🚀**
