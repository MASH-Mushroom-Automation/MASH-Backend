@echo off
REM Git pre-push hook - Windows batch wrapper
REM This hook runs before pushes to ensure build and tests pass

echo.
echo 🚀 Running pre-push checks...
echo.

REM Build the project
echo 🏗️  Building project...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ❌ Build failed. Fix build errors before pushing.
    exit /b 1
)
echo ✅ Build successful!
echo.

REM Run all tests
echo 🧪 Running all tests...
call npm run test
if %errorlevel% neq 0 (
    echo.
    echo ❌ Tests failed. Fix failing tests before pushing.
    exit /b 1
)
echo ✅ All tests passed!
echo.

REM Validate Prisma schema
echo 🔍 Validating Prisma schema...
call npx prisma validate
if %errorlevel% neq 0 (
    echo.
    echo ❌ Prisma schema validation failed.
    exit /b 1
)
echo ✅ Prisma schema valid!
echo.

echo ✨ All pre-push checks passed! Ready to push.
exit /b 0
