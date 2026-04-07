# Multi-stage Docker build for MASH Backend
# Stage 1: Build stage (with Sharp pre-built for Alpine/musl)
# Updated: Fixes Railway deployment - Node 22 LTS for engine compatibility
FROM node:25-alpine AS builder

# Install build dependencies needed for Sharp and native modules
# node-gyp requires python3, make, g++ for native compilation
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev \
    vips-dev \
    fftw-dev \
    pkgconfig

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY package-lock.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev dependencies needed for build)
# CRITICAL FIX: Set Prisma binary targets BEFORE install to avoid download during postinstall
# Sharp is built here with native Alpine dependencies available
ENV PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl,linux-musl-openssl-3.0.x

# Install node-gyp globally first (required for Sharp if prebuilt binaries unavailable)
RUN npm install -g node-gyp

# Install dependencies - Sharp will use prebuilt binaries for linux-musl
# If prebuilt unavailable, node-gyp will build from source
RUN npm install --legacy-peer-deps && npm cache clean --force

# Verify Sharp works in builder
RUN node -e "const sharp = require('sharp'); console.log('Builder Sharp version:', sharp.versions);"

# Generate Prisma Client (this downloads engines if not already cached)
# Add retry logic for Prisma engine downloads
RUN npx prisma generate || \
    (echo "Prisma generate failed, retrying..." && sleep 5 && npx prisma generate) || \
    (echo "Prisma generate failed again, final retry..." && sleep 10 && npx prisma generate)

# Copy source code
COPY . .

# Build the application and verify it succeeded
# Note: Build outputs to dist/main.js (not dist/src/main.js) because rootDir strips src/ prefix
RUN npm run build && \
    ls -la dist/ && \
    test -f dist/main.js || (echo "ERROR: dist/main.js not found after build!" && exit 1)

# Stage 2: Production stage
FROM node:25-alpine AS production

# Install ONLY runtime dependencies for Sharp (vips runtime)
# NO build tools needed since we copy pre-built node_modules from builder
RUN apk add --no-cache \
    dumb-init \
    wget \
    vips

# Create app user
RUN addgroup -g 1001 -S appuser && adduser -S appuser -u 1001

# Set working directory
WORKDIR /app

# Copy package files (for reference only, not for install)
COPY package*.json ./
COPY prisma ./prisma/

# Copy ALL node_modules from builder (includes pre-built Sharp for Alpine/musl)
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy prisma artifacts specifically (defensive)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Verify Sharp works in production stage
RUN node -e "const sharp = require('sharp'); console.log('Production Sharp version:', sharp.versions);" || \
    (echo "ERROR: Sharp installation failed in production stage!" && exit 1)

# Copy public folder for static assets (email templates, images, etc.)
COPY --from=builder /app/public ./public

# Copy scripts folder (if it exists and is not empty)
# Note: Commented out because scripts folder is currently empty and Docker doesn't copy empty directories
# COPY --from=builder --chown=appuser:appuser /app/scripts ./scripts

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/uploads/exports /app/uploads/temp && \
    chown -R appuser:appuser /app/logs /app/uploads

# Set ownership of copied files (including public folder for static assets)
RUN chown -R appuser:appuser /app/dist /app/node_modules /app/prisma /app/public

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check - Use built-in Node health-check script
# The script is compiled to dist/health/health-check.js during build
# Increased start-period to 120s to allow for full initialization (Railway optimized)
# Increased timeout to 30s to handle slow database connections
HEALTHCHECK --interval=30s --timeout=30s --start-period=120s --retries=3 \
  CMD node dist/health/health-check.js || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application (main.js is at dist/main.js, not dist/src/main.js)
CMD ["node", "dist/main.js"]