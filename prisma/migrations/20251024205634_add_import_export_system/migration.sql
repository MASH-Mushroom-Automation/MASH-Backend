-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('IMPORT', 'EXPORT');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PRODUCT', 'ORDER', 'USER', 'CATEGORY', 'SELLER', 'BUYER', 'TRANSACTION', 'INVENTORY');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('URGENT', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "FileFormat" AS ENUM ('CSV', 'EXCEL', 'JSON', 'XML');

-- CreateEnum
CREATE TYPE "ErrorType" AS ENUM ('VALIDATION', 'CONSTRAINT', 'FORMAT', 'BUSINESS_RULE');

-- CreateEnum
CREATE TYPE "ErrorSeverity" AS ENUM ('ERROR', 'WARNING');

-- CreateTable
CREATE TABLE "import_export_jobs" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "status" "JobStatus" NOT NULL,
    "priority" "JobPriority" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileFormat" "FileFormat" NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT,
    "resultFileUrl" TEXT,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "progressPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "estimatedTimeMs" INTEGER,
    "options" JSONB,
    "filters" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_export_errors" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "columnName" TEXT,
    "fieldPath" TEXT,
    "errorType" "ErrorType" NOT NULL,
    "severity" "ErrorSeverity" NOT NULL,
    "errorCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "suggestion" TEXT,
    "originalValue" TEXT,
    "expectedFormat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_export_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_export_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entityType" "EntityType" NOT NULL,
    "fileFormat" "FileFormat" NOT NULL,
    "headers" JSONB NOT NULL,
    "sampleData" JSONB NOT NULL,
    "validation" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_export_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_export_jobs_status_createdAt_idx" ON "import_export_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "import_export_jobs_entityType_type_idx" ON "import_export_jobs"("entityType", "type");

-- CreateIndex
CREATE INDEX "import_export_jobs_createdBy_idx" ON "import_export_jobs"("createdBy");

-- CreateIndex
CREATE INDEX "import_export_errors_jobId_severity_idx" ON "import_export_errors"("jobId", "severity");

-- CreateIndex
CREATE INDEX "import_export_templates_entityType_fileFormat_idx" ON "import_export_templates"("entityType", "fileFormat");

-- AddForeignKey
ALTER TABLE "import_export_jobs" ADD CONSTRAINT "import_export_jobs_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_export_errors" ADD CONSTRAINT "import_export_errors_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "import_export_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
