@echo off
REM MASH Backend - Render Environment Variables Setup Script (Windows)
REM This script helps you generate environment variables for Render.com

echo.
echo ======================================================================
echo       MASH Backend - Render Environment Variables Generator
echo ======================================================================
echo.

REM Generate random JWT secrets (simplified for Windows)
set JWT_SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%
set JWT_REFRESH_SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%

echo GENERATED JWT SECRETS
echo.

echo ======================================================================
echo  Copy these environment variables to Render Dashboard
echo ======================================================================
echo.

echo NODE_ENV=production
echo PORT=3000
echo.
echo # JWT Configuration
echo JWT_SECRET=%JWT_SECRET%
echo JWT_EXPIRES_IN=7d
echo JWT_REFRESH_SECRET=%JWT_REFRESH_SECRET%
echo JWT_REFRESH_EXPIRES_IN=30d
echo.
echo # CORS Configuration
echo CORS_ORIGIN=*
echo.
echo # Rate Limiting
echo RATE_LIMIT_TTL=60
echo RATE_LIMIT_MAX=100
echo.
echo # MQTT Configuration (Optional)
echo MQTT_ENABLED=false
echo.
echo # Database (Auto-populated by Render)
echo DATABASE_URL=^<from-render-database^>
echo.
echo # Firebase (Add your credentials)
echo # FIREBASE_PROJECT_ID=your-project-id
echo # FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
echo # FIREBASE_PRIVATE_KEY="your-private-key"
echo.
echo # SendGrid Email (Optional)
echo # SENDGRID_API_KEY=your-sendgrid-api-key
echo # SENDGRID_FROM_EMAIL=noreply@yourdomain.com
echo.
echo # Redis (Optional)
echo # REDIS_HOST=
echo # REDIS_PORT=6379
echo.

echo ======================================================================
echo Environment variables generated successfully!
echo.
echo NEXT STEPS:
echo 1. Copy the environment variables above
echo 2. Go to Render Dashboard: https://dashboard.render.com/
echo 3. Open your web service settings
echo 4. Scroll to 'Environment Variables' section
echo 5. Paste and configure each variable
echo.
echo IMPORTANT:
echo - DATABASE_URL will be auto-populated by Render PostgreSQL
echo - Add Firebase credentials if using Firebase Auth
echo - Update CORS_ORIGIN for production (your frontend URL)
echo.
echo FULL GUIDE: See RENDER_DEPLOYMENT_GUIDE.md
echo.
echo ======================================================================

pause
