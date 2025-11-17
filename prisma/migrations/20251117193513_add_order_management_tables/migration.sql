/*
  Warnings:

  - You are about to drop the column `addedAt` on the `cart_items` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `carts` table. All the data in the column will be lost.
  - You are about to drop the column `deliveredAt` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `discount` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `shippedAt` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `shipping` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `total` on the `orders` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[facebookId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[googleId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Made the column `originalPrice` on table `cart_items` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `totalAmount` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'COD';

-- DropIndex
DROP INDEX "public"."cart_items_cartId_isAvailable_idx";

-- DropIndex
DROP INDEX "public"."carts_abandonedAt_idx";

-- DropIndex
DROP INDEX "public"."carts_sessionId_key";

-- DropIndex
DROP INDEX "public"."carts_status_expiresAt_idx";

-- DropIndex
DROP INDEX "public"."carts_userId_key";

-- DropIndex
DROP INDEX "public"."orders_deliveredAt_idx";

-- DropIndex
DROP INDEX "public"."orders_userId_status_createdAt_idx";

-- AlterTable
ALTER TABLE "cart_items" DROP COLUMN "addedAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "quantity" DROP DEFAULT,
ALTER COLUMN "originalPrice" SET NOT NULL;

-- AlterTable
ALTER TABLE "carts" DROP COLUMN "currency";

-- AlterTable
ALTER TABLE "devices" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "deliveredAt",
DROP COLUMN "discount",
DROP COLUMN "shippedAt",
DROP COLUMN "shipping",
DROP COLUMN "tax",
DROP COLUMN "total",
ADD COLUMN     "actualDelivery" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "estimatedDelivery" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "paymentStatus" TEXT,
ADD COLUMN     "previousStatus" "OrderStatus",
ADD COLUMN     "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "shippingProvider" TEXT,
ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalAmount" DECIMAL(10,2) NOT NULL;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "maxCartQty" SET DEFAULT 100;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailVerificationCode" TEXT,
ADD COLUMN     "emailVerificationCodeExpiry" TIMESTAMP(3),
ADD COLUMN     "emailVerificationCodeSentAt" TIMESTAMP(3),
ADD COLUMN     "emailVerificationCodeUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "facebookId" TEXT,
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "oauthAccessToken" TEXT,
ADD COLUMN     "oauthProvider" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "oauthRefreshToken" TEXT,
ADD COLUMN     "oauthTokenExpiry" TIMESTAMP(3),
ADD COLUMN     "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordResetCode" TEXT,
ADD COLUMN     "passwordResetCodeExpiry" TIMESTAMP(3),
ADD COLUMN     "passwordResetCodeSentAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetCodeUsed" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "clerkId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus" NOT NULL,
    "toStatus" "OrderStatus" NOT NULL,
    "notes" TEXT,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_fulfillment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "pickerId" TEXT,
    "packerId" TEXT,
    "pickedAt" TIMESTAMP(3),
    "packedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "carrier" TEXT,
    "trackingUrl" TEXT,
    "labelUrl" TEXT,
    "weight" DECIMAL(10,2),
    "dimensions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_fulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_returns" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "refundAmount" DECIMAL(10,2) NOT NULL,
    "refundMethod" TEXT,
    "refundedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lalamove_quotations" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "distance" DOUBLE PRECISION NOT NULL,
    "distanceUnit" TEXT NOT NULL DEFAULT 'km',
    "stops" JSONB NOT NULL,
    "isScheduled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lalamove_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lalamove_orders" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "driverId" TEXT,
    "shareLink" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "distance" DOUBLE PRECISION NOT NULL,
    "distanceUnit" TEXT NOT NULL DEFAULT 'km',
    "stops" JSONB NOT NULL,
    "isPODEnabled" BOOLEAN NOT NULL DEFAULT true,
    "podStatus" TEXT,
    "podImage" TEXT,
    "podSignature" TEXT,
    "orderReference" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lalamove_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_status_history_orderId_changedAt_idx" ON "order_status_history"("orderId", "changedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "order_fulfillment_orderId_key" ON "order_fulfillment"("orderId");

-- CreateIndex
CREATE INDEX "order_returns_orderId_idx" ON "order_returns"("orderId");

-- CreateIndex
CREATE INDEX "order_returns_status_idx" ON "order_returns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lalamove_quotations_quotationId_key" ON "lalamove_quotations"("quotationId");

-- CreateIndex
CREATE INDEX "lalamove_quotations_quotationId_idx" ON "lalamove_quotations"("quotationId");

-- CreateIndex
CREATE INDEX "lalamove_quotations_status_idx" ON "lalamove_quotations"("status");

-- CreateIndex
CREATE INDEX "lalamove_quotations_userId_idx" ON "lalamove_quotations"("userId");

-- CreateIndex
CREATE INDEX "lalamove_quotations_createdAt_idx" ON "lalamove_quotations"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "lalamove_orders_orderId_key" ON "lalamove_orders"("orderId");

-- CreateIndex
CREATE INDEX "lalamove_orders_orderId_idx" ON "lalamove_orders"("orderId");

-- CreateIndex
CREATE INDEX "lalamove_orders_quotationId_idx" ON "lalamove_orders"("quotationId");

-- CreateIndex
CREATE INDEX "lalamove_orders_status_idx" ON "lalamove_orders"("status");

-- CreateIndex
CREATE INDEX "lalamove_orders_userId_idx" ON "lalamove_orders"("userId");

-- CreateIndex
CREATE INDEX "lalamove_orders_driverId_idx" ON "lalamove_orders"("driverId");

-- CreateIndex
CREATE INDEX "lalamove_orders_createdAt_idx" ON "lalamove_orders"("createdAt");

-- CreateIndex
CREATE INDEX "carts_createdAt_idx" ON "carts"("createdAt");

-- CreateIndex
CREATE INDEX "orders_userId_status_idx" ON "orders"("userId", "status");

-- CreateIndex
CREATE INDEX "orders_actualDelivery_idx" ON "orders"("actualDelivery");

-- CreateIndex
CREATE UNIQUE INDEX "users_facebookId_key" ON "users"("facebookId");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_email_emailVerificationCode_idx" ON "users"("email", "emailVerificationCode");

-- CreateIndex
CREATE INDEX "users_emailVerificationCode_emailVerificationCodeExpiry_idx" ON "users"("emailVerificationCode", "emailVerificationCodeExpiry");

-- CreateIndex
CREATE INDEX "users_email_passwordResetCode_idx" ON "users"("email", "passwordResetCode");

-- CreateIndex
CREATE INDEX "users_passwordResetCode_passwordResetCodeExpiry_idx" ON "users"("passwordResetCode", "passwordResetCodeExpiry");

-- CreateIndex
CREATE INDEX "users_googleId_idx" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_facebookId_idx" ON "users"("facebookId");

-- CreateIndex
CREATE INDEX "users_oauthProvider_idx" ON "users"("oauthProvider");

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_fulfillment" ADD CONSTRAINT "order_fulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
