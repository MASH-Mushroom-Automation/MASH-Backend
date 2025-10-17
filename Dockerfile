# Multi-stage Docker build for MASH Backend
# Stage 1: Build stage
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

# Install dumb-init and wget for proper signal handling and health checks
RUN apk add --no-cache dumb-init wget

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
RUN npm ci --legacy-peer-deps --omit=dev --ignore-scripts && npm cache clean --force

# Generate Prisma Client in production stage
RUN npx prisma generate

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy scripts folder (if it exists)
COPY --from=builder --chown=appuser:appuser /app/scripts ./scripts

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && chown -R appuser:appuser /app/logs

# Set ownership of copied files
RUN chown -R appuser:appuser /app/dist /app/node_modules /app/prisma

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check - Use wget instead of node script for reliability
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/src/main.js"]