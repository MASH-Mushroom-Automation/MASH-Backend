#!/bin/sh
echo "🔍 Running pre-commit checks..."

echo "📝 Checking code formatting..."
npm run format:check || {
  echo "❌ Formatting check failed. Run 'npm run format' to fix."
  exit 1
}

echo "🔧 Running ESLint..."
npm run lint:check || {
  echo "❌ ESLint check failed. Run 'npm run lint' to fix."
  exit 1
}

echo "🧪 Running unit tests..."
npm run test:unit || {
  echo "❌ Unit tests failed. Fix failing tests before committing."
  exit 1
}

echo "✅ Pre-commit checks passed!"


