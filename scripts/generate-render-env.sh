#!/bin/bash

# MASH Backend - Render Environment Variables Setup Script
# This script helps you generate and copy environment variables for Render.com

echo "🚀 MASH Backend - Render Environment Variables Generator"
echo "=========================================================="
echo ""

# Generate random secrets
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

JWT_SECRET=$(generate_secret)
JWT_REFRESH_SECRET=$(generate_secret)

echo "✅ Generated JWT Secrets"
echo ""

# Display environment variables
echo "📋 Copy these environment variables to Render Dashboard:"
echo "=========================================================="
echo ""

cat << EOF
NODE_ENV=production
PORT=3000

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_REFRESH_EXPIRES_IN=30d

# CORS Configuration
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# MQTT Configuration (Optional)
MQTT_ENABLED=false

# Database (Auto-populated by Render)
DATABASE_URL=<from-render-database>

# Firebase (Add your credentials)
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
# FIREBASE_PRIVATE_KEY="your-private-key"

# SendGrid Email (Optional)
# SENDGRID_API_KEY=your-sendgrid-api-key
# SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Redis (Optional)
# REDIS_HOST=
# REDIS_PORT=6379
EOF

echo ""
echo "=========================================================="
echo "✅ Environment variables generated successfully!"
echo ""
echo "📝 Next Steps:"
echo "1. Copy the environment variables above"
echo "2. Go to Render Dashboard: https://dashboard.render.com/"
echo "3. Open your web service settings"
echo "4. Scroll to 'Environment Variables' section"
echo "5. Paste and configure each variable"
echo ""
echo "⚠️  Important:"
echo "- DATABASE_URL will be auto-populated by Render PostgreSQL"
echo "- Add Firebase credentials if using Firebase Auth"
echo "- Update CORS_ORIGIN for production (your frontend URL)"
echo ""
echo "📚 Full Guide: See RENDER_DEPLOYMENT_GUIDE.md"
echo ""
