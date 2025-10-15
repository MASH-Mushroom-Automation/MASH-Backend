@echo off
REM Git pre-commit hook - Windows batch wrapper
REM This hook runs before commits to ensure code quality

echo.
echo 🔍 Running pre-commit checks...
echo.

REM Check code formatting
echo 📝 Checking code formatting...
call npm run format:check
if %errorlevel% neq 0 (
    echo.
    echo ❌ Formatting check failed. Run 'npm run format' to fix.
    exit /b 1
)
echo ✅ Formatting check passed!
echo.

REM Check linting
echo 🔧 Checking code linting...
call npm run lint:check
if %errorlevel% neq 0 (
    echo.
    echo ❌ Linting check failed. Run 'npm run lint' to fix.
    exit /b 1
)
echo ✅ Linting check passed!
echo.

REM Run unit tests
echo 🧪 Running unit tests...
call npm run test:unit
if %errorlevel% neq 0 (
    echo.
    echo ❌ Unit tests failed. Fix the failing tests before committing.
    exit /b 1
)
echo ✅ Unit tests passed!
echo.

echo ✨ All pre-commit checks passed! Ready to commit.
exit /b 0
