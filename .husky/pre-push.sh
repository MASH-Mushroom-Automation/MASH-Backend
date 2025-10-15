#!/bin/sh
echo "🚀 Running pre-push checks..."

echo "🔨 Building application..."
npm run build || {
  echo "❌ Build failed. Fix compilation errors before pushing."
  exit 1
}

echo "🧪 Running all tests..."
npm run test || {
  echo "❌ Tests failed. Fix failing tests before pushing."
  exit 1
}

echo "📊 Validating Prisma schema..."
npx prisma validate || {
  echo "❌ Prisma schema validation failed."
  exit 1
}

echo "✅ Pre-push checks passed! Ready to push."


