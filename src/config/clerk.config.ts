import { registerAs } from '@nestjs/config';

export default registerAs('clerk', () => ({
  // Clerk API Keys
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
  secretKey: process.env.CLERK_SECRET_KEY || '',
  webhookSecret: process.env.CLERK_WEBHOOK_SECRET || '',
  jwtKey: process.env.CLERK_JWT_KEY || '',

    // Frontend URLs
  frontendUrl: process.env.FRONTEND_URL || 'https://mash-backend-api.up.railway.app',
  afterSignInUrl: process.env.CLERK_AFTER_SIGN_IN_URL || '/dashboard',
  afterSignUpUrl: process.env.CLERK_AFTER_SIGN_UP_URL || '/onboarding',

  // OAuth Configuration
  oauth: {
    google: {
      enabled: process.env.OAUTH_GOOGLE_ENABLED === 'true',
      clientId: process.env.OAUTH_GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET || '',
      redirectUrl:
        process.env.OAUTH_GOOGLE_REDIRECT_URL ||
        `${process.env.FRONTEND_URL}/auth/callback/google`,
    },
    github: {
      enabled: process.env.OAUTH_GITHUB_ENABLED === 'true',
      clientId: process.env.OAUTH_GITHUB_CLIENT_ID || '',
      clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET || '',
      redirectUrl:
        process.env.OAUTH_GITHUB_REDIRECT_URL ||
        `${process.env.FRONTEND_URL}/auth/callback/github`,
    },
    facebook: {
      enabled: process.env.OAUTH_FACEBOOK_ENABLED === 'true',
      appId: process.env.OAUTH_FACEBOOK_APP_ID || '',
      appSecret: process.env.OAUTH_FACEBOOK_APP_SECRET || '',
      redirectUrl:
        process.env.OAUTH_FACEBOOK_REDIRECT_URL ||
        `${process.env.FRONTEND_URL}/auth/callback/facebook`,
    },
  },

  // Session Configuration
  sessionDuration: process.env.SESSION_DURATION || '7d',
  refreshTokenDuration: process.env.REFRESH_TOKEN_DURATION || '30d',
  maxSessionsPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER || '5', 10),

  // Email Verification
  emailVerification: {
    enabled: process.env.EMAIL_VERIFICATION_ENABLED !== 'false',
    codeLength: 6,
    codeExpiry: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
  },

  // Password Reset
  passwordReset: {
    enabled: process.env.PASSWORD_RESET_ENABLED !== 'false',
    codeExpiry: 30 * 60 * 1000, // 30 minutes
    maxAttempts: 5,
  },

  // Validation
  isConfigured: () => {
    return !!(
      process.env.CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY &&
      process.env.CLERK_WEBHOOK_SECRET
    );
  },
}));
