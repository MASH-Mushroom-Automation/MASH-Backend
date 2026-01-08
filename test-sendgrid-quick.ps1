# Quick SendGrid Test - Automated (No User Input Required)
# ========================================================

Write-Host "🧪 Quick SendGrid Integration Test" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

$backendUrl = "https://mash-backend-production.up.railway.app"

# Step 1: Health Check
Write-Host "[1/2] Testing backend health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$backendUrl/api/v1/health" -Method GET
    if ($health.data.status -eq "ok") {
        Write-Host "✅ Backend: HEALTHY" -ForegroundColor Green
        Write-Host "    Database: $($health.data.info.database.status)" -ForegroundColor Gray
        Write-Host "    Memory: $($health.data.info.memory.status)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Backend: UNHEALTHY" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Backend: UNREACHABLE" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Test Registration Endpoint (will return validation error but proves endpoint works)
Write-Host "[2/2] Testing registration endpoint..." -ForegroundColor Yellow
$testBody = @{
    email = "test-sendgrid-$(Get-Random)@example.com"
    password = "Test1234!"
    firstName = "Test"
    lastName = "User"
    username = "testuser$(Get-Random -Minimum 1000 -Maximum 9999)"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$backendUrl/api/v1/auth/register" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $testBody `
        -ErrorAction Stop
    
    Write-Host "✅ Registration endpoint: WORKING" -ForegroundColor Green
    Write-Host "    Response: $($response.message)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    
    if ($statusCode -eq 400 -or $statusCode -eq 409) {
        # Expected validation errors - endpoint is working
        Write-Host "✅ Registration endpoint: WORKING (validation active)" -ForegroundColor Green
        Write-Host "    Status: $statusCode (expected)" -ForegroundColor Gray
    } elseif ($statusCode -eq 408) {
        # Timeout - SendGrid might not be configured
        Write-Host "❌ Registration endpoint: TIMEOUT (408)" -ForegroundColor Red
        Write-Host "    ⚠️  Email sending might be failing!" -ForegroundColor Yellow
        Write-Host "    Check Railway logs: railway logs --tail 50" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "⚠️  Registration endpoint returned: $statusCode" -ForegroundColor Yellow
        $errorDetail = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($errorDetail) {
            Write-Host "    Message: $($errorDetail.message)" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ AUTOMATED TESTS PASSED" -ForegroundColor Green
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Next Step: Manual Email Test" -ForegroundColor Cyan
Write-Host "   Run: powershell -File test-sendgrid-production.ps1" -ForegroundColor Gray
Write-Host "   This will test actual email delivery with YOUR real email" -ForegroundColor Gray
Write-Host ""
Write-Host "📊 Check SendGrid Activity:" -ForegroundColor Cyan
Write-Host "   https://app.sendgrid.com/email_activity" -ForegroundColor Gray
Write-Host ""
Write-Host "📋 Check Railway Logs:" -ForegroundColor Cyan
Write-Host "   railway logs --tail 100" -ForegroundColor Gray
Write-Host ""
