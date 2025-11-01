# CI/CD Fix: Docker Build Path Correction

**Date**: November 2, 2025  
**Issue**: Docker build failing with "dist/src/main.js not found"  
**Status**: ✅ **FIXED** (Commit: 1d29e435)

---

## 🚨 Problem Analysis

### Error Description
The Docker build was failing during the verification step with:
```
#20 17.15 ls: dist/src/: No such file or directory
#20 17.15 ERROR: dist/src/main.js not found after build!
```

### Root Cause
**Mismatch between actual build output path and Dockerfile expectations:**

1. **Actual Build Output**: `dist/main.js`
   - TypeScript compiles `src/main.ts` → `dist/main.js`
   - The `rootDir: "./src"` in `tsconfig.build.json` strips the `src/` prefix from output paths
   - Build logs showed: `dist/main.js`, `dist/modules/`, `dist/monitoring/`, etc.

2. **Dockerfile Expectations**: `dist/src/main.js`
   - Build verification: `test -f dist/src/main.js`
   - Container startup: `CMD ["node", "dist/src/main.js"]`
   - Both were checking for the wrong path

### Why This Happened
The TypeScript configuration uses:
```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

When `rootDir` is set to `"./src"`, TypeScript **removes** the `src/` prefix from the output structure:
- `src/main.ts` → `dist/main.js` (NOT `dist/src/main.js`)
- `src/modules/auth/auth.service.ts` → `dist/modules/auth/auth.service.js`

---

## ✅ Solution Implemented

### Changes Made to Dockerfile

**1. Fixed Build Verification (Line 27-30)**
```dockerfile
# BEFORE
RUN npm run build && \
    ls -la dist/ && \
    ls -la dist/src/ && \
    test -f dist/src/main.js || (echo "ERROR: dist/src/main.js not found!" && exit 1)

# AFTER
RUN npm run build && \
    ls -la dist/ && \
    test -f dist/main.js || (echo "ERROR: dist/main.js not found after build!" && exit 1)
```

**Changes:**
- ✅ Removed `ls -la dist/src/` (directory doesn't exist)
- ✅ Changed verification path: `dist/src/main.js` → `dist/main.js`
- ✅ Added explanatory comment about `rootDir` behavior

**2. Fixed Container Startup Command (Line 116)**
```dockerfile
# BEFORE
CMD ["node", "dist/src/main.js"]

# AFTER
CMD ["node", "dist/main.js"]
```

**Changes:**
- ✅ Updated startup path: `dist/src/main.js` → `dist/main.js`
- ✅ Added comment explaining the path structure

---

## 🔍 Verification Steps

### Local Verification (Completed ✅)
```bash
# 1. Clean build
npm run build

# 2. Verify output structure
ls dist/
# Output: main.js, main.d.ts, modules/, monitoring/, tracing.js, etc.

# 3. Verify main.js exists
Test-Path dist/main.js
# Output: True

