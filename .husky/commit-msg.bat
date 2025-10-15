@echo off
REM Git commit-msg hook - Windows batch wrapper
REM This hook validates commit messages follow Conventional Commits

echo.
echo 📝 Validating commit message...

REM commitlint expects the commit message file path as first argument
call npx --no-install commitlint --edit %1
if %errorlevel% neq 0 (
    echo.
    echo ❌ Commit message validation failed!
    echo.
    echo 💡 Commit message must follow Conventional Commits format:
    echo    ^<type^>^(^<scope^>^): ^<description^>
    echo.
    echo    Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
    echo.
    echo    Examples:
    echo      feat(auth): add user login endpoint
    echo      fix(api): resolve null pointer in order service
    echo      docs: update API documentation
    echo.
    exit /b 1
)

echo ✅ Commit message is valid!
echo.
exit /b 0
