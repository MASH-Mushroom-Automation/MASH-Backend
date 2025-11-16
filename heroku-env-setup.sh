# Heroku Environment Variables Setup Script
# Run these commands to configure your Heroku app

# Replace 'mash-backend' with your actual Heroku app name if different
APP_NAME="mash-backend"

echo "Setting up environment variables for $APP_NAME..."

# =====================================
# REQUIRED - Database Configuration
# =====================================
# DATABASE_URL is automatically set by Heroku PostgreSQL addon
# Uncomment below if you need to set DIRECT_URL for connection pooling
# heroku config:set DIRECT_URL=$(heroku config:get DATABASE_URL -a $APP_NAME) -a $APP_NAME

# =====================================
# REQUIRED - Node Environment
# =====================================
heroku config:set NODE_ENV=production -a $APP_NAME

# =====================================
# REQUIRED - JWT Configuration
# =====================================
# Generate a secure secret: openssl rand -base64 32
heroku config:set JWT_SECRET="CHANGE_ME_TO_SECURE_SECRET_MIN_32_CHARS" -a $APP_NAME
heroku config:set JWT_EXPIRES_IN="7d" -a $APP_NAME

# =====================================
# REQUIRED - Clerk Authentication
# =====================================
heroku config:set CLERK_PUBLISHABLE_KEY="pk_live_YOUR_KEY_HERE" -a $APP_NAME
heroku config:set CLERK_SECRET_KEY="sk_live_YOUR_KEY_HERE" -a $APP_NAME
heroku config:set CLERK_WEBHOOK_SECRET="whsec_YOUR_SECRET_HERE" -a $APP_NAME

# =====================================
# REQUIRED - Application URLs
# =====================================
heroku config:set PORT=3000 -a $APP_NAME
heroku config:set APP_NAME="MASH Backend" -a $APP_NAME
heroku config:set APP_URL="https://$APP_NAME.herokuapp.com" -a $APP_NAME
heroku config:set FRONTEND_URL="https://your-frontend-url.vercel.app" -a $APP_NAME

# =====================================
# REQUIRED - CORS Configuration
# =====================================
heroku config:set CORS_ORIGIN="https://your-frontend-url.vercel.app,https://admin.yourdomain.com" -a $APP_NAME

# =====================================
# Email Configuration (SendGrid)
# =====================================
heroku config:set SENDGRID_API_KEY="SG.YOUR_KEY_HERE" -a $APP_NAME
heroku config:set SENDGRID_FROM_EMAIL="noreply@yourdomain.com" -a $APP_NAME
heroku config:set SENDGRID_FROM_NAME="MASH Platform" -a $APP_NAME

# Alternative: SMTP Configuration (if not using SendGrid)
# heroku config:set SMTP_HOST="smtp.gmail.com" -a $APP_NAME
# heroku config:set SMTP_PORT=587 -a $APP_NAME
# heroku config:set SMTP_USER="your-email@gmail.com" -a $APP_NAME
# heroku config:set SMTP_PASSWORD="your-app-password" -a $APP_NAME
# heroku config:set SMTP_FROM_EMAIL="noreply@yourdomain.com" -a $APP_NAME
# heroku config:set SMTP_FROM_NAME="MASH Platform" -a $APP_NAME

# =====================================
# AWS S3 (File Upload)
# =====================================
heroku config:set AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY" -a $APP_NAME
heroku config:set AWS_SECRET_ACCESS_KEY="YOUR_SECRET_KEY" -a $APP_NAME
heroku config:set AWS_REGION="us-east-1" -a $APP_NAME
heroku config:set AWS_S3_BUCKET="mash-uploads" -a $APP_NAME

# =====================================
# Redis (Optional - for caching/queues)
# =====================================
# First add the addon:
# heroku addons:create heroku-redis:mini -a $APP_NAME
# REDIS_URL will be automatically set

# =====================================
# Payment Gateway (Stripe)
# =====================================
heroku config:set STRIPE_SECRET_KEY="sk_live_YOUR_KEY" -a $APP_NAME
heroku config:set STRIPE_WEBHOOK_SECRET="whsec_YOUR_SECRET" -a $APP_NAME
heroku config:set STRIPE_PUBLISHABLE_KEY="pk_live_YOUR_KEY" -a $APP_NAME

# =====================================
# SMS (Twilio)
# =====================================
heroku config:set TWILIO_ACCOUNT_SID="YOUR_ACCOUNT_SID" -a $APP_NAME
heroku config:set TWILIO_AUTH_TOKEN="YOUR_AUTH_TOKEN" -a $APP_NAME
heroku config:set TWILIO_PHONE_NUMBER="+1234567890" -a $APP_NAME

# Alternative: Vonage (Nexmo)
# heroku config:set VONAGE_API_KEY="YOUR_API_KEY" -a $APP_NAME
# heroku config:set VONAGE_API_SECRET="YOUR_API_SECRET" -a $APP_NAME
# heroku config:set VONAGE_FROM_NUMBER="+1234567890" -a $APP_NAME

# =====================================
# Firebase (Push Notifications)
# =====================================
heroku config:set FIREBASE_PROJECT_ID="your-project-id" -a $APP_NAME
heroku config:set FIREBASE_CLIENT_EMAIL="firebase-adminsdk@your-project.iam.gserviceaccount.com" -a $APP_NAME
# Note: For FIREBASE_PRIVATE_KEY, replace \n with actual newlines
heroku config:set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n" -a $APP_NAME

# =====================================
# OAuth Providers (Google, Facebook)
# =====================================
heroku config:set GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com" -a $APP_NAME
heroku config:set GOOGLE_CLIENT_SECRET="YOUR_CLIENT_SECRET" -a $APP_NAME
heroku config:set GOOGLE_CALLBACK_URL="https://$APP_NAME.herokuapp.com/api/v1/auth/google/callback" -a $APP_NAME

heroku config:set FACEBOOK_APP_ID="YOUR_APP_ID" -a $APP_NAME
heroku config:set FACEBOOK_APP_SECRET="YOUR_APP_SECRET" -a $APP_NAME
heroku config:set FACEBOOK_CALLBACK_URL="https://$APP_NAME.herokuapp.com/api/v1/auth/facebook/callback" -a $APP_NAME

# =====================================
# Monitoring & Observability (Optional)
# =====================================
heroku config:set SENTRY_DSN="https://YOUR_KEY@sentry.io/YOUR_PROJECT_ID" -a $APP_NAME
heroku config:set JAEGER_AGENT_HOST="localhost" -a $APP_NAME
heroku config:set JAEGER_AGENT_PORT=6831 -a $APP_NAME

# =====================================
# Feature Flags (Optional)
# =====================================
heroku config:set ENABLE_SWAGGER=true -a $APP_NAME
heroku config:set ENABLE_METRICS=true -a $APP_NAME
heroku config:set ENABLE_HEALTH_CHECK=true -a $APP_NAME

# =====================================
# Rate Limiting (Optional)
# =====================================
heroku config:set RATE_LIMIT_TTL=60 -a $APP_NAME
heroku config:set RATE_LIMIT_MAX=100 -a $APP_NAME

# =====================================
# IoT/MQTT (Optional)
# =====================================
heroku config:set MQTT_BROKER_URL="mqtt://broker.hivemq.com:1883" -a $APP_NAME
heroku config:set MQTT_USERNAME="" -a $APP_NAME
heroku config:set MQTT_PASSWORD="" -a $APP_NAME

echo "Environment variables setup complete!"
echo "Run 'heroku config -a $APP_NAME' to verify all variables are set."
