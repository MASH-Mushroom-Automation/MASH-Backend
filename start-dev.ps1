#!/usr/bin/env pwsh
# ============================================================================
# MASH Backend - Quick Start Script (PowerShell)
# ============================================================================
# Run this with: .\start-dev.ps1
# Or right-click and "Run with PowerShell"
# ============================================================================

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
function Write-Header { Write-Host $args -ForegroundColor Cyan }
function Write-Success { Write-Host "[✓]" -ForegroundColor Green -NoNewline; Write-Host " $args" }
function Write-Error-Custom { Write-Host "[✗]" -ForegroundColor Red -NoNewline; Write-Host " $args" }
function Write-Info { Write-Host "[i]" -ForegroundColor Yellow -NoNewline; Write-Host " $args" }

Write-Host ""
Write-Header "========================================"
Write-Header "  MASH Backend - Starting Development"
Write-Header "========================================"
Write-Host ""

# Change to script directory
Set-Location $PSScriptRoot

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Error-Custom ".env file not found!"
    Write-Info "Please copy .env.example to .env and configure it"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Success ".env file found"

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Success "Node.js version: $nodeVersion"
} catch {
    Write-Error-Custom "Node.js is not installed or not in PATH"
    Write-Info "Please install Node.js from https://nodejs.org/"
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Info "node_modules not found. Installing dependencies..."
    Write-Info "This may take a few minutes..."
    Write-Host ""
    
    try {
        npm install --legacy-peer-deps
        Write-Success "Dependencies installed successfully"
    } catch {
        Write-Error-Custom "Failed to install dependencies"
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host ""
} else {
    Write-Success "node_modules found"
}

# Generate Prisma Client
Write-Info "Generating Prisma Client..."
try {
    npx prisma generate | Out-Null
    Write-Success "Prisma Client generated"
} catch {
    Write-Error-Custom "Failed to generate Prisma Client"
    Read-Host "Press Enter to exit"
    exit 1
}

# Build the application
Write-Info "Building NestJS application..."
try {
    npm run build | Out-Null
    Write-Success "Build completed"
} catch {
    Write-Error-Custom "Build failed"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Header "========================================"
Write-Header "  Starting Backend Server"
Write-Header "========================================"
Write-Host ""
Write-Success "Server will start at http://localhost:3000"
Write-Success "API Docs at http://localhost:3000/api"
Write-Success "Metrics at http://localhost:3000/metrics"
Write-Info "Press Ctrl+C to stop the server"
Write-Host ""

# Start development server
try {
    npm run start:dev
} catch {
    Write-Error-Custom "Server crashed"
    Read-Host "Press Enter to exit"
    exit 1
}
