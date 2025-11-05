# ============================================================================
# Quick NestJS Backend Verification
# ============================================================================
# Purpose: Verify that MASH backend builds and runs correctly
# Usage: .\scripts\quick-verify.ps1
# ============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " NESTJS BACKEND VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# STEP 1: Check environment
Write-Host "Step 1: Checking Environment..." -ForegroundColor Magenta
$nodeVersion = node --version
$npmVersion = npm --version
Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green
Write-Host "  npm: $npmVersion" -ForegroundColor Green
Write-Host ""

# STEP 2: Check .env file
Write-Host "Step 2: Checking Configuration..." -ForegroundColor Magenta
if (Test-Path ".env") {
    Write-Host "  .env file exists" -ForegroundColor Green
    $envContent = Get-Content ".env"
    $requiredVars = @("DATABASE_URL", "JWT_SECRET", "NODE_ENV")
    foreach ($var in $requiredVars) {
        $found = $envContent | Where-Object { $_ -match "^$var=" }
        if ($found) {
            Write-Host "    $var is set" -ForegroundColor Green
        } else {
            Write-Host "    $var is MISSING" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  .env file NOT FOUND" -ForegroundColor Red
}
Write-Host ""

# STEP 3: Check Prisma client
Write-Host "Step 3: Checking Prisma Client..." -ForegroundColor Magenta
if (Test-Path "node_modules\.prisma\client") {
    Write-Host "  Prisma client is generated" -ForegroundColor Green
} else {
    Write-Host "  Prisma client NOT generated - run: npx prisma generate" -ForegroundColor Yellow
}
Write-Host ""

# STEP 4: Clean and build
Write-Host "Step 4: Building Application..." -ForegroundColor Magenta
Write-Host "  Cleaning previous build..." -ForegroundColor Cyan
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Force tsconfig.build.tsbuildinfo -ErrorAction SilentlyContinue

Write-Host "  Running build (20-30 seconds)..." -ForegroundColor Cyan
npm run build 2>&1 | Out-Null

Start-Sleep -Seconds 5

if (Test-Path "dist\main.js") {
    Write-Host "  BUILD SUCCESS!" -ForegroundColor Green
    $fileCount = (Get-ChildItem dist -Recurse -File).Count
    $mainSize = [math]::Round((Get-Item dist\main.js).Length/1KB,1)
    Write-Host "    Files generated: $fileCount" -ForegroundColor Green
    Write-Host "    main.js size: $mainSize KB" -ForegroundColor Green
} else {
    Write-Host "  BUILD FAILED - dist\main.js not found" -ForegroundColor Red
    Write-Host "  Try running: npm run build" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# STEP 5: Check if port is available
Write-Host "Step 5: Checking Port 3000..." -ForegroundColor Magenta
$portInUse = netstat -ano | findstr ":3000 "
if ($portInUse) {
    Write-Host "  Port 3000 is IN USE" -ForegroundColor Yellow
    Write-Host "  Kill process using port 3000 first" -ForegroundColor Yellow
    Write-Host "  Or run: Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process" -ForegroundColor Yellow
} else {
    Write-Host "  Port 3000 is available" -ForegroundColor Green
}
Write-Host ""

# STEP 6: Start server
Write-Host "Step 6: Starting Server..." -ForegroundColor Magenta
Write-Host "  Starting NestJS in production mode..." -ForegroundColor Cyan

$job = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    npm run start:prod 2>&1
} -ArgumentList (Get-Location).Path

Write-Host "  Waiting 25 seconds for startup..." -ForegroundColor Cyan
Start-Sleep -Seconds 25

# STEP 7: Test health endpoint
Write-Host "Step 7: Testing Health Endpoint..." -ForegroundColor Magenta
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/health" -Method Get -TimeoutSec 10
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host " SERVER IS RUNNING AND HEALTHY!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Health Check Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json | Write-Host
    Write-Host ""
    Write-Host "Server Endpoints:" -ForegroundColor Cyan
    Write-Host "  Server URL: http://localhost:3000" -ForegroundColor White
    Write-Host "  API Docs: http://localhost:3000/api/docs" -ForegroundColor White
    Write-Host "  Metrics: http://localhost:3000/metrics" -ForegroundColor White
    Write-Host "  Health: http://localhost:3000/api/v1/health" -ForegroundColor White
    Write-Host ""
    Write-Host "VERIFICATION PASSED!" -ForegroundColor Green
    $verificationPassed = $true
} catch {
    Write-Host "  Server health check FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Yellow
    $verificationPassed = $false
}

# Cleanup
Write-Host ""
Write-Host "Stopping test server..." -ForegroundColor Cyan
Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -Force -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Test server stopped" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($verificationPassed) {
    Write-Host " FINAL RESULT: ALL CHECKS PASSED" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  npm run start:dev  - Start development server" -ForegroundColor White
    Write-Host "  npm run start:prod - Start production server" -ForegroundColor White
} else {
    Write-Host " FINAL RESULT: SOME CHECKS FAILED" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Check the errors above and:" -ForegroundColor Yellow
    Write-Host "  1. Review docs/BUILD_TROUBLESHOOTING.md" -ForegroundColor White
    Write-Host "  2. Check database connection in .env" -ForegroundColor White
    Write-Host "  3. Run: npx prisma migrate deploy" -ForegroundColor White
}
Write-Host ""
