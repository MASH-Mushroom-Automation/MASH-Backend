@echo off
REM ============================================================================
REM MASH Backend - Stop All Services Script (Windows)
REM ============================================================================
REM This script stops all running Docker services
REM ============================================================================

echo.
echo ========================================
echo   MASH Backend - Stopping All Services
echo ========================================
echo.

cd /d "%~dp0"

REM Stop Docker services
echo [INFO] Stopping Docker services...
docker compose -f docker-compose.dev.yml down

if errorlevel 1 (
    echo [ERROR] Failed to stop Docker services
    pause
    exit /b 1
)

echo.
echo [OK] All services stopped
echo.
pause
