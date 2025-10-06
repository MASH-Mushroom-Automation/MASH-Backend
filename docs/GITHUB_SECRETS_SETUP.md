# GitHub Secrets Configuration Guide

This document explains how to configure GitHub Secrets required for the CI/CD pipeline.

## 📋 Required Secrets

### 1. SonarQube Integration

#### SONAR_TOKEN
**Description**: Authentication token for SonarCloud/SonarQube  
**How to get it**:
1. Go to [SonarCloud](https://sonarcloud.io/)
2. Sign in with GitHub
3. Click on "My Account" → "Security"
4. Generate a new token
5. Copy the token

**Add to GitHub**:
```bash
Settings → Secrets and variables → Actions → New repository secret
Name: SONAR_TOKEN
Value: <your-sonarcloud-token>
```

#### SONAR_HOST_URL
**Description**: SonarCloud URL  
**Value**: `https://sonarcloud.io`

**Add to GitHub**:
```bash
Settings → Secrets and variables → Actions → New repository secret
Name: SONAR_HOST_URL
Value: https://sonarcloud.io
```

---

### 2. Security Scanning (Snyk)

#### SNYK_TOKEN
**Description**: Authentication token for Snyk security scanning  
**How to get it**:
1. Go to [Snyk.io](https://snyk.io/)
2. Sign up/Sign in with GitHub
3. Go to Account Settings
4. Generate API token
5. Copy the token

**Add to GitHub**:
```bash
Settings → Secrets and variables → Actions → New repository secret
Name: SNYK_TOKEN
Value: <your-snyk-token>
```

---

### 3. Docker Registry

#### DOCKER_USERNAME
**Description**: Docker Hub username  
**Value**: Your Docker Hub username

**Add to GitHub**:
```bash
Settings → Secrets and variables → Actions → New repository secret
Name: DOCKER_USERNAME
Value: <your-dockerhub-username>
```

#### DOCKER_PASSWORD
**Description**: Docker Hub access token  
**How to get it**:
1. Log in to [Docker Hub](https://hub.docker.com/)
2. Go to Account Settings → Security
3. Create new access token
4. Copy the token

**Add to GitHub**:
```bash
Settings → Secrets and variables → Actions → New repository secret
Name: DOCKER_PASSWORD
Value: <your-dockerhub-token>
```

---

## 🚀 Quick Setup Script

You can add all secrets using GitHub CLI:

```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Login to GitHub
gh auth login

# Add SonarQube secrets
gh secret set SONAR_TOKEN --body "<your-token>"
gh secret set SONAR_HOST_URL --body "https://sonarcloud.io"

# Add Snyk secret
gh secret set SNYK_TOKEN --body "<your-token>"

# Add Docker secrets
gh secret set DOCKER_USERNAME --body "<your-username>"
gh secret set DOCKER_PASSWORD --body "<your-token>"
```

---

## 📝 SonarCloud Project Setup

### Step 1: Create SonarCloud Organization
1. Go to https://sonarcloud.io/
2. Click "Analyze new project"
3. Import from GitHub
4. Select your organization: **MASH-Mushroom-Automation**

### Step 2: Create Project
1. Select repository: **MASH-Backend**
2. Set up project key: `MASH-Mushroom-Automation_MASH-Backend`
3. Choose "With GitHub Actions"

### Step 3: Configure Quality Gate
1. Go to your project
2. Click "Quality Gate"
3. Set thresholds:
   - Coverage: > 80%
   - Duplicated Lines: < 3%
   - Maintainability Rating: A
   - Reliability Rating: A
   - Security Rating: A

---

## 🔐 Snyk Project Setup

### Step 1: Import Repository
1. Go to https://snyk.io/
2. Click "Add project"
3. Select GitHub
4. Import **MASH-Backend**

### Step 2: Configure Settings
1. Go to project settings
2. Set severity threshold: **Medium**
3. Enable automatic PRs for vulnerabilities
4. Enable dependency monitoring

---

## 🐳 Docker Hub Setup

### Step 1: Create Repository
1. Log in to https://hub.docker.com/
2. Click "Create Repository"
3. Repository name: `mash-backend/api`
4. Set visibility: Public (for free tier)

### Step 2: Configure Automated Builds (Optional)
1. Link GitHub account
2. Select repository
3. Configure build triggers

---

## ✅ Verification

After adding all secrets, verify the setup:

```bash
# Check if secrets are added
gh secret list

# Expected output:
# DOCKER_PASSWORD   Updated 2025-10-06
# DOCKER_USERNAME   Updated 2025-10-06
# SNYK_TOKEN        Updated 2025-10-06
# SONAR_HOST_URL    Updated 2025-10-06
# SONAR_TOKEN       Updated 2025-10-06
```

---

## 🔄 Trigger CI/CD Pipeline

After setup, trigger the pipeline:

```bash
# Push to main branch
git add .
git commit -m "feat: complete CI/CD setup with Newman, SonarQube, and Docker"
git push origin main

# Or create a pull request
git checkout -b feature/cicd-completion
git add .
git commit -m "feat: complete CI/CD setup"
git push origin feature/cicd-completion
gh pr create --title "Complete CI/CD Pipeline" --body "Adds Newman, SonarQube, Snyk, and Docker integration"
```

---

## 📊 Expected Pipeline Results

Once configured, your CI/CD pipeline will:

✅ **Lint & Format** - ESLint and Prettier checks  
✅ **Unit Tests** - Jest with 80%+ coverage  
✅ **Integration Tests** - E2E test suite  
✅ **Newman API Tests** - All 13 Postman collections  
✅ **SonarQube Analysis** - Code quality gates  
✅ **Security Scan** - Snyk vulnerability checks  
✅ **CodeQL Analysis** - Security code scanning  
✅ **Docker Build** - Multi-platform images  

---

## 🎯 Success Criteria

Your CI/CD is fully configured when:

- [ ] All GitHub Secrets added
- [ ] SonarCloud project created and linked
- [ ] Snyk project imported and configured
- [ ] Docker Hub repository created
- [ ] CI/CD pipeline runs successfully
- [ ] All quality gates pass
- [ ] Docker images built and pushed

---

## 🆘 Troubleshooting

### SonarQube Authentication Failed
- Verify `SONAR_TOKEN` is correct
- Check token hasn't expired
- Ensure token has proper permissions

### Snyk Scan Failed
- Verify `SNYK_TOKEN` is valid
- Check if repository is imported in Snyk
- Review Snyk project settings

### Docker Push Failed
- Verify Docker Hub credentials
- Check if repository exists
- Ensure proper permissions

### Newman Tests Failed
- Check if backend is running
- Verify environment variables in Postman
- Review Newman logs in artifacts

---

## 📞 Support

If you encounter issues:

1. Check GitHub Actions logs
2. Review [GitHub Actions Docs](https://docs.github.com/en/actions)
3. Consult [SonarCloud Docs](https://docs.sonarcloud.io/)
4. Visit [Snyk Documentation](https://docs.snyk.io/)
5. Create an issue in the repository

---

**Last Updated**: October 6, 2025  
**Status**: Ready for configuration