# 4. Verify dist/src/ does NOT exist
Test-Path dist/src/
# Output: False
```

### CI/CD Pipeline (Next Steps ⏳)
The fix has been pushed (commit 1d29e435). The CI/CD pipeline should now:
1. ✅ Build successfully with `npm run build`
2. ✅ Find `dist/main.js` during verification
3. ✅ Start the container with `node dist/main.js`
4. ✅ Pass the health check endpoint

---

## 📊 Impact Assessment

### Before Fix
- ❌ Docker build: **FAILED** (exit code 1)
- ❌ CI/CD pipeline: **BLOCKED**
- ❌ Deployment: **IMPOSSIBLE**

### After Fix
- ✅ Docker build: **SUCCESS** (expected)
- ✅ CI/CD pipeline: **UNBLOCKED** (in progress)
- ✅ Deployment: **READY** (pending CI verification)

---

## 🎯 Related Fixes

This is the **second critical CI/CD fix** in this session:

1. **Fix #1** (Commit: 776eb756): Synchronized `package-lock.json` with `package.json`
   - Resolved npm ci dependency conflicts
   - Fixed 100+ missing dependencies
   - See: `docs/CI_CD_FIX_PACKAGE_LOCK.md`

2. **Fix #2** (Commit: 1d29e435): Corrected Docker build output path
   - Fixed build verification path mismatch
   - Updated container startup command
   - This document

---

## 🔧 Technical Details

### TypeScript Build Configuration
**File**: `tsconfig.build.json`
```json
{
  "compilerOptions": {
    "outDir": "./dist",      // Output directory
    "rootDir": "./src",      // Root directory (strips this prefix)
    "baseUrl": "./",
    "incremental": true,
    "declaration": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

**Key Behavior**: `rootDir: "./src"` tells TypeScript to:
- Read files from `src/`
- Remove the `src/` prefix when outputting to `dist/`
- Result: `src/main.ts` → `dist/main.js` (NOT `dist/src/main.js`)

### Docker Build Process
**File**: `Dockerfile` (Lines 27-30)
```dockerfile
# Build the application and verify it succeeded
# Note: Build outputs to dist/main.js (not dist/src/main.js) because rootDir strips src/ prefix
RUN npm run build && \
    ls -la dist/ && \
    test -f dist/main.js || (echo "ERROR: dist/main.js not found after build!" && exit 1)
```

### Container Startup
**File**: `Dockerfile` (Line 116)
```dockerfile
# Start the application (main.js is at dist/main.js, not dist/src/main.js)
CMD ["node", "dist/main.js"]
```

---

## 🛡️ Prevention Strategies

### 1. Add Build Output Verification to Local Testing
```json
// package.json scripts
{
  "scripts": {
    "build": "nest build",
    "build:verify": "npm run build && node -e \"if(!require('fs').existsSync('dist/main.js')) throw new Error('dist/main.js not found!')\"",
    "docker:build": "docker build -t mash-backend:latest .",
    "docker:test": "npm run build:verify && npm run docker:build"
  }
}
```

### 2. Document Build Output Structure
Create `BUILD_OUTPUT_STRUCTURE.md`:
```markdown
# Build Output Structure

## Expected Structure
```
dist/
├── main.js
├── main.d.ts
├── main.js.map
├── modules/
├── monitoring/
├── common/
└── database/
```

## Important Notes
- ✅ main.js is at `dist/main.js` (NOT `dist/src/main.js`)
- ✅ TypeScript `rootDir: "./src"` strips the `src/` prefix
- ✅ All imports use the flattened structure
```

### 3. Add Pre-Commit Hook for Docker Build Tests
```bash
#!/bin/bash
# .husky/pre-push

echo "🔍 Verifying Docker build configuration..."
npm run build
if [ ! -f "dist/main.js" ]; then
  echo "❌ dist/main.js not found! Check tsconfig.build.json"
  exit 1
fi
echo "✅ Build output verified"
```

### 4. CI/CD Pipeline Improvements
Add a dedicated build verification step:
```yaml
# .github/workflows/ci.yml
- name: Verify Build Output
  run: |
    npm run build
    ls -la dist/
    test -f dist/main.js || (echo "ERROR: dist/main.js not found!" && exit 1)
    echo "✅ Build output structure verified"
```

---

## 📝 Lessons Learned

### 1. TypeScript Configuration Gotchas
- `rootDir` **strips** the root directory prefix from output paths
- Always verify actual output structure matches expectations
- Document the expected build output structure

### 2. Docker Multi-Stage Builds
- Build verification should run in the **builder stage**
- Use `ls -la` to inspect actual output before testing paths
- Container startup commands must match actual file locations

### 3. CI/CD Pipeline Design
- Test Docker builds **locally** before pushing
- Add explicit build output verification steps
- Document expected file locations in comments

### 4. Communication & Documentation
- Update Dockerfile comments when paths change
- Create troubleshooting guides for complex issues
- Track all CI/CD fixes in dedicated documents

---

## 🔄 Rollback Plan

If this fix causes issues:

### Rollback Command
```bash
git revert 1d29e435
git push
```

### Alternative Solution
If you prefer `dist/src/main.js` structure:

1. **Update tsconfig.build.json**:
```json
{
  "compilerOptions": {
    "outDir": "./dist/src",  // Changed from "./dist"
    "rootDir": "./src"
  }
}
```

2. **Revert Dockerfile changes** to use `dist/src/main.js`

**Note**: The current fix is preferred because:
- ✅ Matches NestJS conventions
- ✅ Simpler output structure
- ✅ Easier to navigate built files

---

## 📞 Support & Next Steps

### Immediate Actions (Completed ✅)
1. ✅ Fixed Dockerfile build verification path
2. ✅ Updated container startup command
3. ✅ Committed changes (1d29e435)
4. ✅ Pushed to remote repository
5. ✅ Created troubleshooting documentation

### Monitoring (In Progress ⏳)
1. ⏳ Monitor GitHub Actions workflow
2. ⏳ Verify Docker build passes
3. ⏳ Confirm container starts successfully
4. ⏳ Validate health check endpoint

### Follow-Up Tasks (Optional)
1. Add build verification to `package.json` scripts
2. Create `BUILD_OUTPUT_STRUCTURE.md` documentation
3. Add pre-push hook for Docker build tests
4. Update CI/CD pipeline with explicit verification

---

## 📚 Related Documentation

- **Package Lock Fix**: `docs/CI_CD_FIX_PACKAGE_LOCK.md`
- **Implementation Summary**: `docs/monitoring/IMPLEMENTATION_SUMMARY.md`
- **Build Troubleshooting**: `docs/BUILD_FIXES_SUMMARY.md`
- **TypeScript Config**: `tsconfig.build.json`
- **Docker Configuration**: `Dockerfile`

---

## 🎉 Summary

**Problem**: Docker build failing because Dockerfile expected `dist/src/main.js` but TypeScript outputs to `dist/main.js`

**Solution**: Updated Dockerfile to match actual TypeScript output structure:
- Build verification: `dist/src/main.js` → `dist/main.js`
- Container startup: `CMD ["node", "dist/src/main.js"]` → `CMD ["node", "dist/main.js"]`

**Status**: ✅ **FIXED** and pushed (commit 1d29e435)

**Next**: Monitor CI/CD pipeline to confirm Docker build passes

---

**Last Updated**: November 2, 2025  
**Author**: GitHub Copilot AI Assistant  
**Commit**: 1d29e435ca29d6b2803967d4a9864e6efa615c28  
**Branch**: `33-advanced-monitoring-observability-backend`
