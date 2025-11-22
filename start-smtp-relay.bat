@echo off
REM ============================================================================
REM MASH SMTP Relay - Quick Start Script (Windows)
REM ============================================================================
REM This script starts both the SMTP relay server and ngrok tunnel
REM ============================================================================

echo.
echo ================================
echo MASH SMTP Relay - Quick Start
echo ================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org
    pause
    exit /b 1
)

REM Check if ngrok is installed
where ngrok >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] ngrok is not installed!
    echo Please install ngrok from: https://ngrok.com/download
    pause
    exit /b 1
)

REM Navigate to smtp-relay-server directory
cd smtp-relay-server

REM Check if dependencies are installed
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
)

REM Start SMTP relay server in new window
echo [INFO] Starting SMTP relay server on port 2525...
start "MASH SMTP Relay" cmd /k "npm start"

REM Wait for server to start
timeout /t 3 /nobreak >nul

REM Start ngrok tunnel in new window
echo [INFO] Starting ngrok tunnel (Asia Pacific region)...
start "ngrok Tunnel" cmd /k "ngrok http 2525 --region ap"

echo.
echo ================================
echo ✅ SMTP Relay Started!
echo ================================
echo.
echo 📍 SMTP Relay: http://localhost:2525
echo 🌐 ngrok Dashboard: http://127.0.0.1:4040
echo.
echo Next Steps:
echo 1. Wait 5 seconds for ngrok to start
echo 2. Visit http://127.0.0.1:4040 to get your ngrok URL
echo 3. Copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)
echo 4. Update Railway env var: SMTP_RELAY_URL=^<your-ngrok-url^>
echo 5. Deploy backend to Railway
echo.
echo Press any key to open ngrok dashboard...
pause >nul
start http://127.0.0.1:4040

echo.
echo ================================
echo Keep both windows open!
echo ================================
echo.
pause
