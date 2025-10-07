import { registerAs } from '@nestjs/config';

export default registerAs('clerk', () => ({
  // Clerk API Keys
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
  secretKey: process.env.CLERK_SECRET_KEY || '',
  webhookSecret: process.env.CLERK_WEBHOOK_SECRET || '',
  jwtKey: process.env.CLERK_JWT_KEY || '',

  // Frontend URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  afterSignInUrl: process.env.CLERK_AFTER_SIGN_IN_URL || '/dashboard',
  afterSignUpUrl: process.env.CLERK_AFTER_SIGN_UP_URL || '/onboarding',

  // Session Configuration
  sessionDuration: process.env.SESSION_DURATION || '7d',
  refreshTokenDuration: process.env.REFRESH_TOKEN_DURATION || '30d',
  maxSessionsPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER || '5', 10),

  // Validation
  isConfigured: () => {
    return !!(
      process.env.CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY &&
      process.env.CLERK_WEBHOOK_SECRET
    );
  },
}));
