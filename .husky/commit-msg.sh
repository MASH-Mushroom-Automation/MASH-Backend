#!/bin/sh
echo "📝 Validating commit message..."

npx --no-install commitlint --edit "$1" || {
  echo ""
  echo "❌ Commit message validation failed!"
  echo ""
  echo "Commit messages must follow Conventional Commits format:"
  echo "  <type>(<scope>): <subject>"
  echo ""
  echo "Examples:"
  echo "  feat(auth): add OAuth2 login support"
  echo "  fix(orders): resolve payment processing bug"
  echo "  docs(readme): update installation instructions"
  echo "  test(products): add unit tests for product service"
  echo ""
  echo "Valid types:"
  echo "  feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
  echo ""
  exit 1
}

echo "✅ Commit message is valid!"


