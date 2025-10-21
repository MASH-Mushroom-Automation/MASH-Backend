# Multi-stage Docker build for MASH Backend
# Stage 1: Build stage
# Updated: Fixes Railway deployment by preventing lifecycle scripts in production
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev dependencies needed for build)
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application and verify it succeeded
RUN npm run build && \
    ls -la dist/ && \
    ls -la dist/src/ && \
    test -f dist/src/main.js || (echo "ERROR: dist/src/main.js not found after build!" && exit 1)

# Stage 2: Production stage
FROM node:20-alpine AS production

# Install dumb-init, wget, and Sharp dependencies for Alpine Linux
# vips-dev is required for Sharp to work on Alpine (musl-based) systems
RUN apk add --no-cache \
    dumb-init \
    wget \
    vips-dev \
    fftw-dev \
    build-base \
    python3 \
    --virtual .build-deps \
    gcc \
    g++ \
    make

# Create app user
RUN addgroup -g 1001 -S appuser && adduser -S appuser -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only (skip lifecycle scripts such as `prepare`/husky)
# --omit=dev replaces the deprecated --only=production flag
# --ignore-scripts prevents running package lifecycle scripts in the production image
# Remove --ignore-scripts to allow Sharp to rebuild for the correct platform
RUN npm ci --legacy-peer-deps --omit=dev && \
    npm rebuild sharp --platform=linux --arch=x64 --libc=musl && \
    npm cache clean --force

# Remove build dependencies to reduce image size
RUN apk del .build-deps

# Copy built application from builder stage
# Prisma client artifacts are generated in the builder (where dev deps are present).
# We avoid running `npx prisma generate` in production because `prisma` CLI is a devDependency
# and we install production deps with `--omit=dev --ignore-scripts` to prevent lifecycle scripts
# (e.g. husky prepare). Instead copy the generated prisma artifacts from the builder.
COPY --from=builder /app/dist ./dist
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
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node dist/health/health-check.js || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/src/main.js"]