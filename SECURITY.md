# Security Policy

## Supported Versions

We actively support the following versions of MASH-Backend with security updates:

| Version | Supported          | Notes                          |
| ------- | ------------------ | ------------------------------ |
| 1.x.x   | :white_check_mark: | Current release - Full support |
| 0.x.x   | :x:                | Beta/Development - No support  |

## Reporting a Vulnerability

We take the security of MASH-Backend seriously. If you discover a security vulnerability, please follow these steps:

### 📧 How to Report

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead, please report security issues privately by:

1. **Email**: Send details to [mash.mushroom.automation@gmail.com](mailto:mash.mushroom.automation@gmail.com)
2. **GitHub Security Advisory**: Use [GitHub's private vulnerability reporting](https://github.com/MASH-Mushroom-Automation/MASH-Backend/security/advisories/new)

### 📝 What to Include

Please include the following information in your report:

- **Description**: A clear description of the vulnerability
- **Impact**: What type of vulnerability it is (e.g., SQL injection, XSS, authentication bypass)
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Proof of Concept**: Code snippets or screenshots if applicable
- **Suggested Fix**: If you have suggestions on how to fix the issue
- **Your Contact Info**: So we can follow up with questions

### ⏱️ Response Timeline

- **Initial Response**: Within 48 hours of receiving your report
- **Status Update**: Every 7 days until resolution
- **Fix Timeline**: Critical issues within 7 days, high severity within 14 days, medium/low within 30 days

### 🔒 Disclosure Policy

- We follow **Coordinated Vulnerability Disclosure (CVD)**
- We request a **90-day embargo** to develop and deploy fixes before public disclosure
- We will credit you in our security advisory (unless you prefer to remain anonymous)
- We may offer bug bounties for critical vulnerabilities (contact us for details)

### ✅ What to Expect

**If Accepted:**
- We will confirm the vulnerability and work on a fix
- We will keep you updated on our progress
- We will credit you in the security advisory and release notes
- We will notify you before public disclosure

**If Declined:**
- We will provide a clear explanation of why we don't consider it a vulnerability
- We will suggest alternative solutions if applicable

## Security Best Practices

### For Users

1. **Authentication**
   - Use strong passwords (minimum 12 characters)
   - Enable Two-Factor Authentication (2FA) when available
   - Rotate API keys regularly
   - Never commit secrets or credentials to version control

2. **Environment Configuration**
   - Keep `.env` files secure and never commit them
   - Use different credentials for development and production
   - Regularly update dependencies (`npm audit fix`)
   - Enable HTTPS in production

3. **Access Control**
   - Follow the principle of least privilege
   - Regularly review user permissions
   - Disable unused API endpoints
   - Monitor audit logs for suspicious activity

### For Developers

1. **Code Security**
   - Run `npm audit` before every deployment
   - Keep all dependencies up to date
   - Use parameterized queries to prevent SQL injection
   - Validate and sanitize all user inputs
   - Implement rate limiting on all API endpoints

2. **Secrets Management**
   - Never hardcode secrets in source code
   - Use environment variables for sensitive data
   - Use `.env.example` for templates (without actual values)
   - Rotate secrets regularly

3. **Testing**
   - Write security tests for authentication and authorization
   - Test for common vulnerabilities (OWASP Top 10)
   - Perform regular security audits
   - Use tools like `npm audit`, `snyk`, or similar

## Known Security Features

### Authentication & Authorization
- ✅ Clerk-based authentication with OAuth support (Google, GitHub, Facebook)
- ✅ JWT token-based session management
- ✅ Role-based access control (RBAC)
- ✅ Two-Factor Authentication (2FA) support
- ✅ Session management and device tracking
- ✅ API key authentication for external services

### Data Protection
- ✅ Bcrypt password hashing
- ✅ HTTPS/TLS encryption in production
- ✅ Input validation using class-validator
- ✅ SQL injection prevention via Prisma ORM
- ✅ XSS protection with helmet middleware
- ✅ CORS configuration for trusted origins

### Rate Limiting & DDoS Protection
- ✅ Redis-backed distributed rate limiting
- ✅ Throttling guards on sensitive endpoints
- ✅ Request timeout configuration
- ✅ Body parser limits

### Monitoring & Logging
- ✅ Prometheus metrics for security events
- ✅ OpenTelemetry tracing
- ✅ Audit logs for sensitive operations
- ✅ Slow query logging
- ✅ Error tracking and alerting

## Security Checklist for Deployment

- [ ] Environment variables properly configured
- [ ] Database connection uses SSL
- [ ] Redis connection secured with password
- [ ] Clerk credentials configured (production keys)
- [ ] JWT secrets are strong and unique
- [ ] Rate limiting enabled and tested
- [ ] CORS configured for production domains only
- [ ] HTTPS/TLS certificates installed
- [ ] Security headers configured (helmet)
- [ ] File upload limits set appropriately
- [ ] Logging configured for audit trails
- [ ] Backup strategy in place
- [ ] Monitoring and alerting configured
- [ ] Regular security updates scheduled
- [ ] Incident response plan documented

## Security Contacts

- **Security Team**: mash.mushroom.automation@gmail.com
- **Project Maintainers**: Listed in [CODEOWNERS](./.github/CODEOWNERS)
- **Security Advisories**: [GitHub Security Advisories](https://github.com/MASH-Mushroom-Automation/MASH-Backend/security/advisories)

## Acknowledgments

We would like to thank the following security researchers for responsibly disclosing vulnerabilities:

<!-- This section will be updated as vulnerabilities are reported and fixed -->

- *No security issues reported yet*

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NestJS Security Best Practices](https://docs.nestjs.com/security/authentication)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-client/security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

**Last Updated**: October 15, 2025  
**Policy Version**: 1.0.0
