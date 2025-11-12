@echo off
REM ============================================================================
REM MASH Backend - Quick Start Script (Windows)
REM ============================================================================
REM Double-click this file to start the backend in development mode
REM ============================================================================

echo.
echo ========================================
echo   MASH Backend - Starting Development
echo ========================================
echo.

REM Change to script directory
cd /d "%~dp0"

REM Check if .env exists
if not exist .env (
    echo [ERROR] .env file not found!
    echo [INFO] Please copy .env.example to .env and configure it
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist node_modules (
    echo [SETUP] node_modules not found. Installing dependencies...
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
echo [SETUP] Generating Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Failed to generate Prisma Client
    pause
    exit /b 1
)
echo.

REM Build the application
echo [BUILD] Building NestJS application...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo.

REM Start development server
echo ========================================
echo   Starting Backend Server
echo ========================================
echo.
echo [INFO] Server will start at http://localhost:3000
echo [INFO] API Docs at http://localhost:3000/api
echo [INFO] Press Ctrl+C to stop the server
echo.

call npm run start:dev
