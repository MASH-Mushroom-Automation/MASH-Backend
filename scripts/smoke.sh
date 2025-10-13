#!/usr/bin/env sh
# Simple smoke test for the API health endpoint
# Usage: ./scripts/smoke.sh http://localhost:3000/api/v1/health

set -e

URL=${1:-http://localhost:3000/api/v1/health}
echo "🔎 Running smoke test against ${URL}"

for i in 1 2 3 4 5 6 7 8 9 10; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$URL" || echo 000)
  if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
    echo "✅ Health check OK (HTTP $status)"
    exit 0
  fi
  echo "Waiting for service... (attempt $i)"
  sleep 2
done

echo "❌ Health check failed after retries (last status: $status)"
exit 1
