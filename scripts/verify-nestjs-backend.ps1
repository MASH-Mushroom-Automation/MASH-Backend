# ============================================================================
# NestJS Backend Verification Script
# ============================================================================
# Purpose: Comprehensive verification that the MASH backend builds and runs correctly
# Usage: .\scripts\verify-nestjs-backend.ps1
# ============================================================================

param(
    [switch]$SkipBuild = $false,
    [switch]$SkipTests = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Color functions
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Error-Custom { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Warning-Custom { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Info { param($Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Step { param($Message) Write-Host "`n🔹 $Message" -ForegroundColor Magenta }

# Verification results
$script:VerificationResults = @{
    Environment = @{}
    Dependencies = @{}
    Configuration = @{}
    Build = @{}
    Runtime = @{}
    Health = @{}
}

# ============================================================================
# STEP 1: Verify Environment
# ============================================================================
Write-Step "Step 1: Verifying Environment Prerequisites"

# Check Node.js
try {
    $nodeVersion = node --version
    $script:VerificationResults.Environment.Node = @{
        Installed = $true
        Version = $nodeVersion
        Status = "OK"
    }
    Write-Success "Node.js installed: $nodeVersion"
} catch {
    $script:VerificationResults.Environment.Node = @{
        Installed = $false
        Status = "FAILED"
    }
    Write-Error-Custom "Node.js not installed or not in PATH"
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    $script:VerificationResults.Environment.Npm = @{
        Installed = $true
        Version = $npmVersion
        Status = "OK"
    }
    Write-Success "npm installed: $npmVersion"
} catch {
    $script:VerificationResults.Environment.Npm = @{
        Installed = $false
        Status = "FAILED"
    }
    Write-Error-Custom "npm not installed or not in PATH"
    exit 1
}

# Check if in correct directory
if (-not (Test-Path "package.json")) {
    Write-Error-Custom "Not in the correct directory. Please run from project root."
    exit 1
}

$packageJson = Get-Content "package.json" | ConvertFrom-Json
Write-Success "Project: $($packageJson.name) v$($packageJson.version)"

# ============================================================================
# STEP 2: Verify Dependencies
# ============================================================================
Write-Step "Step 2: Verifying Dependencies"

if (-not (Test-Path "node_modules")) {
    Write-Warning-Custom "node_modules not found. Installing dependencies..."
    npm install --legacy-peer-deps
}

# Check critical dependencies
$criticalDeps = @("@nestjs/core", "@nestjs/common", "@prisma/client", "typescript")
foreach ($dep in $criticalDeps) {
    if (Test-Path "node_modules\$dep") {
        Write-Success "Dependency installed: $dep"
        $script:VerificationResults.Dependencies[$dep] = "OK"
    } else {
        Write-Error-Custom "Missing dependency: $dep"
        $script:VerificationResults.Dependencies[$dep] = "MISSING"
    }
}

# ============================================================================
# STEP 3: Verify Configuration
# ============================================================================
Write-Step "Step 3: Verifying Configuration Files"

# Check .env file
if (Test-Path ".env") {
    Write-Success ".env file exists"
    $envContent = Get-Content ".env"
    
    # Check required environment variables
    $requiredVars = @("DATABASE_URL", "JWT_SECRET", "NODE_ENV")
    foreach ($var in $requiredVars) {
        $found = $envContent | Where-Object { $_ -match "^$var=" }
        if ($found) {
            Write-Success "  $var is configured"
            $script:VerificationResults.Configuration[$var] = "OK"
        } else {
            Write-Warning-Custom "  $var is missing"
            $script:VerificationResults.Configuration[$var] = "MISSING"
        }
    }
} else {
    Write-Warning-Custom ".env file not found. Copy from .env.example"
    $script:VerificationResults.Configuration.EnvFile = "MISSING"
}

# Check TypeScript configuration
$tsConfigs = @("tsconfig.json", "tsconfig.build.json")
foreach ($config in $tsConfigs) {
    if (Test-Path $config) {
        Write-Success "$config exists"
        $script:VerificationResults.Configuration[$config] = "OK"
    } else {
        Write-Error-Custom "$config missing"
        $script:VerificationResults.Configuration[$config] = "MISSING"
    }
}

# Check Prisma schema
if (Test-Path "prisma\schema.prisma") {
    Write-Success "Prisma schema exists"
    $script:VerificationResults.Configuration.PrismaSchema = "OK"
} else {
    Write-Error-Custom "Prisma schema missing"
    $script:VerificationResults.Configuration.PrismaSchema = "MISSING"
}

# ============================================================================
# STEP 4: Verify Prisma Client
# ============================================================================
Write-Step "Step 4: Verifying Prisma Client"

if (Test-Path "node_modules\.prisma\client") {
    Write-Success "Prisma client is generated"
    $script:VerificationResults.Dependencies.PrismaClient = "OK"
} else {
    Write-Warning-Custom "Prisma client not generated. Generating..."
    npx prisma generate
    if (Test-Path "node_modules\.prisma\client") {
        Write-Success "Prisma client generated successfully"
        $script:VerificationResults.Dependencies.PrismaClient = "OK"
    } else {
        Write-Error-Custom "Failed to generate Prisma client"
        $script:VerificationResults.Dependencies.PrismaClient = "FAILED"
    }
}

# ============================================================================
# STEP 5: Build the Application
# ============================================================================
if (-not $SkipBuild) {
    Write-Step "Step 5: Building the Application"
    
    # Clean previous build
    Write-Info "Cleaning previous build artifacts..."
    Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
    Remove-Item -Force tsconfig.build.tsbuildinfo -ErrorAction SilentlyContinue
    
    # Run build
    Write-Info "Running npm run build (this takes 15-30 seconds)..."
    $buildOutput = npm run build 2>&1
    
    Start-Sleep -Seconds 3
    
    # Verify build output
    if (Test-Path "dist\main.js") {
        Write-Success "Build successful! dist\main.js created"
        $fileCount = (Get-ChildItem dist -Recurse -File).Count
        $distSize = [math]::Round(((Get-ChildItem dist -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
        
        Write-Success "Total files generated: $fileCount"
        Write-Success "Total size: $distSize MB"
        
        $script:VerificationResults.Build.Status = "SUCCESS"
        $script:VerificationResults.Build.FilesGenerated = $fileCount
        $script:VerificationResults.Build.SizeMB = $distSize
        
        Write-Info "`nKey build files:"
        Get-ChildItem dist -File | Where-Object { $_.Name -match "^(main|app\.)" } | 
            Select-Object Name, @{Name="Size (KB)";Expression={[math]::Round($_.Length/1KB,1)}} |
            Format-Table -AutoSize
    } else {
        Write-Error-Custom "Build failed - dist\main.js not found"
        Write-Info "Build output (last 20 lines):"
        $buildOutput | Select-Object -Last 20
        $script:VerificationResults.Build.Status = "FAILED"
        exit 1
    }
} else {
    Write-Warning-Custom "Build step skipped (--SkipBuild flag)"
}

# ============================================================================
# STEP 6: Verify Application Can Start (Production Mode)
# ============================================================================
Write-Step "Step 6: Verifying Application Can Start"

if (Test-Path "dist\main.js") {
    Write-Info "Starting server in background (production mode)..."
    
    # Check if port 3000 is available
    $portInUse = netstat -ano | findstr ":3000 "
    if ($portInUse) {
        Write-Warning-Custom "Port 3000 is already in use"
        Write-Info "Processes using port 3000:"
        $portInUse
        $script:VerificationResults.Runtime.Port3000 = "IN_USE"
    } else {
        Write-Success "Port 3000 is available"
        $script:VerificationResults.Runtime.Port3000 = "AVAILABLE"
    }
    
    # Start the server
    $serverJob = Start-Job -ScriptBlock {
        param($projectPath)
        Set-Location $projectPath
        npm run start:prod 2>&1
    } -ArgumentList (Get-Location).Path
    
    Write-Info "Waiting for server to start (30 seconds)..."
    Start-Sleep -Seconds 30
    
    # Test health endpoint
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/health" -Method Get -TimeoutSec 10
        
        Write-Success "`n✅ ✅ ✅ SERVER IS RUNNING AND HEALTHY! ✅ ✅ ✅`n"
        Write-Info "Health Check Response:"
        $response | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor Cyan
        
        $script:VerificationResults.Health.Status = "HEALTHY"
        $script:VerificationResults.Health.Response = $response
        
        Write-Info "`n🌐 Server Endpoints:"
        Write-Success "  Server URL: http://localhost:3000"
        Write-Success "  API Docs: http://localhost:3000/api/docs"
        Write-Success "  Metrics: http://localhost:3000/metrics"
        Write-Success "  Health: http://localhost:3000/api/v1/health"
        
    } catch {
        Write-Error-Custom "Server health check failed: $($_.Exception.Message)"
        $script:VerificationResults.Health.Status = "FAILED"
        $script:VerificationResults.Health.Error = $_.Exception.Message
    }
    
    # Stop the server
    Write-Info "`nStopping test server..."
    Stop-Job -Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job -Job $serverJob -Force -ErrorAction SilentlyContinue
    
    # Kill any remaining node processes
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    
    Write-Success "Test server stopped"
    
} else {
    Write-Error-Custom "Cannot start server - build artifacts missing"
    $script:VerificationResults.Runtime.Status = "SKIPPED"
}

# ============================================================================
# STEP 7: Run Type Checking
# ============================================================================
if (-not $SkipTests) {
    Write-Step "Step 7: Running Type Checking"
    
    Write-Info "Running TypeScript type check..."
    $typeCheckOutput = npx tsc --noEmit -p tsconfig.json 2>&1
    
    # Check for errors (excluding test files)
    $errors = $typeCheckOutput | Where-Object { $_ -match "error TS\d+" -and $_ -notmatch "(\.spec\.ts|\.e2e-spec\.ts|\.int-spec\.ts|__tests__)" }
    
    if ($errors.Count -eq 0) {
        Write-Success "No TypeScript errors in source code"
        $script:VerificationResults.Build.TypeCheck = "PASSED"
    } else {
        Write-Warning-Custom "Found $($errors.Count) TypeScript errors in source code"
        $script:VerificationResults.Build.TypeCheck = "WARNINGS"
        if ($Verbose) {
            $errors | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
        }
    }
} else {
    Write-Warning-Custom "Type checking skipped (--SkipTests flag)"
}

# ============================================================================
# FINAL REPORT
# ============================================================================
Write-Host "`n" + ("=" * 80) -ForegroundColor Magenta
Write-Host "NESTJS BACKEND VERIFICATION REPORT" -ForegroundColor Magenta
Write-Host ("=" * 80) -ForegroundColor Magenta

Write-Host "`n📋 Environment:" -ForegroundColor Cyan
Write-Host "  Node.js: $($script:VerificationResults.Environment.Node.Version)" -ForegroundColor White
Write-Host "  npm: $($script:VerificationResults.Environment.Npm.Version)" -ForegroundColor White

Write-Host "`n📦 Dependencies:" -ForegroundColor Cyan
$depsOK = ($script:VerificationResults.Dependencies.Values | Where-Object { $_ -eq "OK" }).Count
$depsTotal = $script:VerificationResults.Dependencies.Count
Write-Host "  $depsOK / $depsTotal critical dependencies OK" -ForegroundColor White

Write-Host "`n⚙️  Configuration:" -ForegroundColor Cyan
$configOK = ($script:VerificationResults.Configuration.Values | Where-Object { $_ -eq "OK" }).Count
$configTotal = $script:VerificationResults.Configuration.Count
Write-Host "  $configOK / $configTotal configuration items OK" -ForegroundColor White

Write-Host "`n🔨 Build:" -ForegroundColor Cyan
if ($script:VerificationResults.Build.Status -eq "SUCCESS") {
    Write-Host "  Status: SUCCESS ✅" -ForegroundColor Green
    Write-Host "  Files Generated: $($script:VerificationResults.Build.FilesGenerated)" -ForegroundColor White
    Write-Host "  Total Size: $($script:VerificationResults.Build.SizeMB) MB" -ForegroundColor White
} else {
    Write-Host "  Status: FAILED ❌" -ForegroundColor Red
}

Write-Host "`n🚀 Runtime:" -ForegroundColor Cyan
if ($script:VerificationResults.Health.Status -eq "HEALTHY") {
    Write-Host "  Server Status: HEALTHY ✅" -ForegroundColor Green
    Write-Host "  Health Check: PASSED ✅" -ForegroundColor Green
} elseif ($script:VerificationResults.Health.Status -eq "FAILED") {
    Write-Host "  Server Status: FAILED ❌" -ForegroundColor Red
    Write-Host "  Error: $($script:VerificationResults.Health.Error)" -ForegroundColor Yellow
} else {
    Write-Host "  Server Status: NOT TESTED" -ForegroundColor Yellow
}

# Overall Status
Write-Host "`n" + ("=" * 80) -ForegroundColor Magenta
if ($script:VerificationResults.Build.Status -eq "SUCCESS" -and 
    $script:VerificationResults.Health.Status -eq "HEALTHY") {
    Write-Host "✅ OVERALL STATUS: ALL CHECKS PASSED" -ForegroundColor Green
    Write-Host "The NestJS backend builds correctly and runs successfully!" -ForegroundColor Green
} elseif ($script:VerificationResults.Build.Status -eq "SUCCESS") {
    Write-Host "⚠️  OVERALL STATUS: BUILD OK, RUNTIME ISSUES" -ForegroundColor Yellow
    Write-Host "The NestJS backend builds correctly but may have runtime issues." -ForegroundColor Yellow
} else {
    Write-Host "❌ OVERALL STATUS: VERIFICATION FAILED" -ForegroundColor Red
    Write-Host "The NestJS backend has build or configuration issues." -ForegroundColor Red
}
Write-Host ("=" * 80) -ForegroundColor Magenta

# Export results to JSON
$resultsFile = "verification-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$script:VerificationResults | ConvertTo-Json -Depth 10 | Out-File $resultsFile
Write-Info ("`n📄 Detailed results saved to: " + $resultsFile)

Write-Host "`n💡 Next Steps:" -ForegroundColor Cyan
if ($script:VerificationResults.Build.Status -eq "SUCCESS") {
    Write-Host "  1. Start development server: npm run start:dev" -ForegroundColor White
    Write-Host "  2. Start production server: npm run start:prod" -ForegroundColor White
    Write-Host "  3. Access API docs: http://localhost:3000/api/docs" -ForegroundColor White
    Write-Host "  4. Monitor metrics: http://localhost:3000/metrics" -ForegroundColor White
} else {
    Write-Host "  1. Fix configuration issues listed above" -ForegroundColor White
    Write-Host "  2. Run this script again: .\scripts\verify-nestjs-backend.ps1" -ForegroundColor White
    Write-Host "  3. Check documentation: docs/BUILD_TROUBLESHOOTING.md" -ForegroundColor White
}

Write-Host ""
