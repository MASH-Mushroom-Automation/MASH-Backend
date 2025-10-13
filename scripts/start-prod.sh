#!/usr/bin/env sh
# Run Prisma migrations (idempotent) then start the compiled Node app
# Usage: ./scripts/start-prod.sh

set -e

echo "🔁 Running Prisma migrations (deploy)..."
npx prisma migrate deploy

echo "🚀 Starting application"
exec node dist/main.js
