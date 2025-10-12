@echo off
REM ========================================
REM MASH Backend - Load Testing Execution Script
REM ========================================
REM
REM This script runs all k6 load tests in sequence
REM Total execution time: ~50 minutes
REM
REM Requirements:
REM   - k6 installed (run: winget install k6)
REM   - Backend running (http://localhost:3000)
REM   - Test data seeded (buyers, growers, products, orders)
REM
REM ========================================

echo.
echo ========================================
echo MASH Backend Load Testing Suite
echo ========================================
echo.
echo Total Duration: ~50 minutes
echo Tests: Smoke, Load, Stress
echo.

REM Check if k6 is installed
where k6 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] k6 is not installed!
    echo Install with: winget install k6
    exit /b 1
)

echo [OK] k6 is installed
echo.

REM Check if backend is running
echo Checking if backend is running...
curl -s http://localhost:3000/health >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Backend may not be running on http://localhost:3000
    echo Please start with: npm run start:dev
    echo.
    echo Continue anyway? (Y/N)
    set /p continue=
    if /i not "%continue%"=="Y" (
        exit /b 1
    )
) else (
    echo [OK] Backend is running
)

echo.
echo ========================================
echo Starting Test Suite
echo ========================================
echo.

REM Create results directory
if not exist "test\k6\results" mkdir "test\k6\results"

REM Test 1: Smoke Test
echo ========================================
echo Test 1/3: Smoke Test
echo ========================================
echo Duration: 5 minutes
echo VUs: 1-10
echo Purpose: Quick validation
echo.
echo Starting in 5 seconds...
timeout /t 5 /nobreak >nul
k6 run test\k6\scenarios\smoke.js --out json=test\k6\results\smoke-results.json
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Smoke test failed!
    echo Check logs for details.
    pause
    exit /b 1
)
echo.
echo [OK] Smoke test passed!
echo.
timeout /t 10 /nobreak >nul

REM Test 2: Load Test
echo ========================================
echo Test 2/3: Load Test
echo ========================================
echo Duration: 20 minutes
echo VUs: 1-300
echo Purpose: Production load simulation
echo.
echo Starting in 5 seconds...
timeout /t 5 /nobreak >nul
k6 run test\k6\scenarios\load.js --out json=test\k6\results\load-results.json
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Load test failed!
    echo This may indicate performance issues.
    echo Check Grafana dashboards for details.
    pause
)
echo.
echo [OK] Load test completed!
echo.
timeout /t 10 /nobreak >nul

REM Test 3: Stress Test
echo ========================================
echo Test 3/3: Stress Test
echo ========================================
echo Duration: 25 minutes
echo VUs: 1-1500
echo Purpose: Find breaking point
echo.
echo Starting in 5 seconds...
timeout /t 5 /nobreak >nul
k6 run test\k6\scenarios\stress.js --out json=test\k6\results\stress-results.json
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Stress test failed!
    echo This is expected as we're testing breaking points.
    echo Check results to identify the failure threshold.
    pause
)
echo.
echo [OK] Stress test completed!
echo.

REM Summary
echo ========================================
echo Test Suite Complete!
echo ========================================
echo.
echo Results saved to: test\k6\results\
echo   - smoke-results.json
echo   - load-results.json
echo   - stress-results.json
echo.
echo Next Steps:
echo   1. Open Grafana: http://localhost:3001
echo   2. Review dashboards:
echo      - API Performance Dashboard
echo      - Database Performance Dashboard
echo      - Trace Analytics Dashboard
echo   3. Analyze results in JSON files
echo   4. Compare against thresholds:
echo      - P95 latency ^<200ms
echo      - Error rate ^<1%%
echo      - Cache hit rate ^>80%%
echo.
echo ========================================

pause
