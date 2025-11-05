/**
 * Environment Variable Validation Configuration
 *
 * This file provides a comprehensive Joi schema to validate all required
 * environment variables at application startup. This ensures that critical
 * configuration is present before the application attempts to run.
 *
 * Benefits:
 * - Early detection of missing required configuration
 * - Clear error messages for invalid values
 * - Type coercion for number/boolean values
 * - Prevents runtime crashes due to missing env vars
 *
 * Usage:
 * Import and use in ConfigModule.forRoot() in app.module.ts
 */

import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // ==================== NODE ENVIRONMENT ====================
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development')
    .description('Node environment'),

  PORT: Joi.number().default(3000).description('Application port'),

  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'debug', 'verbose')
    .default('log')
    .description('Logging level'),

  // ==================== DATABASE (PostgreSQL) ====================
  DATABASE_URL: Joi.string().uri().required().description('PostgreSQL connection URL (required)'),

  DATABASE_POOL_MIN: Joi.number()
    .min(0)
    .default(2)
    .description('Minimum database pool connections'),

  DATABASE_POOL_MAX: Joi.number()
    .min(1)
    .default(10)
    .description('Maximum database pool connections'),

  DATABASE_POOL_IDLE_TIMEOUT: Joi.number()
    .min(0)
    .default(10000)
    .description('Idle timeout in milliseconds'),

  DATABASE_QUERY_TIMEOUT: Joi.number()
    .min(0)
    .default(30000)
    .description('Query timeout in milliseconds'),

  // ==================== CACHING (Redis) ====================
  REDIS_URL: Joi.string()
    .uri()
    .optional()
    .allow('')
    .description('Redis connection URL (optional - caching disabled if not provided)'),

  REDIS_CACHE_TTL: Joi.number().min(0).default(3600).description('Default cache TTL in seconds'),

  CACHE_ENABLED: Joi.boolean().default(true).description('Enable caching'),

  // ==================== AUTHENTICATION & SECURITY ====================
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .description('JWT secret key (min 32 characters, required)'),

  JWT_ACCESS_TOKEN_EXPIRY: Joi.string().default('15m').description('JWT access token expiry'),

  JWT_REFRESH_TOKEN_EXPIRY: Joi.string().default('7d').description('JWT refresh token expiry'),

  // Clerk Authentication
  CLERK_PUBLISHABLE_KEY: Joi.string().allow('').description('Clerk publishable key (optional)'),

  CLERK_SECRET_KEY: Joi.string().allow('').description('Clerk secret key (optional)'),

  CLERK_WEBHOOK_SECRET: Joi.string().allow('').description('Clerk webhook secret (optional)'),

  // Firebase Authentication
  FIREBASE_PROJECT_ID: Joi.string().allow('').description('Firebase project ID (optional)'),

  FIREBASE_CLIENT_EMAIL: Joi.string().allow('').description('Firebase client email (optional)'),

  FIREBASE_PRIVATE_KEY: Joi.string().allow('').description('Firebase private key (optional)'),

  // ==================== BACKEND URL ====================
  BACKEND_URL: Joi.string()
    .uri()
    .default('http://localhost:3000')
    .description('Backend URL for API (development: http://localhost:3000, production: https://mash-backend-api-production.up.railway.app)'),

  // ==================== CORS ====================
  CORS_ORIGINS: Joi.string()
    .default('https://mash-backend-api-production.up.railway.app,http://localhost:3000,http://localhost:5173')
    .description('Comma-separated list of allowed CORS origins'),

  CORS_CREDENTIALS: Joi.boolean().default(true).description('Enable CORS credentials'),

  // ==================== RATE LIMITING ====================
  THROTTLE_ENABLED: Joi.boolean().default(true).description('Enable rate limiting'),

  THROTTLE_TTL: Joi.number().min(1).default(60).description('Throttle TTL in seconds'),

  THROTTLE_LIMIT: Joi.number().min(1).default(100).description('Throttle request limit'),

  // ==================== EMAIL (SendGrid) ====================
  SENDGRID_API_KEY: Joi.string().allow('').description('SendGrid API key'),

  SENDGRID_FROM_EMAIL: Joi.string().allow('').email().description('SendGrid from email'),

  SENDGRID_FROM_NAME: Joi.string().allow('').description('SendGrid from name'),

  // ==================== SMS (Twilio) ====================
  TWILIO_ACCOUNT_SID: Joi.string().allow('').description('Twilio account SID'),

  TWILIO_AUTH_TOKEN: Joi.string().allow('').description('Twilio auth token'),

  TWILIO_PHONE_NUMBER: Joi.string().allow('').description('Twilio phone number'),

  // ==================== PUSH NOTIFICATIONS (Firebase) ====================
  FCM_SERVER_KEY: Joi.string().allow('').description('Firebase Cloud Messaging server key'),

  // ==================== PAYMENT GATEWAY ====================
  PAYMENT_GATEWAY_API_KEY: Joi.string().allow('').description('Payment gateway API key'),

  PAYMENT_GATEWAY_SECRET_KEY: Joi.string().allow('').description('Payment gateway secret key'),

  PAYMENT_WEBHOOK_SECRET: Joi.string().allow('').description('Payment webhook secret'),

  // ==================== MQTT (IoT Devices) ====================
  MQTT_BROKER_URL: Joi.string().uri().allow('').description('MQTT broker URL'),

  MQTT_USERNAME: Joi.string().allow('').description('MQTT username'),

  MQTT_PASSWORD: Joi.string().allow('').description('MQTT password'),

  // ==================== WEBSOCKET ====================
  WS_NAMESPACE: Joi.string().default('/events').description('WebSocket namespace'),

  WS_PING_INTERVAL: Joi.number()
    .min(1000)
    .default(25000)
    .description('WebSocket ping interval in milliseconds'),

  WS_PING_TIMEOUT: Joi.number()
    .min(1000)
    .default(60000)
    .description('WebSocket ping timeout in milliseconds'),

  // ==================== OPENTELEMETRY TRACING ====================
  OTEL_ENABLED: Joi.boolean().default(false).description('Enable OpenTelemetry tracing'),

  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string()
    .uri()
    .allow('')
    .default('http://localhost:4318/v1/traces')
    .description('OTLP exporter endpoint'),

  OTEL_SERVICE_NAME: Joi.string().default('mash-backend').description('Service name for tracing'),

  // ==================== FILE UPLOADS ====================
  MAX_FILE_SIZE: Joi.number()
    .min(0)
    .default(5242880)
    .description('Maximum file size in bytes (default: 5MB)'),

  UPLOAD_DIR: Joi.string().default('./uploads').description('Upload directory path'),

  // ==================== SWAGGER/OPENAPI ====================
  SWAGGER_ENABLED: Joi.boolean().default(true).description('Enable Swagger API documentation'),

  // ==================== SESSION & SECURITY ====================
  SESSION_SECRET: Joi.string()
    .min(32)
    .allow('')
    .description('Session secret key (min 32 characters)'),

  CSRF_ENABLED: Joi.boolean().default(true).description('Enable CSRF protection'),

  // ==================== MONITORING ====================
  PROMETHEUS_ENABLED: Joi.boolean().default(true).description('Enable Prometheus metrics'),

  PROMETHEUS_PORT: Joi.number().allow('').description('Prometheus metrics port (if separate)'),
});

/**
 * Validation options for the environment schema
 */
export const envValidationOptions = {
  // Stop validation on first error
  abortEarly: false,
  // Allow unknown environment variables (for cloud platforms)
  allowUnknown: true,
  // Strip unknown environment variables
  stripUnknown: false,
};
