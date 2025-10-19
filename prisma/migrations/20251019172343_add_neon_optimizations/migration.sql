-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('SALES', 'REVENUE', 'USERS', 'PRODUCTS', 'ORDERS', 'DEVICES', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'REAL_TIME');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ReportType" NOT NULL,
    "configuration" JSONB NOT NULL,
    "schedule" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_executions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "resultData" JSONB,
    "resultUrl" TEXT,
    "errorMessage" TEXT,
    "executedBy" TEXT,

    CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_subscriptions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "frequency" "SubscriptionFrequency" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "reports"("type");

-- CreateIndex
CREATE INDEX "reports_createdBy_idx" ON "reports"("createdBy");

-- CreateIndex
CREATE INDEX "reports_isActive_type_idx" ON "reports"("isActive", "type");

-- CreateIndex
CREATE INDEX "report_executions_reportId_idx" ON "report_executions"("reportId");

-- CreateIndex
CREATE INDEX "report_executions_status_idx" ON "report_executions"("status");

-- CreateIndex
CREATE INDEX "report_executions_startedAt_idx" ON "report_executions"("startedAt");

-- CreateIndex
CREATE INDEX "report_executions_reportId_status_idx" ON "report_executions"("reportId", "status");

-- CreateIndex
CREATE INDEX "report_subscriptions_reportId_idx" ON "report_subscriptions"("reportId");

-- CreateIndex
CREATE INDEX "report_subscriptions_userId_idx" ON "report_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "report_subscriptions_isActive_frequency_idx" ON "report_subscriptions"("isActive", "frequency");

-- CreateIndex
CREATE UNIQUE INDEX "report_subscriptions_reportId_userId_channel_key" ON "report_subscriptions"("reportId", "userId", "channel");

-- CreateIndex
CREATE INDEX "alert_rules_createdBy_idx" ON "alert_rules"("createdBy");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_productId_orderId_idx" ON "order_items"("productId", "orderId");

-- CreateIndex
CREATE INDEX "payments_userId_status_createdAt_idx" ON "payments"("userId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "payments_transactionId_idx" ON "payments"("transactionId");

-- CreateIndex
CREATE INDEX "products_isDeleted_isActive_idx" ON "products"("isDeleted", "isActive");

-- CreateIndex
CREATE INDEX "users_email_isActive_idx" ON "users"("email", "isActive");

-- AddForeignKey
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_subscriptions" ADD CONSTRAINT "report_subscriptions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
