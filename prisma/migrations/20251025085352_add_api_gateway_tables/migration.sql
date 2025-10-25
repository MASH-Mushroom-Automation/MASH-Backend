-- CreateEnum
CREATE TYPE "LoadBalancingStrategy" AS ENUM ('ROUND_ROBIN', 'LEAST_CONNECTIONS', 'WEIGHTED_ROUND_ROBIN', 'IP_HASH', 'HEALTH_BASED');

-- CreateEnum
CREATE TYPE "RateLimitStrategy" AS ENUM ('TOKEN_BUCKET', 'LEAKY_BUCKET', 'FIXED_WINDOW', 'SLIDING_WINDOW', 'ADAPTIVE');

-- CreateEnum
CREATE TYPE "RequestQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CircuitBreakerStateEnum" AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

-- CreateTable
CREATE TABLE "api_gateway_configs" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "basePath" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "healthCheckUrl" TEXT,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "retryAttempts" INTEGER NOT NULL DEFAULT 3,
    "circuitBreaker" BOOLEAN NOT NULL DEFAULT true,
    "loadBalancing" "LoadBalancingStrategy" NOT NULL DEFAULT 'ROUND_ROBIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_gateway_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_overrides" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "apiKey" TEXT,
    "endpoint" TEXT NOT NULL,
    "requestLimit" INTEGER NOT NULL,
    "timeWindowMs" INTEGER NOT NULL,
    "strategy" "RateLimitStrategy" NOT NULL DEFAULT 'TOKEN_BUCKET',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "apiKey" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "requestSize" INTEGER,
    "responseSize" INTEGER,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "referer" TEXT,
    "rateLimitHit" BOOLEAN NOT NULL DEFAULT false,
    "throttled" BOOLEAN NOT NULL DEFAULT false,
    "queueTime" INTEGER,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_queues" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "payload" JSONB,
    "headers" JSONB,
    "status" "RequestQueueStatus" NOT NULL DEFAULT 'PENDING',
    "estimatedWaitMs" INTEGER,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "request_queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_version_usage" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "userId" TEXT,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_version_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuit_breaker_states" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "state" "CircuitBreakerStateEnum" NOT NULL DEFAULT 'CLOSED',
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailureAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "circuit_breaker_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_gateway_configs_serviceName_key" ON "api_gateway_configs"("serviceName");

-- CreateIndex
CREATE INDEX "rate_limit_overrides_apiKey_idx" ON "rate_limit_overrides"("apiKey");

-- CreateIndex
CREATE INDEX "rate_limit_overrides_endpoint_idx" ON "rate_limit_overrides"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_overrides_userId_endpoint_key" ON "rate_limit_overrides"("userId", "endpoint");

-- CreateIndex
CREATE INDEX "api_usage_logs_userId_timestamp_idx" ON "api_usage_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "api_usage_logs_endpoint_timestamp_idx" ON "api_usage_logs"("endpoint", "timestamp");

-- CreateIndex
CREATE INDEX "api_usage_logs_timestamp_idx" ON "api_usage_logs"("timestamp");

-- CreateIndex
CREATE INDEX "api_usage_logs_apiKey_idx" ON "api_usage_logs"("apiKey");

-- CreateIndex
CREATE INDEX "request_queues_status_priority_queuedAt_idx" ON "request_queues"("status", "priority", "queuedAt");

-- CreateIndex
CREATE INDEX "request_queues_userId_idx" ON "request_queues"("userId");

-- CreateIndex
CREATE INDEX "request_queues_expiresAt_idx" ON "request_queues"("expiresAt");

-- CreateIndex
CREATE INDEX "api_version_usage_version_idx" ON "api_version_usage"("version");

-- CreateIndex
CREATE INDEX "api_version_usage_userId_idx" ON "api_version_usage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "api_version_usage_version_endpoint_userId_key" ON "api_version_usage"("version", "endpoint", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "circuit_breaker_states_serviceName_key" ON "circuit_breaker_states"("serviceName");

-- CreateIndex
CREATE INDEX "circuit_breaker_states_state_idx" ON "circuit_breaker_states"("state");

-- AddForeignKey
ALTER TABLE "rate_limit_overrides" ADD CONSTRAINT "rate_limit_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_queues" ADD CONSTRAINT "request_queues_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_version_usage" ADD CONSTRAINT "api_version_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
