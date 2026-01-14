# MASH Backend - SendGrid Production Testing Script
# ===================================================
# This script tests the complete email verification flow after SendGrid integration

Write-Host "🧪 MASH Backend - SendGrid Production Testing" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$backendUrl = "https://mash-backend-production.up.railway.app"
$testEmail = Read-Host "Enter YOUR real email address (to receive verification code)"

if (-not $testEmail -or $testEmail -notmatch '@') {
    Write-Host "❌ Invalid email address" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📧 Test Email: $testEmail" -ForegroundColor Yellow
Write-Host "🌐 Backend URL: $backendUrl" -ForegroundColor Yellow
Write-Host ""

# Step 1: Health Check
Write-Host "Step 1/5: Checking backend health..." -ForegroundColor Cyan
try {
    $healthResponse = Invoke-RestMethod -Uri "$backendUrl/api/v1/health" -Method GET
    Write-Host "✅ Backend is healthy" -ForegroundColor Green
    Write-Host "   Database: $($healthResponse.info.database.status)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Backend health check failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Register User
Write-Host "Step 2/5: Registering new user..." -ForegroundColor Cyan
$randomUsername = "testuser$(Get-Random -Minimum 1000 -Maximum 9999)"
$registerBody = @{
    email = $testEmail
    password = "Test1234!"
    firstName = "Test"
    lastName = "User"
    username = $randomUsername
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod `
        -Uri "$backendUrl/api/v1/auth/register" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $registerBody
    
    Write-Host "✅ Registration successful!" -ForegroundColor Green
    Write-Host "   User ID: $($registerResponse.user.id)" -ForegroundColor Gray
    Write-Host "   Email: $($registerResponse.user.email)" -ForegroundColor Gray
    Write-Host "   Message: $($registerResponse.message)" -ForegroundColor Gray
} catch {
    $errorDetail = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorDetail) {
        Write-Host "❌ Registration failed!" -ForegroundColor Red
        Write-Host "   Error: $($errorDetail.message)" -ForegroundColor Red
    } else {
        Write-Host "❌ Registration failed!" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "📨 Check your email inbox for verification code!" -ForegroundColor Yellow
Write-Host "   From: noreply@mash-ecommerce-web-production.up.railway.app" -ForegroundColor Gray
Write-Host "   Subject: Verify Your Email - MASH" -ForegroundColor Gray
Write-Host "   Check spam folder if not in inbox!" -ForegroundColor Gray
Write-Host ""

# Step 3: Get Verification Code from User
$verificationCode = ""
$maxAttempts = 3
$attempt = 1

while ($attempt -le $maxAttempts -and -not $verificationCode) {
    $code = Read-Host "Enter 6-digit verification code from email (Attempt $attempt/$maxAttempts)"
    
    if ($code -match '^\d{6}$') {
        $verificationCode = $code
    } else {
        Write-Host "❌ Invalid code format. Must be 6 digits." -ForegroundColor Red
        $attempt++
    }
}

if (-not $verificationCode) {
    Write-Host "❌ Maximum attempts reached. Please run the script again." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Verify Email
Write-Host "Step 3/5: Verifying email with code..." -ForegroundColor Cyan
$verifyBody = @{
    email = $testEmail
    code = $verificationCode
} | ConvertTo-Json

try {
    $verifyResponse = Invoke-RestMethod `
        -Uri "$backendUrl/api/v1/auth/verify-email" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $verifyBody
    
    Write-Host "✅ Email verified successfully!" -ForegroundColor Green
    Write-Host "   Access Token: $($verifyResponse.tokens.accessToken.Substring(0, 30))..." -ForegroundColor Gray
    
    $accessToken = $verifyResponse.tokens.accessToken
} catch {
    $errorDetail = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorDetail) {
        Write-Host "❌ Email verification failed!" -ForegroundColor Red
        Write-Host "   Error: $($errorDetail.message)" -ForegroundColor Red
        
        if ($errorDetail.message -match "expired") {
            Write-Host ""
            Write-Host "🔄 Code expired. Resending verification email..." -ForegroundColor Yellow
            
            $resendBody = @{ email = $testEmail } | ConvertTo-Json
            try {
                Invoke-RestMethod `
                    -Uri "$backendUrl/api/v1/auth/resend-verification" `
                    -Method POST `
                    -Headers @{"Content-Type"="application/json"} `
                    -Body $resendBody | Out-Null
                
                Write-Host "✅ New verification code sent to $testEmail" -ForegroundColor Green
                Write-Host "   Please run the script again with the new code" -ForegroundColor Yellow
            } catch {
                Write-Host "❌ Failed to resend verification code" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "❌ Email verification failed!" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""

# Step 5: Test Login
Write-Host "Step 4/5: Testing login with verified account..." -ForegroundColor Cyan
$loginBody = @{
    email = $testEmail
    password = "Test1234!"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod `
        -Uri "$backendUrl/api/v1/auth/login" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $loginBody
    
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "   User ID: $($loginResponse.user.id)" -ForegroundColor Gray
    Write-Host "   Email Verified: $($loginResponse.user.emailVerified)" -ForegroundColor Gray
    Write-Host "   Role: $($loginResponse.user.role)" -ForegroundColor Gray
    
    $loginToken = $loginResponse.tokens.accessToken
} catch {
    Write-Host "❌ Login failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 6: Test Protected Endpoint
Write-Host "Step 5/5: Testing protected endpoint with JWT..." -ForegroundColor Cyan
try {
    $profileResponse = Invoke-RestMethod `
        -Uri "$backendUrl/api/v1/auth/me" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $loginToken"
            "Content-Type" = "application/json"
        }
    
    Write-Host "✅ Protected endpoint accessed successfully!" -ForegroundColor Green
    Write-Host "   User: $($profileResponse.firstName) $($profileResponse.lastName)" -ForegroundColor Gray
    Write-Host "   Email: $($profileResponse.email)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Protected endpoint access failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "🎉 ALL TESTS PASSED!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Backend health check: PASSED" -ForegroundColor Green
Write-Host "✅ User registration: PASSED" -ForegroundColor Green
Write-Host "✅ Email delivery (SendGrid): PASSED" -ForegroundColor Green
Write-Host "✅ Email verification: PASSED" -ForegroundColor Green
Write-Host "✅ User login: PASSED" -ForegroundColor Green
Write-Host "✅ JWT authentication: PASSED" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Test Summary:" -ForegroundColor Cyan
Write-Host "   Email: $testEmail" -ForegroundColor Gray
Write-Host "   Username: $randomUsername" -ForegroundColor Gray
Write-Host "   Account Status: VERIFIED & ACTIVE" -ForegroundColor Gray
Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Test registration on live website:" -ForegroundColor Gray
Write-Host "      https://mash-ecommerce-web-production.up.railway.app/signup" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Monitor SendGrid activity:" -ForegroundColor Gray
Write-Host "      https://app.sendgrid.com/email_activity" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. Check Railway logs:" -ForegroundColor Gray
Write-Host "      railway logs --follow" -ForegroundColor Gray
Write-Host ""
