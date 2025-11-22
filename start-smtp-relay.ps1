# ============================================================================
# MASH SMTP Relay - Quick Start Script (PowerShell)
# ============================================================================
# This script starts both the SMTP relay server and ngrok tunnel
# ============================================================================

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "MASH SMTP Relay - Quick Start" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if ngrok is installed
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] ngrok is not installed!" -ForegroundColor Red
    Write-Host "Please install ngrok from: https://ngrok.com/download" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Navigate to smtp-relay-server directory
Set-Location smtp-relay-server

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install dependencies!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Start SMTP relay server in new window
Write-Host "[INFO] Starting SMTP relay server on port 2525..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm start" -WindowStyle Normal

# Wait for server to start
Start-Sleep -Seconds 3

# Start ngrok tunnel in new window
Write-Host "[INFO] Starting ngrok tunnel (Asia Pacific region)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http 2525 --region ap" -WindowStyle Normal

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✅ SMTP Relay Started!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 SMTP Relay: http://localhost:2525" -ForegroundColor White
Write-Host "🌐 ngrok Dashboard: http://127.0.0.1:4040" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Wait 5 seconds for ngrok to start"
Write-Host "2. Visit http://127.0.0.1:4040 to get your ngrok URL"
Write-Host "3. Copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)"
Write-Host "4. Update Railway env var: SMTP_RELAY_URL=<your-ngrok-url>"
Write-Host "5. Deploy backend to Railway"
Write-Host ""
Write-Host "Opening ngrok dashboard in 5 seconds..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
Start-Process "http://127.0.0.1:4040"

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Keep both windows open!" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit (relay and ngrok will keep running)"
