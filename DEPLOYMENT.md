# 🚀 MASH Backend Deployment Guide

This guide covers the complete deployment process for the MASH Backend API, from development to production environments.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring & Observability](#monitoring--observability)
- [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

### System Requirements

- **Node.js**: 20.x LTS or higher
- **npm**: 10.x or higher
- **Docker**: 24.x or higher
- **Docker Compose**: 2.x or higher
- **Git**: Latest version

### Infrastructure Requirements

#### Development
- **CPU**: 2 cores minimum
- **RAM**: 4GB minimum
- **Storage**: 20GB available space
- **Network**: Internet connection for dependencies

#### Production
- **CPU**: 4+ cores recommended
- **RAM**: 8GB+ recommended
- **Storage**: 100GB+ SSD recommended
- **Network**: Stable internet connection
- **SSL Certificate**: For HTTPS (Let's Encrypt recommended)

## 🔑 Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/MASH-Mushroom-Automation/MASH-Backend.git
cd MASH-Backend
```

### 2. Environment Variables

Create environment files for different environments:

#### Development (.env.dev)
```bash
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mash_backend_dev?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=1d

# Clerk Authentication
CLERK_WEBHOOK_SECRET=your-clerk-webhook-secret
CLERK_SECRET_KEY=your-clerk-secret-key

# MQTT
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=

# Email
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@mash-backend.com

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# Logging
LOG_LEVEL=debug
```

#### Production (.env.prod)
```bash
# Application
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# Database (Use secure connection string)
DATABASE_URL="postgresql://username:password@your-db-host:5432/mash_backend_prod?schema=public&sslmode=require"

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-redis-password

# JWT (Use strong secrets)
JWT_SECRET=your-ultra-secure-jwt-secret-64-chars-minimum
JWT_EXPIRATION=1d

# Clerk Authentication
CLERK_WEBHOOK_SECRET=your-production-clerk-webhook-secret
CLERK_SECRET_KEY=your-production-clerk-secret-key

# MQTT
MQTT_BROKER_URL=mqtts://your-mqtt-broker:8883
MQTT_USERNAME=your-mqtt-username
MQTT_PASSWORD=your-mqtt-password

# Email
SENDGRID_API_KEY=your-production-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=/app/uploads

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# Logging
LOG_LEVEL=info

# CORS
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

## 🏗️ Development Deployment

### Local Development

1. **Install Dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Setup Database**
   ```bash
   # Start PostgreSQL and Redis
   docker-compose -f docker-compose.dev.yml up postgres redis -d
   
   # Generate Prisma client
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   
   # (Optional) Seed database
   npm run db:seed
   ```

3. **Start Development Server**
   ```bash
   npm run start:dev
   ```

4. **Verify Installation**
   - API: http://localhost:3000/api/v1/health
   - Swagger: http://localhost:3000/api/docs
   - Database Admin: http://localhost:5050 (pgAdmin)
   - Redis Admin: http://localhost:8081 (Redis Commander)

### Docker Development

1. **Start All Services**
   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

2. **Start Specific Services**
   ```bash
   # Database and cache only
   docker-compose -f docker-compose.dev.yml up postgres redis mqtt -d
   
   # Full stack
   docker-compose -f docker-compose.dev.yml up
   ```

3. **View Logs**
   ```bash
   # All services
   docker-compose -f docker-compose.dev.yml logs -f
   
   # Specific service
   docker-compose -f docker-compose.dev.yml logs -f api
   ```

## 🏭 Production Deployment

### 1. Server Preparation

#### Ubuntu/Debian Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx (for reverse proxy)
sudo apt install nginx -y

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Application Deployment

#### Deploy with Docker Compose

1. **Create Production Directory**
   ```bash
   sudo mkdir -p /opt/mash-backend
   cd /opt/mash-backend
   ```

2. **Clone Repository**
   ```bash
   sudo git clone https://github.com/MASH-Mushroom-Automation/MASH-Backend.git .
   ```

3. **Setup Environment**
   ```bash
   sudo cp .env.example .env.prod
   # Edit .env.prod with production values
   sudo nano .env.prod
   ```

4. **Build and Start Services**
   ```bash
   sudo docker-compose -f docker-compose.prod.yml build
   sudo docker-compose -f docker-compose.prod.yml up -d
   ```

5. **Run Database Migrations**
   ```bash
   sudo docker-compose -f docker-compose.prod.yml exec api npm run db:migrate
   ```

#### Deploy with Docker Swarm (Recommended for Production)

1. **Initialize Swarm**
   ```bash
   docker swarm init
   ```

2. **Deploy Stack**
   ```bash
   docker stack deploy -c docker-compose.prod.yml mash-backend
   ```

3. **Scale Services**
   ```bash
   docker service scale mash-backend_api=3
   ```

### 3. SSL/TLS Setup

```bash
# Generate SSL certificate
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Auto-renewal setup
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 4. Nginx Configuration

Create `/etc/nginx/sites-available/mash-backend`:

```nginx
upstream mash_backend {
    server 127.0.0.1:3000;
    # Add more servers for load balancing
    # server 127.0.0.1:3001;
    # server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name yourdomain.com api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # API routes
    location /api/ {
        proxy_pass http://mash_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://mash_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /uploads/ {
        alias /opt/mash-backend/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        access_log off;
        proxy_pass http://mash_backend/api/v1/health;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/mash-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔄 CI/CD Pipeline

### GitHub Actions Setup

1. **Repository Secrets**
   
   Add these secrets in GitHub repository settings:
   ```
   DOCKER_USERNAME=your-docker-hub-username
   DOCKER_PASSWORD=your-docker-hub-password
   SONAR_TOKEN=your-sonarqube-token
   SONAR_HOST_URL=https://sonarcloud.io
   SNYK_TOKEN=your-snyk-token
   ```

2. **Database Secrets**
   ```
   DATABASE_URL=your-production-database-url
   JWT_SECRET=your-production-jwt-secret
   CLERK_WEBHOOK_SECRET=your-clerk-webhook-secret
   CLERK_SECRET_KEY=your-clerk-secret-key
   ```

### Automated Deployment

The pipeline automatically:
- ✅ Runs code quality checks
- ✅ Executes unit and integration tests
- ✅ Runs Postman/Newman API tests
- ✅ Performs security scanning
- ✅ Builds and pushes Docker images
- ✅ Deploys to staging/production

### Manual Deployment

For manual deployments:

```bash
# Build production image
docker build -t mash-backend:latest .

# Tag for registry
docker tag mash-backend:latest your-registry/mash-backend:latest

# Push to registry
docker push your-registry/mash-backend:latest

# Deploy to production
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Monitoring & Observability

### Health Checks

Monitor these endpoints:
- **API Health**: `GET /api/v1/health`
- **Database**: `GET /api/v1/health/database`
- **Redis**: `GET /api/v1/health/redis`
- **MQTT**: `GET /api/v1/health/mqtt`

### Logging

View application logs:
```bash
# Docker Compose logs
docker-compose -f docker-compose.prod.yml logs -f api

# Docker Swarm logs
docker service logs -f mash-backend_api
```

### Database Monitoring

```bash
# PostgreSQL logs
docker-compose -f docker-compose.prod.yml logs -f postgres

# Database connections
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"
```

### Performance Monitoring

Set up monitoring with:
- **Application**: Prometheus + Grafana
- **Infrastructure**: Node Exporter
- **Logs**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **APM**: New Relic or DataDog

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Issues

```bash
# Check database status
docker-compose -f docker-compose.prod.yml ps postgres

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Connect to database
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres
```

#### 2. Redis Connection Issues

```bash
# Check Redis status
docker-compose -f docker-compose.prod.yml ps redis

# Test Redis connection
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

#### 3. Application Not Starting

```bash
# Check application logs
docker-compose -f docker-compose.prod.yml logs api

# Check environment variables
docker-compose -f docker-compose.prod.yml exec api env | grep NODE_ENV

# Restart application
docker-compose -f docker-compose.prod.yml restart api
```

#### 4. High Memory Usage

```bash
# Check container stats
docker stats

# Check Node.js memory usage
docker-compose -f docker-compose.prod.yml exec api node -e "console.log(process.memoryUsage())"
```

### Performance Optimization

#### Database Optimization

```sql
-- Check slow queries
SELECT query, mean_time, calls, total_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Create indexes for frequently queried columns
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_devices_user_id ON devices(user_id);
CREATE INDEX CONCURRENTLY idx_sensor_data_timestamp ON sensor_data(timestamp);
```

#### Application Optimization

```bash
# Enable Node.js production optimizations
NODE_ENV=production node --max-old-space-size=4096 dist/main.js

# Use PM2 for process management
npm install -g pm2
pm2 start ecosystem.config.js --env production
```

### Backup and Recovery

#### Database Backup

```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres mash_backend_prod > backup.sql

# Restore backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres mash_backend_prod < backup.sql
```

#### Automated Backup Script

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
DB_NAME="mash_backend_prod"

mkdir -p $BACKUP_DIR

# Database backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Remove backups older than 7 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_backup_$DATE.sql.gz"
```

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * /opt/mash-backend/backup.sh
```

## 📞 Support

For deployment issues:
- **GitHub Issues**: [Create an issue](https://github.com/MASH-Mushroom-Automation/MASH-Backend/issues)
- **Documentation**: Check the main README.md
- **Community**: GitHub Discussions

---

**Happy Deploying! 🚀**