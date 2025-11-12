@echo off
REM ============================================================================
REM MASH Backend - Full Stack Startup Script (Windows)
REM ============================================================================
REM This script starts:
REM - PostgreSQL (Docker)
REM - Redis (Docker)
REM - MQTT Broker (Docker)
REM - NestJS Backend
REM ============================================================================

echo.
echo ================================================
echo   MASH Backend - Starting Full Development Stack
echo ================================================
echo.

REM Change to script directory
cd /d "%~dp0"

REM Check if Docker is running
docker version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo [INFO] Please start Docker Desktop and try again
    echo.
    pause
    exit /b 1
)
echo [OK] Docker is running

REM Check if .env exists
if not exist .env (
    echo [ERROR] .env file not found!
    echo [INFO] Please copy .env.example to .env and configure it
    echo.
    pause
    exit /b 1
)
echo [OK] .env file found
echo.

REM Start Docker services
echo ================================================
echo   Step 1: Starting Docker Services
echo ================================================
echo [INFO] Starting PostgreSQL, Redis, and MQTT...
echo.

docker compose -f docker-compose.dev.yml up -d postgres redis mqtt
if errorlevel 1 (
    echo [ERROR] Failed to start Docker services
    pause
    exit /b 1
)

echo.
echo [OK] Docker services started:
docker compose -f docker-compose.dev.yml ps
echo.

REM Wait for PostgreSQL to be ready
echo [INFO] Waiting for PostgreSQL to be ready...
timeout /t 5 /nobreak >nul
echo [OK] PostgreSQL should be ready
echo.

REM Check if node_modules exists
if not exist node_modules (
    echo ================================================
    echo   Step 2: Installing Dependencies
    echo ================================================
    echo [INFO] This may take a few minutes...
    echo.
    call npm install --legacy-peer-deps
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
)

REM Generate Prisma Client
echo ================================================
echo   Step 3: Setting Up Database
echo ================================================
echo [INFO] Generating Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Failed to generate Prisma Client
    pause
    exit /b 1
)
echo.

REM Run migrations
echo [INFO] Running database migrations...
call npx prisma migrate deploy
if errorlevel 1 (
    echo [WARNING] Migration failed (this is OK for first run)
    echo [INFO] You may need to run: npx prisma migrate dev
)
echo.

REM Build application
echo ================================================
echo   Step 4: Building Application
echo ================================================
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo.

REM Start backend server
echo ================================================
echo   Step 5: Starting Backend Server
echo ================================================
echo.
echo [INFO] Full stack is ready!
echo.
echo   - Backend API: http://localhost:3000
echo   - API Docs: http://localhost:3000/api
echo   - Metrics: http://localhost:3000/metrics
echo   - PostgreSQL: localhost:5432
echo   - Redis: localhost:6379
echo   - MQTT: localhost:1883
echo.
echo [INFO] Press Ctrl+C to stop the server
echo [INFO] To stop all services: docker compose -f docker-compose.dev.yml down
echo.

call npm run start:dev
