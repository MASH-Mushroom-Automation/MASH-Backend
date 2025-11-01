# Multi-stage Docker build for MASH Backend
# Stage 1: Build stage
# Updated: Fixes Railway deployment by preventing lifecycle scripts in production
FROM node:25-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY package-lock.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev dependencies needed for build)
# Use `npm install` instead of `npm ci` because CI can fail when
# package.json and package-lock.json are out of sync (common in CI builds).
# `npm install --legacy-peer-deps` is more tolerant and works in the builder.
RUN npm install --legacy-peer-deps && npm cache clean --force

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application and verify it succeeded
# Note: Build outputs to dist/main.js (not dist/src/main.js) because rootDir strips src/ prefix
RUN npm run build && \
    ls -la dist/ && \
    test -f dist/main.js || (echo "ERROR: dist/main.js not found after build!" && exit 1)

# Stage 2: Production stage
FROM node:25-alpine AS production

# Install ALL dependencies needed for Sharp (keep everything, don't delete)
# Sharp requires vips runtime libraries and build tools must remain for npm rebuild
RUN apk add --no-cache \
    dumb-init \
    wget \
    vips \
    vips-dev \
    fftw-dev \
    build-base \
    python3 \
    gcc \
    g++ \
    make \
    pkgconfig

# Create app user
RUN addgroup -g 1001 -S appuser && adduser -S appuser -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies and force Sharp to rebuild for Alpine Linux
# Step 1: Install without scripts to avoid husky
# Step 2: Remove any existing Sharp binaries
# Step 3: Reinstall Sharp with correct platform flags
# Step 4: Rebuild Sharp to ensure native bindings are correct
RUN set -eux; \
    # Use npm install in production image to tolerate minor lockfile drift
    npm install --legacy-peer-deps --omit=dev --ignore-scripts || true; \
    # Ensure sharp is rebuilt for musl (Alpine). Try install/rebuild with a fallback
    rm -rf node_modules/sharp || true; \
    (npm install --legacy-peer-deps --omit=dev sharp --verbose || npm install --legacy-peer-deps --omit=dev sharp) && \
    npm rebuild sharp --platform=linux --arch=x64 --libc=musl --verbose || echo "WARNING: sharp rebuild failed, proceeding without explicit rebuild"; \
    npm cache clean --force || true

# Verify Sharp is installed correctly
RUN node -e "const sharp = require('sharp'); console.log('Sharp version:', sharp.versions);" || \
    (echo "ERROR: Sharp installation failed!" && exit 1)

# Copy built application from builder stage
# Prisma client artifacts are generated in the builder (where dev deps are present).
# We avoid running `npx prisma generate` in production because `prisma` CLI is a devDependency
# and we install production deps with `--omit=dev --ignore-scripts` to prevent lifecycle scripts
# (e.g. husky prepare). Instead copy the generated prisma artifacts from the builder.
COPY --from=builder /app/dist ./dist
# Copy full node_modules (built in builder) to preserve native modules like sharp
COPY --from=builder /app/node_modules ./node_modules
# Copy prisma artifacts specifically as well (defensive)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy scripts folder (if it exists)
COPY --from=builder --chown=appuser:appuser /app/scripts ./scripts

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/uploads/exports /app/uploads/temp && \
    chown -R appuser:appuser /app/logs /app/uploads

# Set ownership of copied files
RUN chown -R appuser:appuser /app/dist /app/node_modules /app/prisma

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check - Use built-in Node health-check script
# The script is compiled to dist/health/health-check.js during build
# Increased start-period to 60s to allow for full initialization
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node dist/health/health-check.js || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application (main.js is at dist/main.js, not dist/src/main.js)
CMD ["node", "dist/main.js"]