-- CreateTable
CREATE TABLE "search_logs" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "index" TEXT NOT NULL,
    "resultsCount" INTEGER NOT NULL,
    "took" INTEGER NOT NULL,
    "filters" JSONB,
    "sort" JSONB,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "clickedResult" TEXT,
    "isSlowQuery" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_logs_query_idx" ON "search_logs"("query");

-- CreateIndex
CREATE INDEX "search_logs_createdAt_idx" ON "search_logs"("createdAt");

-- CreateIndex
CREATE INDEX "search_logs_isSlowQuery_took_idx" ON "search_logs"("isSlowQuery", "took");

-- CreateIndex
CREATE INDEX "search_logs_userId_createdAt_idx" ON "search_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "search_logs_index_createdAt_idx" ON "search_logs"("index", "createdAt");
