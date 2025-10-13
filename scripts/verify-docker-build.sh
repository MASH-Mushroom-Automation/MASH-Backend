#!/bin/bash
# Script to verify Docker build produces correct structure
# Run this locally before pushing to Render

set -e

echo "🔍 Verifying Docker build structure..."

# Build the image
echo "📦 Building Docker image..."
docker build -t mash-backend:verify-build .

# Create a temporary container and inspect structure
echo "🔎 Inspecting container structure..."
CONTAINER_ID=$(docker create mash-backend:verify-build)

# Check for required files/directories
echo ""
echo "✅ Checking for required files..."
docker exec $CONTAINER_ID ls -la /app/dist/main.js || { echo "❌ FAIL: dist/main.js not found"; exit 1; }
docker exec $CONTAINER_ID ls -la /app/dist/health-check.js || { echo "❌ FAIL: dist/health-check.js not found"; exit 1; }
docker exec $CONTAINER_ID ls -la /app/node_modules/.prisma || { echo "❌ FAIL: Prisma client not found"; exit 1; }
docker exec $CONTAINER_ID ls -la /app/prisma/schema.prisma || { echo "❌ FAIL: Prisma schema not found"; exit 1; }

echo ""
echo "✅ Checking file ownership..."
docker exec $CONTAINER_ID stat -c "%U:%G" /app/dist/main.js | grep "appuser:appuser" || { echo "❌ FAIL: Incorrect ownership"; exit 1; }

echo ""
echo "✅ All checks passed!"
echo ""
echo "📊 Container structure:"
docker exec $CONTAINER_ID ls -lR /app/dist | head -20

# Cleanup
docker rm $CONTAINER_ID

echo ""
echo "🎉 Docker build verification successful!"
echo "   You can now safely push to trigger Render deployment."
